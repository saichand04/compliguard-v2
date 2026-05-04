/**
 * app/api/integrations/sentinel/watchlists/route.ts
 * GET — list Sentinel watchlists (for context hub use).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { runSentinelChecks } from '@/lib/microsoft/sentinel'
import { getSentinelConfig } from '@/app/api/integrations/sentinel/route'

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const config = await getSentinelConfig(session.orgId!)
  if (!config) {
    return NextResponse.json({ connected: false, watchlists: [] })
  }

  try {
    const results = await runSentinelChecks(config)
    const watchlistCheck = results.find((r) => r.checkId === 'sentinel.watchlists.count')

    return NextResponse.json({
      connected: true,
      watchlists: watchlistCheck?.items ?? [],
      count: watchlistCheck?.count ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch watchlists'
    return NextResponse.json({ connected: true, error: message, watchlists: [] }, { status: 500 })
  }
}
