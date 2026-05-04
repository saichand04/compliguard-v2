/**
 * Azure-Native Compliance Scanning Orchestrator
 * Runs all Microsoft/Azure compliance checks in parallel and produces
 * a unified compliance report with AI-generated remediation summary.
 */

import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { integrations, integrationScanResults, findings, systemSettings } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { decrypt } from '@/lib/encryption'
import { runEntraChecks, type EntraCheckResult } from './entra'
import { runDefenderChecks, type DefenderCheckResult } from './defender'
import { runPurviewChecks, type PurviewCheckResult } from './purview'
import { getComplianceManagerScore, type ComplianceManagerScore } from './compliance-manager'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AzureComplianceScanResult {
  orgId: string
  scanId: string
  startedAt: Date
  completedAt?: Date
  status: 'running' | 'completed' | 'failed'
  sources: {
    entra?: { checked: number; passed: number; failed: number }
    intune?: { checked: number; passed: number; failed: number }
    defender?: { checked: number; passed: number; failed: number }
    sentinel?: { checked: number; passed: number; failed: number }
    purview?: { checked: number; passed: number; failed: number }
    complianceManager?: { score: number; maxScore: number }
  }
  totalFindings: number
  criticalFindings: number
  allResults: Array<{ source: string; results: unknown[] }>
  aiRemediationSummary?: string
}

interface AzureIntegrationConfig {
  tenantId?: string
  clientId?: string
  clientSecret?: string
  subscriptionId?: string
}

interface CheckResult {
  status: 'pass' | 'fail' | 'warn' | 'info'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  checkId: string
  title: string
  recommendation: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getAzureConfig(orgId: string): Promise<AzureIntegrationConfig | null> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, 'azure'),
      )
    )
    .limit(1)

  if (!row) return null

  const result: AzureIntegrationConfig = {}

  if (row.config && typeof row.config === 'object') {
    const cfg = row.config as Record<string, unknown>
    if (typeof cfg.tenantId === 'string') result.tenantId = cfg.tenantId
    if (typeof cfg.subscriptionId === 'string') result.subscriptionId = cfg.subscriptionId
  }

  if (row.encryptedCredentials) {
    try {
      const decrypted = decrypt(row.encryptedCredentials)
      const parsed = JSON.parse(decrypted) as Record<string, unknown>
      if (typeof parsed.clientId === 'string') result.clientId = parsed.clientId
      if (typeof parsed.clientSecret === 'string') result.clientSecret = parsed.clientSecret
      if (typeof parsed.tenantId === 'string') result.tenantId = parsed.tenantId
    } catch {
      // ignore
    }
  }

  return result
}

function summarize(results: CheckResult[]): { checked: number; passed: number; failed: number } {
  const checked = results.length
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  return { checked, passed, failed }
}

function countCritical(results: CheckResult[]): number {
  return results.filter(r => r.status === 'fail' && r.severity === 'critical').length
}

// ─── AI Remediation Summary ───────────────────────────────────────────────────

async function generateRemediationSummary(
  scanResult: AzureComplianceScanResult
): Promise<string> {
  try {
    // Get AI config from system settings
    const [settings] = await db.select().from(systemSettings).limit(1)
    const aiProvider = settings?.aiProvider ?? 'openai'
    const aiModel = settings?.aiModel ?? 'gpt-4o-mini'

    // Build top failed checks
    const topFailed: string[] = []
    for (const sourceGroup of scanResult.allResults) {
      const failed = (sourceGroup.results as CheckResult[])
        .filter(r => r.status === 'fail' && (r.severity === 'critical' || r.severity === 'high'))
        .slice(0, 3)
        .map(r => `[${r.severity.toUpperCase()}] ${r.title}: ${r.recommendation}`)
      topFailed.push(...failed)
    }

    const prompt = `You are a Microsoft cloud security expert. Here are the results of a comprehensive Azure compliance scan:

- Total checks: ${Object.values(scanResult.sources).reduce((s, v) => s + (v && 'checked' in v ? (v as { checked: number }).checked : 0), 0)}
- Critical findings: ${scanResult.criticalFindings}
- Total failed checks: ${scanResult.totalFindings}

Top critical/high issues:
${topFailed.slice(0, 5).join('\n')}

Generate a concise executive summary (3-5 bullet points) highlighting the most critical issues and recommended remediation priorities. Be specific and actionable.`

    if (aiProvider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return buildFallbackSummary(scanResult, topFailed)

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: aiModel || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 600,
          temperature: 0.3,
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }
        return data.choices?.[0]?.message?.content ?? buildFallbackSummary(scanResult, topFailed)
      }
    }

    if (aiProvider === 'anthropic') {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return buildFallbackSummary(scanResult, topFailed)

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: aiModel || 'claude-3-haiku-20240307',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as {
          content?: Array<{ type: string; text?: string }>
        }
        const text = data.content?.find(c => c.type === 'text')?.text
        return text ?? buildFallbackSummary(scanResult, topFailed)
      }
    }

    return buildFallbackSummary(scanResult, topFailed)
  } catch {
    return buildFallbackSummary(scanResult, { length: 0 } as unknown as string[])
  }
}

function buildFallbackSummary(
  scanResult: AzureComplianceScanResult,
  topFailed: string[]
): string {
  const bullets: string[] = [
    `• Scan completed across ${Object.keys(scanResult.sources).length} Azure security sources with ${scanResult.totalFindings} total findings.`,
    `• ${scanResult.criticalFindings} critical findings require immediate attention.`,
  ]

  if (Array.isArray(topFailed) && topFailed.length > 0) {
    bullets.push(`• Priority: ${topFailed[0]}`)
    if (topFailed.length > 1) bullets.push(`• Also review: ${topFailed[1]}`)
  }

  bullets.push('• Schedule remediation for all critical and high findings within 30 days.')

  return bullets.join('\n')
}

