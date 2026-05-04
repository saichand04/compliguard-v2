/**
 * app/api/integrations/sentinel/test/route.ts
 * POST — test Azure Sentinel connectivity.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { runSentinelChecks } from '@/lib/microsoft/sentinel'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  const body = await req.json() as {
    tenantId?: string
    clientId?: string
    clientSecret?: string
    subscriptionId?: string
    resourceGroup?: string
    workspaceName?: string
  }

  if (!body.tenantId || !body.clientId || !body.clientSecret || !body.subscriptionId || !body.resourceGroup || !body.workspaceName) {
    return ApiErrors.badRequest('All fields are required: tenantId, clientId, clientSecret, subscriptionId, resourceGroup, workspaceName')
  }

  try {
    const results = await runSentinelChecks({
      tenantId: body.tenantId,
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      subscriptionId: body.subscriptionId,
      resourceGroup: body.resourceGroup,
      workspaceName: body.workspaceName,
    })

    const incidents = results.find((r) => r.checkId === 'sentinel.incidents.open_critical')

    return NextResponse.json({
      ok: true,
      message: 'Connection successful',
      openCriticalIncidents: incidents?.count ?? 0,
      checksRun: results.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
