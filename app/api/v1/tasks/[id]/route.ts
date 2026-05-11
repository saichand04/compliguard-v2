import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tasks, users, controlAssignments } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

const taskStatus = z.enum(['todo', 'in_progress', 'done', 'blocked', 'cancelled'])
const taskPriority = z.enum(['low', 'medium', 'high', 'urgent'])

const patchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: taskStatus.optional(),
  priority: taskPriority.optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:tasks')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, error: 'Invalid id', code: 'BAD_REQUEST' }, { status: 400 })
  }

  try {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, orgId)))
      .limit(1)

    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: task })
  } catch (err) {
    logger.error({ err, id }, 'v1.tasks.get failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'write:tasks')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, error: 'Invalid id', code: 'BAD_REQUEST' }, { status: 400 })
  }

  let raw: unknown
  try { raw = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message, code: 'BAD_REQUEST' }, { status: 400 })
  }
  const body = parsed.data

  // FK validation
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

  // Confirm the task itself exists in this org BEFORE updating (so we don't
  // silently no-op on cross-org id attempts and so we don't accept a
  // controlAssignmentId mass-assignment via body — only fields in patchSchema
  // are accepted, and that schema does not allow organizationId.)
  const [existing] = await db
    .select({ id: tasks.id, controlAssignmentId: tasks.controlAssignmentId })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, orgId)))
    .limit(1)
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Task not found', code: 'NOT_FOUND' }, { status: 404 })
  }
  // (Defensive) re-confirm the existing controlAssignment is still ours
  if (existing.controlAssignmentId) {
    const [ca] = await db
      .select({ id: controlAssignments.id })
      .from(controlAssignments)
      .where(and(eq(controlAssignments.id, existing.controlAssignmentId), eq(controlAssignments.organizationId, orgId)))
      .limit(1)
    if (!ca) {
      return NextResponse.json({ success: false, error: 'Task is linked to an out-of-org control assignment', code: 'FORBIDDEN' }, { status: 403 })
    }
  }

  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.status !== undefined) updateData.status = body.status
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null

    if (body.status === 'done') {
      updateData.completedAt = new Date()
    }

    const [updated] = await db
      .update(tasks)
      .set(updateData)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, orgId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Task not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    logger.error({ err, id }, 'v1.tasks.update failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
