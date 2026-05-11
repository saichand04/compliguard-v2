import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tasks, users, controlAssignments } from '@/lib/db/schema'
import { eq, and, desc, sql, type SQL } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const taskStatus = z.enum(['todo', 'in_progress', 'done', 'blocked', 'cancelled'])
const taskPriority = z.enum(['low', 'medium', 'high', 'urgent'])

export async function GET(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:tasks')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const assignee = searchParams.get('assignee')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  // Build SQL filters — push them into the WHERE rather than JS post-filtering.
  const conditions: SQL[] = [eq(tasks.organizationId, orgId)]
  if (status && taskStatus.safeParse(status).success) {
    conditions.push(eq(tasks.status, status as z.infer<typeof taskStatus>))
  }
  if (priority && taskPriority.safeParse(priority).success) {
    conditions.push(eq(tasks.priority, priority as z.infer<typeof taskPriority>))
  }
  if (assignee && z.string().uuid().safeParse(assignee).success) {
    conditions.push(eq(tasks.assignedTo, assignee))
  }

  try {
    const whereClause = and(...conditions)
    const [rows, totalRow] = await Promise.all([
      db
        .select()
        .from(tasks)
        .where(whereClause)
        .orderBy(desc(tasks.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
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
    logger.error({ err }, 'v1.tasks.list failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

const postSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: taskStatus.optional(),
  priority: taskPriority.optional(),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  controlAssignmentId: z.string().uuid().optional(),
}).strict()

export async function POST(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'write:tasks')) {
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

  // (mass-assignment) Validate every FK to confirm it belongs to apiKey org.
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
    const [task] = await db.insert(tasks).values({
      // organizationId is FORCED from API key — never from body.
      organizationId: orgId,
      title: body.title,
      description: body.description,
      status: body.status ?? 'todo',
      priority: body.priority ?? 'medium',
      assignedTo: body.assignedTo,
      controlAssignmentId: body.controlAssignmentId,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    }).returning()

    return NextResponse.json({ success: true, data: task }, { status: 201 })
  } catch (err) {
    logger.error({ err }, 'v1.tasks.create failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
