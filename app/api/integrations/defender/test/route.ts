/**
 * app/api/integrations/defender/test/route.ts
 * POST — test Defender for Cloud connectivity.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { runDefenderChecks } from '@/lib/microsoft/defender'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  const body = await req.json() as {
    tenantId?: string
    clientId?: string
    clientSecret?: string
    subscriptionId?: string
  }

  if (!body.tenantId || !body.clientId || !body.clientSecret || !body.subscriptionId) {
    return ApiErrors.badRequest('tenantId, clientId, clientSecret, and subscriptionId are required')
  }

  try {
    // Run a minimal check (just secure score) to verify connectivity
    const results = await runDefenderChecks(
      body.tenantId,
      body.clientId,
      body.clientSecret,
      body.subscriptionId,
    )

    const secureScore = results.find((r) => r.checkId === 'defender.secure_score.overall')

    return NextResponse.json({
      ok: true,
      message: 'Connection successful',
      secureScore: secureScore?.score ?? null,
      checksRun: results.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
