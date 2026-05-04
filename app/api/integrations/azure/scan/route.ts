import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations, integrationScanResults, findings } from '@/lib/db/schema'
import { decrypt } from '@/lib/encryption'
import { runAzureChecks, AzureConfig } from '@/lib/integrations/azure'
import { IntegrationCheckResult } from '@/lib/integrations/base'
import { eq, and } from 'drizzle-orm'

// POST /api/integrations/azure/scan — Run Azure compliance checks
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const orgId: string = session.orgId

  try {
    const rows = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.organizationId, orgId),
          eq(integrations.type, 'azure'),
        ),
      )
      .limit(1)

    const integration = rows[0]
    if (!integration) return ApiErrors.notFound('Azure integration')
    if (!integration.encryptedCredentials) {
      return ApiErrors.badRequest('Azure integration has no credentials configured')
    }

    // Decrypt credentials
    let config: AzureConfig
    try {
      const raw = decrypt(integration.encryptedCredentials)
      config = JSON.parse(raw) as AzureConfig
    } catch (e) {
      return ApiErrors.internal(`Failed to decrypt Azure credentials: ${String(e)}`)
    }

    // Update integration status to active/syncing
    await db
      .update(integrations)
      .set({ status: 'active', errorMessage: null, updatedAt: new Date() })
      .where(eq(integrations.id, integration.id))

    // Run checks
    let results: IntegrationCheckResult[]
    try {
      results = await runAzureChecks(config)
    } catch (e) {
      await db
        .update(integrations)
        .set({ status: 'error', errorMessage: String(e), updatedAt: new Date() })
        .where(eq(integrations.id, integration.id))
      return ApiErrors.internal(`Azure scan failed: ${String(e)}`)
    }

    const passed = results.filter((r) => r.status === 'pass').length
    const failed = results.filter((r) => r.status === 'fail').length
    const warned = results.filter((r) => r.status === 'warn').length
    const skipped = results.filter((r) => r.status === 'skip').length

    // Save scan result
    await db.insert(integrationScanResults).values({
      integrationId: integration.id,
      organizationId: orgId,
      scanType: 'full',
      rawResults: results as unknown as Record<string, unknown>[],
      summary: { passed, failed, warned, skipped, total: results.length } as Record<string, unknown>,
    })

    // Create findings for failed/warned checks
    const failedResults = results.filter((r) => r.status === 'fail' || r.status === 'warn')
    for (const result of failedResults) {
      const severity = result.severity === 'info' ? 'low' : result.severity
      await db.insert(findings).values({
        organizationId: orgId,
        title: result.title,
        description: result.description,
        severity: severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
        status: 'open',
        source: 'azure',
        affectedAsset: result.resource ?? null,
        remediationGuidance: result.remediation ?? null,
        rawData: (result.rawData ?? null) as Record<string, unknown> | null | undefined,
      })
    }

    // Update lastSyncAt
    await db
      .update(integrations)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(integrations.id, integration.id))

    return NextResponse.json({
      success: true,
      summary: { passed, failed, warned, skipped, total: results.length },
      results,
    })
  } catch (e) {
    console.error('POST /api/integrations/azure/scan error:', e)
    return ApiErrors.internal()
  }
}
