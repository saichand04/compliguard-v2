/**
 * app/api/integrations/defender/ingest-alerts/route.ts
 * POST — pull active high/critical Defender alerts and create findings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { findings } from '@/lib/db/schema'
import { runDefenderChecks } from '@/lib/microsoft/defender'
import { getDefenderConfig } from '@/app/api/integrations/defender/route'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  const config = await getDefenderConfig(session.orgId!)
  if (!config) {
    return ApiErrors.badRequest('Defender integration not configured.')
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
    const message = err instanceof Error ? err.message : 'Failed to fetch alerts'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }

  // Collect high/critical alerts and incidents
  const alertChecks = results.filter(
    (r) =>
      (r.checkId === 'defender.alerts.active_critical' || r.checkId === 'defender.alerts.active_high' || r.checkId === 'defender.xdr.active_incidents') &&
      r.status === 'fail' &&
      r.items &&
      r.items.length > 0,
  )

  const ingested: string[] = []

  for (const check of alertChecks) {
    for (const item of check.items ?? []) {
      const severity = item.severity?.toLowerCase()
      const mappedSeverity =
        severity === 'high' || severity === 'critical' ? 'critical' :
        severity === 'medium' ? 'high' :
        severity === 'low' ? 'medium' : 'high'

      const [inserted] = await db.insert(findings).values({
        organizationId: session.orgId!,
        title: `[Defender] ${item.title}`,
        description: item.description,
        severity: mappedSeverity as 'critical' | 'high' | 'medium' | 'low' | 'info',
        status: 'open',
        source: 'integration',
        resourceType: check.category === 'xdr_incidents' ? 'xdr_incident' : 'security_alert',
        resourceId: item.id,
        affectedAsset: item.resource,
        remediationGuidance: check.recommendation,
        rawData: {
          checkId: check.checkId,
          category: check.category,
          nistControls: check.nistControls,
          originalItem: item,
        },
      }).returning({ id: findings.id })

      ingested.push(inserted.id)
    }
  }

  await writeAuditLog({
    organizationId: session.orgId!,
    userId: session.userId,
    action: 'defender_alerts_ingested',
    resourceType: 'finding',
    description: `Ingested ${ingested.length} Defender alert(s) as findings`,
    after: { count: ingested.length },
    request: req,
  })

  return NextResponse.json({
    ok: true,
    ingested: ingested.length,
    findingIds: ingested,
  })
}
