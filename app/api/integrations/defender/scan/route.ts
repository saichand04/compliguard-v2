/**
 * app/api/integrations/defender/scan/route.ts
 * POST — run full Defender for Cloud scan and save results.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrationScanResults, integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { runDefenderChecks } from '@/lib/microsoft/defender'
import { getDefenderConfig } from '@/app/api/integrations/defender/route'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  const config = await getDefenderConfig(session.orgId!)
  if (!config) {
    return ApiErrors.badRequest('Defender integration not configured. Please save credentials first.')
  }

  let results
  try {
    results = await runDefenderChecks(
      config.tenantId,
      config.clientId,
      config.clientSecret,
      config.subscriptionId,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }

  const passed = results.filter((r) => r.status === 'pass').length
  const failed = results.filter((r) => r.status === 'fail').length
  const warned = results.filter((r) => r.status === 'warn').length

  // Find integration row
  const rows = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, session.orgId!),
        eq(integrations.type, 'azure'),
      ),
    )

  const integrationRow = rows.find(async (r) => {
    const full = await db.select().from(integrations).where(eq(integrations.id, r.id)).limit(1)
    return (full[0]?.config as Record<string, unknown>)?.subType === 'defender'
  })

  if (integrationRow) {
    // Save scan result
    await db.insert(integrationScanResults).values({
      integrationId: integrationRow.id,
      organizationId: session.orgId!,
      scanType: 'defender',
      passed: String(passed),
      failed: String(failed),
      rawResults: results as unknown as Record<string, unknown>[],
      summary: {
        passed,
        failed,
        warned,
        total: results.length,
        categories: ['secure_score', 'recommendations', 'alerts', 'xdr_incidents', 'coverage'],
      },
    })

    // Update lastSyncAt
    await db.update(integrations).set({ lastSyncAt: new Date() }).where(eq(integrations.id, integrationRow.id))
  }

  return NextResponse.json({
    ok: true,
    total: results.length,
    passed,
    failed,
    warned,
    results,
  })
}
