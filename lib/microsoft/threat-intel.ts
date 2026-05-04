/**
 * lib/microsoft/threat-intel.ts
 * Threat Intelligence feed: sync from Sentinel, check IoCs, store in context.
 */

import { db } from '@/lib/db'
import { SentinelConfig } from '@/lib/microsoft/sentinel'

const TOKEN_ENDPOINT = 'https://login.microsoftonline.com'
const ARM_BASE = 'https://management.azure.com'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ThreatIndicator {
  id: string
  type: 'ip' | 'domain' | 'url' | 'file_hash' | 'email'
  value: string
  confidence: number        // 0-100
  severity: 'high' | 'medium' | 'low'
  tags: string[]
  source: string            // Sentinel TI | MSTIC | External
  expiresAt?: Date
  description: string
}

// ── ARM token ─────────────────────────────────────────────────────────────────

async function getARMToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const url = `${TOKEN_ENDPOINT}/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://management.azure.com/.default',
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`ARM token error: ${res.status}`)
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

async function armGet<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`ARM error ${res.status}: ${url}`)
  return res.json() as Promise<T>
}

function sentinelBase(cfg: SentinelConfig): string {
  return (
    `${ARM_BASE}/subscriptions/${cfg.subscriptionId}` +
    `/resourceGroups/${cfg.resourceGroup}` +
    `/providers/Microsoft.OperationalInsights/workspaces/${cfg.workspaceName}` +
    `/providers/Microsoft.SecurityInsights`
  )
}

// ── IoC type detection ────────────────────────────────────────────────────────

function detectIocType(patternType?: string, pattern?: string): ThreatIndicator['type'] {
  const pt = (patternType ?? '').toLowerCase()
  const p = (pattern ?? '').toLowerCase()

  if (pt === 'ipv4-addr' || pt === 'ipv6-addr' || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(p)) return 'ip'
  if (pt === 'domain-name' || pt === 'hostname' || /^[a-z0-9-]+\.[a-z]{2,}/.test(p)) return 'domain'
  if (pt === 'url' || p.startsWith('http')) return 'url'
  if (pt === 'file' || /^[a-f0-9]{32,64}$/i.test(p)) return 'file_hash'
  if (pt === 'email-addr' || p.includes('@')) return 'email'

  return 'domain' // fallback
}

// ── Extract value from STIX pattern ──────────────────────────────────────────

function extractPatternValue(pattern?: string): string {
  if (!pattern) return ''
  // STIX pattern: [domain-name:value = 'evil.com']
  const match = pattern.match(/'([^']+)'/)
  return match?.[1] ?? pattern
}

// ── Confidence → severity ─────────────────────────────────────────────────────

function confidenceToSeverity(confidence?: number): 'high' | 'medium' | 'low' {
  const c = confidence ?? 50
  if (c >= 80) return 'high'
  if (c >= 40) return 'medium'
  return 'low'
}

// ── Sync TI indicators from Sentinel ─────────────────────────────────────────

export async function syncThreatIndicators(config: SentinelConfig): Promise<ThreatIndicator[]> {
  const token = await getARMToken(config.tenantId, config.clientId, config.clientSecret)
  const base = sentinelBase(config)

  let rawIndicators: Array<{
    id: string
    name: string
    properties?: {
      pattern?: string
      patternType?: string
      validFrom?: string
      validUntil?: string
      confidence?: number
      indicatorTypes?: string[]
      displayName?: string
      description?: string
      source?: string
      threatTypes?: string[]
      labels?: string[]
    }
  }> = []

  const resp = await armGet<{ value: typeof rawIndicators }>(
    token,
    `${base}/threatIntelligence/main/indicators?api-version=2022-12-01-preview&$top=500`,
  )
  rawIndicators = resp.value ?? []

  const now = new Date()
  const indicators: ThreatIndicator[] = []

  for (const raw of rawIndicators) {
    const props = raw.properties ?? {}
    const patternValue = extractPatternValue(props.pattern)
    if (!patternValue) continue

    const type = detectIocType(props.patternType, patternValue)
    const expiresAt = props.validUntil ? new Date(props.validUntil) : undefined
    const isExpired = expiresAt && expiresAt < now

    if (isExpired) continue // Skip expired indicators

    const tags = [
      ...(props.indicatorTypes ?? []),
      ...(props.threatTypes ?? []),
      ...(props.labels ?? []),
    ].filter(Boolean)

    indicators.push({
      id: raw.name,
      type,
      value: patternValue,
      confidence: props.confidence ?? 50,
      severity: confidenceToSeverity(props.confidence),
      tags,
      source: props.source ?? 'Sentinel TI',
      expiresAt,
      description: props.description ?? props.displayName ?? `Threat indicator: ${patternValue}`,
    })
  }

  return indicators
}

// ── Check a value against known TI (in-memory from cached context) ────────────

export async function checkThreatIndicator(
  orgId: string,
  value: string,
  type: ThreatIndicator['type'],
): Promise<ThreatIndicator | null> {
  try {
    // Look up from stored indicators in system context
    // We store them in system_settings.extraConfig.threatIndicators[orgId]
    const { systemSettings } = await import('@/lib/db/schema')
    const settings = await db.select().from(systemSettings).limit(1)
    const row = settings[0]

    if (!row?.extraConfig) return null

    const cfg = row.extraConfig as Record<string, unknown>
    const orgIndicators = cfg[`ti_${orgId}`]

    if (!Array.isArray(orgIndicators)) return null

    const indicators = orgIndicators as ThreatIndicator[]
    const valueLower = value.toLowerCase()

    const match = indicators.find(
      (ind) => ind.type === type && ind.value.toLowerCase() === valueLower,
    )

    return match ?? null
  } catch {
    return null
  }
}

// ── Persist indicators to system settings ────────────────────────────────────

export async function storeThreatIndicators(
  orgId: string,
  indicators: ThreatIndicator[],
): Promise<void> {
  try {
    const { systemSettings } = await import('@/lib/db/schema')
    const { eq } = await import('drizzle-orm')

    const settings = await db.select().from(systemSettings).limit(1)
    const row = settings[0]
    const existing = (row?.extraConfig as Record<string, unknown>) ?? {}

    // Store last 1000 indicators per org
    const trimmed = indicators.slice(0, 1000)
    const updated = { ...existing, [`ti_${orgId}`]: trimmed }

    if (row) {
      await db.update(systemSettings)
        .set({ extraConfig: updated, updatedAt: new Date() })
        .where(eq(systemSettings.id, row.id))
    } else {
      await db.insert(systemSettings).values({ extraConfig: updated })
    }
  } catch {
    // Non-critical
  }
}

// ── Get summary stats ─────────────────────────────────────────────────────────

export function getTiSummary(indicators: ThreatIndicator[]): {
  total: number
  byType: Record<ThreatIndicator['type'], number>
  bySeverity: Record<'high' | 'medium' | 'low', number>
  sources: string[]
} {
  const byType: Record<ThreatIndicator['type'], number> = {
    ip: 0,
    domain: 0,
    url: 0,
    file_hash: 0,
    email: 0,
  }
  const bySeverity: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 0, low: 0 }
  const sourceSet = new Set<string>()

  for (const ind of indicators) {
    byType[ind.type] = (byType[ind.type] ?? 0) + 1
    bySeverity[ind.severity] = (bySeverity[ind.severity] ?? 0) + 1
    sourceSet.add(ind.source)
  }

  return {
    total: indicators.length,
    byType,
    bySeverity,
    sources: Array.from(sourceSet),
  }
}
