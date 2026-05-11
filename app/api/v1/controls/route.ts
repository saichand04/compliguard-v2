import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { controls, controlAssignments, frameworks } from '@/lib/db/schema'
import { eq, and, or, sql, type SQL } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const controlStatus = z.enum(['not_started', 'in_progress', 'implemented', 'needs_review', 'not_applicable'])

export async function GET(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:controls')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData

  const { searchParams } = request.nextUrl
  const framework = searchParams.get('framework')
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const conditions: SQL[] = [eq(controlAssignments.organizationId, orgId)]
  if (framework) {
    conditions.push(or(eq(frameworks.shortName, framework), eq(frameworks.name, framework))!)
  }
  if (status && controlStatus.safeParse(status).success) {
    conditions.push(eq(controlAssignments.status, status as z.infer<typeof controlStatus>))
  }

  try {
    const whereClause = and(...conditions)
    const [rows, totalRow] = await Promise.all([
      db
        .select({
          control: controls,
          assignment: controlAssignments,
          frameworkName: frameworks.name,
          frameworkShortName: frameworks.shortName,
        })
        .from(controlAssignments)
        .innerJoin(controls, eq(controls.id, controlAssignments.controlId))
        .innerJoin(frameworks, eq(frameworks.id, controls.frameworkId))
        .where(whereClause)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(controlAssignments)
        .innerJoin(controls, eq(controls.id, controlAssignments.controlId))
        .innerJoin(frameworks, eq(frameworks.id, controls.frameworkId))
        .where(whereClause),
    ])
    const total = Number(totalRow[0]?.count ?? 0)

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        ...r.control,
        assignment: r.assignment,
        framework: { name: r.frameworkName, shortName: r.frameworkShortName },
      })),
      meta: {
        total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        hasMore: offset + limit < total,
      },
    })
  } catch (err) {
    logger.error({ err }, 'v1.controls.list failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