// ─── Persist findings ─────────────────────────────────────────────────────────

async function persistFindings(
  orgId: string,
  source: string,
  results: CheckResult[]
): Promise<void> {
  const failed = results.filter(r => r.status === 'fail' && r.severity !== 'info')

  for (const result of failed) {
    try {
      await db.insert(findings).values({
        organizationId: orgId,
        title: result.title,
        description: result.recommendation,
        severity: result.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
        status: 'open',
        source: 'azure',
        resourceType: source,
        resourceId: result.checkId,
        remediationGuidance: result.recommendation,
        metadata: {
          checkId: result.checkId,
          source,
          detectedBy: 'azure_compliance_scanner',
        } as Record<string, unknown>,
      })
    } catch {
      // Skip duplicate findings
    }
  }
}

// ─── Main scan orchestrator ───────────────────────────────────────────────────

export async function runAzureComplianceScan(orgId: string): Promise<AzureComplianceScanResult> {
  const scanId = randomUUID()
  const startedAt = new Date()

  const result: AzureComplianceScanResult = {
    orgId,
    scanId,
    startedAt,
    status: 'running',
    sources: {},
    totalFindings: 0,
    criticalFindings: 0,
    allResults: [],
  }

  try {
    const config = await getAzureConfig(orgId)

    if (!config?.tenantId || !config?.clientId || !config?.clientSecret) {
      result.status = 'failed'
      result.completedAt = new Date()
      result.aiRemediationSummary = 'Azure integration not configured. Please add Azure credentials in the integrations settings.'
      return result
    }

    const { tenantId, clientId, clientSecret } = config

    // Run all checks in parallel
    const [entraRes, defenderRes, purviewRes, complianceManagerRes] = await Promise.allSettled([
      runEntraChecks(tenantId, clientId, clientSecret),
      runDefenderChecks(tenantId, clientId, clientSecret, config.subscriptionId ?? ''),
      runPurviewChecks(tenantId, clientId, clientSecret),
      getComplianceManagerScore(tenantId, clientId, clientSecret),
    ])

    // Entra
    if (entraRes.status === 'fulfilled') {
      const entraResults = entraRes.value as EntraCheckResult[]
      result.sources.entra = summarize(entraResults as unknown as CheckResult[])
      result.allResults.push({ source: 'entra', results: entraResults })
      await persistFindings(orgId, 'entra', entraResults as unknown as CheckResult[])
    }

    // Defender
    if (defenderRes.status === 'fulfilled') {
      const defenderResults = defenderRes.value as DefenderCheckResult[]
      result.sources.defender = summarize(defenderResults as unknown as CheckResult[])
      result.allResults.push({ source: 'defender', results: defenderResults })
      await persistFindings(orgId, 'defender', defenderResults as unknown as CheckResult[])
    }

    // Purview
    if (purviewRes.status === 'fulfilled') {
      const purviewResults = purviewRes.value as PurviewCheckResult[]
      result.sources.purview = summarize(purviewResults as unknown as CheckResult[])
      result.allResults.push({ source: 'purview', results: purviewResults })
      await persistFindings(orgId, 'purview', purviewResults as unknown as CheckResult[])
    }

    // Compliance Manager
    if (complianceManagerRes.status === 'fulfilled') {
      const cmScore = complianceManagerRes.value as ComplianceManagerScore
      result.sources.complianceManager = {
        score: cmScore.currentScore,
        maxScore: cmScore.maxScore,
      }
      result.allResults.push({ source: 'complianceManager', results: [cmScore] })
    }

    // Aggregate totals
    let totalFailed = 0
    let totalCritical = 0
    for (const sourceGroup of result.allResults) {
      const checkResults = sourceGroup.results as CheckResult[]
      if (!Array.isArray(checkResults)) continue
      totalFailed += checkResults.filter(r => r.status === 'fail').length
      totalCritical += checkResults.filter(r => r.status === 'fail' && r.severity === 'critical').length
    }
    result.totalFindings = totalFailed
    result.criticalFindings = totalCritical
    result.status = 'completed'
    result.completedAt = new Date()

    // Generate AI summary
    result.aiRemediationSummary = await generateRemediationSummary(result)

    // Store in integrationScanResults
    const [integration] = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.organizationId, orgId),
          eq(integrations.type, 'azure')
        )
      )
      .limit(1)

    if (integration) {
      await db.insert(integrationScanResults).values({
        integrationId: integration.id,
        organizationId: orgId,
        scanType: 'azure_compliance_full',
        rawResults: result as unknown as Record<string, unknown>,
        summary: {
          scanId,
          status: result.status,
          totalFindings: result.totalFindings,
          criticalFindings: result.criticalFindings,
          sources: Object.keys(result.sources),
          aiSummary: result.aiRemediationSummary,
        } as Record<string, unknown>,
      })

      // Update last sync timestamp
      await db
        .update(integrations)
        .set({ lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(integrations.id, integration.id))
    }

    return result
  } catch (err) {
    result.status = 'failed'
    result.completedAt = new Date()
    result.aiRemediationSummary = `Scan failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    return result
  }
}

// ─── Get scan history ─────────────────────────────────────────────────────────

export async function getScanHistory(
  orgId: string,
  limit = 10
): Promise<typeof integrationScanResults.$inferSelect[]> {
  const [integration] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, 'azure')
      )
    )
    .limit(1)

  if (!integration) return []

  return db
    .select()
    .from(integrationScanResults)
    .where(eq(integrationScanResults.integrationId, integration.id))
    .orderBy(desc(integrationScanResults.scannedAt))
    .limit(limit)
}
