import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations, integrationScanResults, findings } from '@/lib/db/schema'
import { decrypt } from '@/lib/encryption'
import { runIntuneChecks } from '@/lib/microsoft/intune'
import { eq, and } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const orgId = session.orgId

  try {
    const stored = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.organizationId, orgId),
          eq(integrations.type, 'azure')
        )
      )
      .limit(1)

    let tenantId: string
    let clientId: string
    let clientSecret: string
    const integration = stored[0]

    if (integration?.encryptedCredentials) {
      const creds = JSON.parse(decrypt(integration.encryptedCredentials)) as {
        tenantId: string
        clientId: string
        clientSecret: string
      }
      tenantId = creds.tenantId
      clientId = creds.clientId
      clientSecret = creds.clientSecret
    } else {
      const body = (await req.json().catch(() => ({}))) as {
        tenantId?: string
        clientId?: string
        clientSecret?: string
      }
      if (!body.tenantId || !body.clientId || !body.clientSecret) {
        return ApiErrors.badRequest('No stored credentials and no inline credentials provided')
      }
      tenantId = body.tenantId
      clientId = body.clientId
      clientSecret = body.clientSecret
    }

    const checkResults = await runIntuneChecks(tenantId, clientId, clientSecret)

    const passed = checkResults.filter((r) => r.status === 'pass').length
    const failed = checkResults.filter((r) => r.status === 'fail').length
    const warned = checkResults.filter((r) => r.status === 'warn').length

    const FALLBACK_ID = '00000000-0000-0000-0000-000000000000'
    const integrationId = integration?.id ?? FALLBACK_ID

    const [scanResult] = await db
      .insert(integrationScanResults)
      .values({
        integrationId,
        organizationId: orgId,
        scanType: 'intune',
        passed: String(passed),
        failed: String(failed),
        rawResults: checkResults as unknown as Record<string, unknown>[],
        summary: { passed, failed, warned, total: checkResults.length } as unknown as Record<string, unknown>,
      })
      .returning()

    // Create findings for critical/high failures
    const criticalFails = checkResults.filter(
      (r) => r.status === 'fail' && (r.severity === 'critical' || r.severity === 'high')
    )
    if (criticalFails.length > 0) {
      await db.insert(findings).values(
        criticalFails.map((r) => ({
          organizationId: orgId,
          title: `[Intune] ${r.title}`,
          description: `Check ${r.checkId} failed. ${r.recommendation}`,
          severity: r.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
          status: 'open' as const,
          source: 'azure' as const,
          remediationGuidance: r.recommendation,
          rawData: r as unknown as Record<string, unknown>,
          metadata: {
            checkId: r.checkId,
            category: r.category,
            nistControls: r.nistControls,
            complianceRate: r.complianceRate,
            affectedCount: r.nonCompliantCount,
          } as unknown as Record<string, unknown>,
        }))
      )
    }

    if (integration?.id) {
      await db
        .update(integrations)
        .set({ status: 'active', lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(integrations.id, integration.id))
    }

    return NextResponse.json({
      success: true,
      scanId: scanResult?.id,
      summary: { passed, failed, warned, total: checkResults.length },
      results: checkResults,
    })
  } catch (err) {
    console.error('[intune/scan/POST]', err)
    const msg = err instanceof Error ? err.message : 'Scan failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
