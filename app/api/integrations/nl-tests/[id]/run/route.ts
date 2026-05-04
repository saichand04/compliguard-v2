import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { runAndSaveNLTest } from '@/lib/integrations/nl-test-scheduler'

type RouteContext = { params: Promise<{ id: string }> }

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

  try {
    const result = await runAndSaveNLTest(id, session.orgId)
    return NextResponse.json({ result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('not found')) return ApiErrors.notFound('NL Test')
    return ApiErrors.internal(message)
  }
}
