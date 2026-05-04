import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { nlTests, nlTestResults } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/integrations/nl-tests/[id]/results
 * Get last 20 results for a test.
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_INTEGRATIONS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await ctx.params

  // Verify the test belongs to this org
  const [test] = await db
    .select({ id: nlTests.id })
    .from(nlTests)
    .where(and(eq(nlTests.id, id), eq(nlTests.organizationId, session.orgId)))
    .limit(1)

  if (!test) return ApiErrors.notFound('NL Test')

  const results = await db
    .select()
    .from(nlTestResults)
    .where(eq(nlTestResults.testId, id))
    .orderBy(desc(nlTestResults.ranAt))
    .limit(20)

  return NextResponse.json({ results, total: results.length })
}
