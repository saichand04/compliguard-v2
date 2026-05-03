import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'

/**
 * GET /api/audit-logs?userId=&action=&resourceType=&from=&to=&page=&limit=
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_AUDIT_LOGS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { searchParams } = req.nextUrl
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = (page - 1) * limit

  const userId = searchParams.get('userId')
  const action = searchParams.get('action')
  const resourceType = searchParams.get('resourceType')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const records = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, session.orgId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit + 50) // Over-fetch for client-side filtering

  const filtered = records.filter((r) => {
    if (userId && r.userId !== userId) return false
    if (action && !r.action.includes(action)) return false
    if (resourceType && r.resourceType !== resourceType) return false
    if (from && new Date(r.createdAt) < new Date(from)) return false
    if (to && new Date(r.createdAt) > new Date(to)) return false
    return true
  })

  const paginated = filtered.slice(offset, offset + limit)

  return NextResponse.json({
    logs: paginated,
    total: filtered.length,
    page,
    limit,
    hasMore: offset + limit < filtered.length,
  })
}
