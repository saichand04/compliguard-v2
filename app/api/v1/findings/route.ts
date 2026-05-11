import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findings, users } from '@/lib/db/schema'
import { eq, and, desc, sql, type SQL } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const findingSeverity = z.enum(['info', 'low', 'medium', 'high', 'critical'])
const findingStatus = z.enum(['open', 'in_remediation', 'resolved', 'accepted', 'false_positive'])
const findingSource = z.enum(['aws', 'azure', 'gcp', 'github', 'pentest', 'manual', 'nl_test', 'integration'])

export async function GET(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:findings')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData

  const { searchParams } = request.nextUrl
  const severity = searchParams.get('severity')
  const status = searchParams.get('status')
  const source = searchParams.get('source')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const conditions: SQL[] = [eq(findings.organizationId, orgId)]
  if (severity && findingSeverity.safeParse(severity).success) {
    conditions.push(eq(findings.severity, severity as z.infer<typeof findingSeverity>))
  }
  if (status && findingStatus.safeParse(status).success) {
    conditions.push(eq(findings.status, status as z.infer<typeof findingStatus>))
  }
  if (source && findingSource.safeParse(source).success) {
    conditions.push(eq(findings.source, source as z.infer<typeof findingSource>))
  }

  try {
    const whereClause = and(...conditions)
    const [rows, totalRow] = await Promise.all([
      db
        .select()
        .from(findings)
        .where(whereClause)
        .orderBy(desc(findings.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(findings)
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
    logger.error({ err }, 'v1.findings.list failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

const postSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  severity: findingSeverity.optional(),
  status: findingStatus.optional(),
  source: findingSource.optional(),
  remediationGuidance: z.string().optional(),
  affectedAsset: z.string().optional(),
  cveId: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
}).strict()

export async function POST(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'write:findings')) {
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

  if (body.assignedTo) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, body.assignedTo), eq(users.organizationId, orgId)))
      .limit(1)
    if (!u) {
      return NextResponse.json({ success: false, error: 'assignedTo does not belong to this organization', code: 'BAD_REQUEST' }, { status: 400 })
    }
  }

  try {
    const [finding] = await db.insert(findings).values({
      // organizationId is FORCED from API key — never from body.
      organizationId: orgId,
      title: body.title,
      description: body.description,
      severity: body.severity ?? 'medium',
      status: body.status ?? 'open',
      source: body.source ?? 'manual',
      remediationGuidance: body.remediationGuidance,
      affectedAsset: body.affectedAsset,
      cveId: body.cveId,
      assignedTo: body.assignedTo,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    }).returning()

    return NextResponse.json({ success: true, data: finding }, { status: 201 })
  } catch (err) {
    logger.error({ err }, 'v1.findings.create failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
