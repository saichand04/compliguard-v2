import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evidence, controlAssignments } from '@/lib/db/schema'
import { eq, and, desc, sql, type SQL } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const evidenceType = z.enum(['screenshot', 'document', 'log', 'automated', 'text', 'video', 'configuration'])
const evidenceStatus = z.enum(['pending', 'approved', 'rejected', 'expired'])

export async function GET(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:evidence')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const conditions: SQL[] = [eq(evidence.organizationId, orgId)]
  if (status && evidenceStatus.safeParse(status).success) {
    conditions.push(eq(evidence.status, status as z.infer<typeof evidenceStatus>))
  }
  if (type && evidenceType.safeParse(type).success) {
    conditions.push(eq(evidence.evidenceType, type as z.infer<typeof evidenceType>))
  }

  try {
    const whereClause = and(...conditions)
    const [rows, totalRow] = await Promise.all([
      db
        .select()
        .from(evidence)
        .where(whereClause)
        .orderBy(desc(evidence.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(evidence)
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
    logger.error({ err }, 'v1.evidence.list failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

const postSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  evidenceType: evidenceType.optional(),
  textContent: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  controlAssignmentId: z.string().uuid().optional(),
}).strict()

export async function POST(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'write:evidence')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData

  let raw: unknown
  try { raw = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
  }
  const parsed = postSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message, code: 'BAD_REQUEST' }, { status: 400 })
  }
  const body = parsed.data

  if (body.controlAssignmentId) {
    const [ca] = await db
      .select({ id: controlAssignments.id })
      .from(controlAssignments)
      .where(and(eq(controlAssignments.id, body.controlAssignmentId), eq(controlAssignments.organizationId, orgId)))
      .limit(1)
    if (!ca) {
      return NextResponse.json({ success: false, error: 'controlAssignmentId does not belong to this organization', code: 'BAD_REQUEST' }, { status: 400 })
    }
  }

  try {
    const [record] = await db.insert(evidence).values({
      // organizationId is FORCED from API key — never from body.
      organizationId: orgId,
      title: body.title,
      description: body.description,
      evidenceType: body.evidenceType ?? 'text',
      textContent: body.textContent,
      status: 'pending',
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      controlAssignmentId: body.controlAssignmentId,
    }).returning()

    return NextResponse.json({ success: true, data: record }, { status: 201 })
  } catch (err) {
    logger.error({ err }, 'v1.evidence.create failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
