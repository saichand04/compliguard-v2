/**
 * app/api/integrations/sentinel/scan/route.ts
 * POST — run full Sentinel scan and save results.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrationScanResults, integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { runSentinelChecks } from '@/lib/microsoft/sentinel'
import { getSentinelConfig } from '@/app/api/integrations/sentinel/route'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  const config = await getSentinelConfig(session.orgId!)
  if (!config) {
    return ApiErrors.badRequest('Sentinel integration not configured. Please save credentials first.')
  }

  let results
  try {
    results = await runSentinelChecks(config)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }

  const passed = results.filter((r) => r.status === 'pass').length
  const failed = results.filter((r) => r.status === 'fail').length
  const warned = results.filter((r) => r.status === 'warn').length

  // Find integration row
  const rows = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, session.orgId!),
        eq(integrations.type, 'azure'),
      ),
    )

  const sentinelRow = rows.find((r) => (r.config as Record<string, unknown>)?.subType === 'sentinel')

  if (sentinelRow) {
    await db.insert(integrationScanResults).values({
      integrationId: sentinelRow.id,
      organizationId: session.orgId!,
      scanType: 'sentinel',
      passed: String(passed),
      failed: String(failed),
      rawResults: results as unknown as Record<string, unknown>[],
      summary: {
        passed,
        failed,
        warned,
        total: results.length,
        categories: ['incidents', 'analytics_rules', 'watchlists', 'data_connectors', 'threat_intel'],
      },
    })

    await db.update(integrations).set({ lastSyncAt: new Date() }).where(eq(integrations.id, sentinelRow.id))
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
