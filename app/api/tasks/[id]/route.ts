import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  labels: z.array(z.string()).optional().nullable(),
  controlAssignmentId: z.string().uuid().optional().nullable(),
})

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/tasks/[id]
 * Get task detail.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await context.params

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, session.orgId)))

  if (!task) return ApiErrors.notFound('Task')

  return NextResponse.json({ task })
}

/**
 * PATCH /api/tasks/[id]
 * Update task fields.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await context.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = updateTaskSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const { dueDate, ...rest } = result.data

  const updateData: Record<string, unknown> = {
    ...rest,
    updatedAt: new Date(),
  }

  if (dueDate !== undefined) {
    updateData.dueDate = dueDate ? new Date(dueDate) : null
  }

  // If marking as done, set completedAt
  const newStatus = result.data.status
  if (newStatus === 'done') {
    updateData.completedAt = new Date()
  } else if (newStatus) {
    updateData.completedAt = null
  }

  const [updated] = await db
    .update(tasks)
    .set(updateData)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, session.orgId)))
    .returning()

  if (!updated) return ApiErrors.notFound('Task')

  return NextResponse.json({ task: updated })
}

/**
 * DELETE /api/tasks/[id]
 * Delete a task.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await context.params

  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, session.orgId)))
    .returning()

  if (!deleted) return ApiErrors.notFound('Task')

  return NextResponse.json({ success: true })
}
