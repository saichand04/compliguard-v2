import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { runAndSaveNLTest } from '@/lib/integrations/nl-test-scheduler'
import { db } from '@/lib/db'
import { nlTestResults } from '@/lib/db/schema'
import { eq, and, gte, sql } from 'drizzle-orm'

type RouteContext = { params: Promise<{ id: string }> }

const DAILY_QUOTA = 200
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * POST /api/integrations/nl-tests/[id]/run
 * Execute a single NL test and save the result.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.MANAGE_INTEGRATIONS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await ctx.params

  // Per-org daily quota (shared with /run-all).
  const since = new Date(Date.now() - DAY_MS)
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(nlTestResults)
    .where(and(eq(nlTestResults.organizationId, session.orgId), gte(nlTestResults.ranAt, since)))
  const used = Number(rows[0]?.count ?? 0)
  if (used >= DAILY_QUOTA) {
    return NextResponse.json(
      { error: `Daily NL test quota of ${DAILY_QUOTA} runs exhausted. Try again in 24h.` },
      { status: 429 },
    )
  }

  try {
    const result = await runAndSaveNLTest(id, session.orgId)
    return NextResponse.json({ result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('not found')) return ApiErrors.notFound('NL Test')
    return ApiErrors.internal(message)
  }
}
