import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { eq, and, gte, lte, like, desc, sql, type SQL } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

/**
 * GET /api/audit-logs?userId=&action=&resourceType=&from=&to=&page=&limit=
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_AUDIT_LOGS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10)), 100)
  const offset = (page - 1) * limit

  const userId = searchParams.get('userId')
  const action = searchParams.get('action')
  const resourceType = searchParams.get('resourceType')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  // Push filters into SQL — no more over-fetch + JS filtering.
  const conditions: SQL[] = [eq(auditLogs.organizationId, session.orgId)]
  if (userId && uuidSchema.safeParse(userId).success) {
    conditions.push(eq(auditLogs.userId, userId))
  }
  if (action) {
    conditions.push(like(auditLogs.action, `%${action}%`))
  }
  if (resourceType) {
    conditions.push(eq(auditLogs.resourceType, resourceType))
  }
  if (from) {
    const fromDate = new Date(from)
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push(gte(auditLogs.createdAt, fromDate))
    }
  }
  if (to) {
    const toDate = new Date(to)
    if (!Number.isNaN(toDate.getTime())) {
      conditions.push(lte(auditLogs.createdAt, toDate))
    }
  }

  try {
    const whereClause = and(...conditions)
    const [records, totalRow] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(whereClause),
    ])
    const total = Number(totalRow[0]?.count ?? 0)

    return NextResponse.json({
      logs: records,
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    })
  } catch (err) {
    logger.error({ err }, 'audit-logs.list failed')
    return ApiErrors.internal()
  }
}
