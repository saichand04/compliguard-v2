import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { vendors } from '@/lib/db/schema'
import { eq, and, desc, sql, type SQL } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const vendorStatus = z.enum(['active', 'inactive', 'under_review', 'terminated'])
const riskLevel = z.enum(['low', 'medium', 'high', 'critical'])

export async function GET(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:vendors')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const riskLevelParam = searchParams.get('riskLevel')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const conditions: SQL[] = [eq(vendors.organizationId, orgId)]
  if (status && vendorStatus.safeParse(status).success) {
    conditions.push(eq(vendors.status, status as z.infer<typeof vendorStatus>))
  }
  if (riskLevelParam && riskLevel.safeParse(riskLevelParam).success) {
    conditions.push(eq(vendors.inherentRiskLevel, riskLevelParam as z.infer<typeof riskLevel>))
  }

  try {
    const whereClause = and(...conditions)
    const [rows, totalRow] = await Promise.all([
      db
        .select()
        .from(vendors)
        .where(whereClause)
        .orderBy(desc(vendors.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(vendors)
        .where(whereClause),
    ])
    const total = Number(totalRow[0]?.count ?? 0)
    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        hasMore: offset + limit < total,
      },
    })
  } catch (err) {
    logger.error({ err }, 'v1.vendors.list failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
