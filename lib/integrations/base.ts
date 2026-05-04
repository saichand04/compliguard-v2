/**
 * lib/integrations/base.ts
 * Shared types and persistence logic for all integration scanners.
 */

import { db } from '@/lib/db'
import { integrations, integrationScanResults, findings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// ── Core types ────────────────────────────────────────────────────────────────

export interface IntegrationCheckResult {
  /** e.g. 'iam.mfa_enabled' */
  checkId: string
  title: string
  description: string
  status: 'pass' | 'fail' | 'warn' | 'skip'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  /** affected resource identifier */
  resource?: string
  /** how to fix */
  remediation?: string
  /** exportable description of what was checked */
  evidence?: string
  rawData?: unknown
}

export interface IntegrationScanSummary {
  integrationId: string
  integrationName: string
  scanType: string
  totalChecks: number
  passed: number
  failed: number
  warned: number
  skipped: number
  results: IntegrationCheckResult[]
  scannedAt: Date
}

// ── Source mapping ────────────────────────────────────────────────────────────

type FindingSource = 'aws' | 'azure' | 'gcp' | 'github' | 'pentest' | 'manual' | 'nl_test' | 'integration'

function getSourceFromType(type: string): FindingSource {
  const typeMap: Record<string, FindingSource> = {
    aws: 'aws',
    azure: 'azure',
    gcp: 'gcp',
    github: 'github',
  }
  return typeMap[type] ?? 'integration'
}

// ── Persist scan results ──────────────────────────────────────────────────────

/**
 * After a scan: persist results and create findings for failures.
 *
 * - Inserts into integrationScanResults
 * - For each failed check: inserts a finding with status='open'
 * - Updates integration lastSyncAt
 */
export async function persistScanResults(
  orgId: string,
  summary: IntegrationScanSummary,
): Promise<void> {
  // Look up the integration to get its type for source mapping
  const [integration] = await db
    .select({ type: integrations.type })
    .from(integrations)
    .where(eq(integrations.id, summary.integrationId))
    .limit(1)

  const source: FindingSource = integration
    ? getSourceFromType(integration.type)
    : 'integration'

  // 1. Insert scan result record
  // Note: totalChecks column type is uuid in the schema — store as null and keep count in summary jsonb
  await db.insert(integrationScanResults).values({
    integrationId: summary.integrationId,
    organizationId: orgId,
    scanType: summary.scanType,
    totalChecks: null,
    passed: String(summary.passed),
    failed: String(summary.failed),
    rawResults: summary.results as unknown as Record<string, unknown>[],
    summary: {
      integrationId: summary.integrationId,
      integrationName: summary.integrationName,
      scanType: summary.scanType,
      totalChecks: summary.totalChecks,
      passed: summary.passed,
      failed: summary.failed,
      warned: summary.warned,
      skipped: summary.skipped,
      scannedAt: summary.scannedAt.toISOString(),
    } as unknown as Record<string, unknown>,
    scannedAt: summary.scannedAt,
  })

  // 2. Create findings for failed checks
  const failedResults = summary.results.filter((r) => r.status === 'fail')

  if (failedResults.length > 0) {
    const findingValues = failedResults.map((result) => ({
      organizationId: orgId,
      title: result.title,
      description: result.resource
        ? `${result.description}\n\nResource: ${result.resource}`
        : result.description,
      severity: result.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
      status: 'open' as const,
      source,
      affectedAsset: result.resource ?? null,
      remediationGuidance: result.remediation ?? null,
      rawData: (result.rawData ?? null) as Record<string, unknown> | null,
      metadata: {
        checkId: result.checkId,
        evidence: result.evidence,
        integrationId: summary.integrationId,
        integrationName: summary.integrationName,
        scannedAt: summary.scannedAt.toISOString(),
      } as unknown as Record<string, unknown>,
    }))

    await db.insert(findings).values(findingValues)
  }

  // 3. Update integration lastSyncAt and status
  await db
    .update(integrations)
    .set({
      lastSyncAt: summary.scannedAt,
      status: 'active',
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, summary.integrationId))
}
