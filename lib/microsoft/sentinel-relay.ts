/**
 * lib/microsoft/sentinel-relay.ts
 * Polling-based relay for Sentinel incidents and Defender alerts.
 * Polls on a cadence and tracks last poll time in system_settings.extraConfig.
 */

import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { SentinelConfig, SentinelIncident } from '@/lib/microsoft/sentinel'

const TOKEN_ENDPOINT = 'https://login.microsoftonline.com'
const ARM_BASE = 'https://management.azure.com'

// ── Defender Alert type ───────────────────────────────────────────────────────

export interface DefenderAlert {
  id: string
  title: string
  severity: string
  status: string
  category: string
  detectionSource?: string
  mitreTechniques?: string[]
  createdDateTime?: string
  lastUpdateDateTime?: string
  description?: string
  resourceId?: string
}

// ── Poll result types ─────────────────────────────────────────────────────────

export interface SentinelPollResult {
  newIncidents: SentinelIncident[]
  updatedIncidents: SentinelIncident[]
  lastPollTime: string
}

export interface DefenderPollResult {
  newAlerts: DefenderAlert[]
  lastPollTime: string
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

// ── Last poll time helpers ────────────────────────────────────────────────────

const SENTINEL_POLL_KEY = 'sentinelLastPollTime'
const DEFENDER_POLL_KEY = 'defenderLastPollTime'

async function getLastPollTime(key: string): Promise<Date> {
  try {
    const settings = await db.select().from(systemSettings).limit(1)
    const row = settings[0]
    if (row?.extraConfig && typeof row.extraConfig === 'object') {
      const cfg = row.extraConfig as Record<string, unknown>
      const ts = cfg[key]
      if (typeof ts === 'string') return new Date(ts)
    }
  } catch {
    // Fallback: 1 hour ago
  }
  return new Date(Date.now() - 60 * 60 * 1000)
}

async function setLastPollTime(key: string, time: Date): Promise<void> {
  try {
    const settings = await db.select().from(systemSettings).limit(1)
    const row = settings[0]
    const existing = (row?.extraConfig as Record<string, unknown>) ?? {}
    const updated = { ...existing, [key]: time.toISOString() }

    if (row) {
      await db.update(systemSettings)
        .set({ extraConfig: updated, updatedAt: new Date() })
        .where(eq(systemSettings.id, row.id))
    } else {
      await db.insert(systemSettings).values({ extraConfig: updated })
    }
  } catch {
    // Non-critical; continue
  }
}

// ── Poll Sentinel incidents ───────────────────────────────────────────────────

export async function pollSentinelIncidents(
  config: SentinelConfig,
  orgId: string,
): Promise<SentinelPollResult> {
  const lastPollKey = `${SENTINEL_POLL_KEY}_${orgId}`
  const lastPollTime = await getLastPollTime(lastPollKey)
  const now = new Date()

  let newIncidents: SentinelIncident[] = []
  let updatedIncidents: SentinelIncident[] = []

  try {
    const token = await getARMToken(config.tenantId, config.clientId, config.clientSecret)
    const base = sentinelBase(config)

    // Fetch incidents modified since last poll
    const lastPollIso = lastPollTime.toISOString()
    const filter = encodeURIComponent(
      `properties/lastModifiedTimeUtc gt ${lastPollIso}`,
    )
    const resp = await armGet<{ value: SentinelIncident[] }>(
      token,
      `${base}/incidents?api-version=2023-02-01&$top=100&$filter=${filter}&$orderby=properties/lastModifiedTimeUtc desc`,
    )

    const incidents = resp.value ?? []

    for (const incident of incidents) {
      const createdAt = incident.properties?.createdTimeUtc
        ? new Date(incident.properties.createdTimeUtc)
        : null
      if (createdAt && createdAt > lastPollTime) {
        newIncidents.push(incident)
      } else {
        updatedIncidents.push(incident)
      }
    }
  } catch {
    // Return empty results on error; do not crash the SSE stream
  }

  await setLastPollTime(lastPollKey, now)

  return {
    newIncidents,
    updatedIncidents,
    lastPollTime: now.toISOString(),
  }
}

// ── Poll Defender high/critical alerts ───────────────────────────────────────

export async function pollDefenderAlerts(
  config: SentinelConfig,
  orgId: string,
): Promise<DefenderPollResult> {
  const lastPollKey = `${DEFENDER_POLL_KEY}_${orgId}`
  const lastPollTime = await getLastPollTime(lastPollKey)
  const now = new Date()

  let newAlerts: DefenderAlert[] = []

  try {
    const token = await getARMToken(config.tenantId, config.clientId, config.clientSecret)

    // Microsoft 365 Defender alerts via Security API
    const alertsUrl =
      `${ARM_BASE}/subscriptions/${config.subscriptionId}` +
      `/providers/Microsoft.Security/alerts?api-version=2022-01-01` +
      `&$filter=properties/timeGeneratedUtc gt ${lastPollTime.toISOString()}` +
      ` and (properties/severity eq 'High' or properties/severity eq 'Critical')`

    const resp = await armGet<{
      value: Array<{
        id: string
        name: string
        properties?: {
          alertDisplayName?: string
          severity?: string
          status?: string
          alertType?: string
          intent?: string
          timeGeneratedUtc?: string
          description?: string
          alertUri?: string
          resourceIdentifiers?: Array<{ id?: string }>
        }
      }>
    }>(token, alertsUrl)

    newAlerts = (resp.value ?? []).map((a) => ({
      id: a.name,
      title: a.properties?.alertDisplayName ?? a.name,
      severity: a.properties?.severity ?? 'Medium',
      status: a.properties?.status ?? 'Active',
      category: a.properties?.intent ?? 'Unknown',
      detectionSource: a.properties?.alertType,
      createdDateTime: a.properties?.timeGeneratedUtc,
      description: a.properties?.description,
      resourceId: a.properties?.resourceIdentifiers?.[0]?.id,
    }))
  } catch {
    // Return empty; non-critical
  }

  await setLastPollTime(lastPollKey, now)

  return {
    newAlerts,
    lastPollTime: now.toISOString(),
  }
}
