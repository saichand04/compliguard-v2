import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked', 'cancelled']).optional().default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  assignedTo: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  labels: z.array(z.string()).optional().nullable(),
  controlAssignmentId: z.string().uuid().optional().nullable(),
})

/**
 * GET /api/tasks?status=&priority=&assignee=&orgId=
 * List tasks with optional filters.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const assignee = searchParams.get('assignee')

  const allTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.organizationId, session.orgId))
    .orderBy(desc(tasks.createdAt))

  const filtered = allTasks.filter((t) => {
    if (status && t.status !== status) return false
    if (priority && t.priority !== priority) return false
    if (assignee && t.assignedTo !== assignee) return false
    return true
  })

  return NextResponse.json({ tasks: filtered, total: filtered.length })
}

/**
 * POST /api/tasks
 * Create a new task.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = createTaskSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const { dueDate, ...rest } = result.data

  const [task] = await db
    .insert(tasks)
    .values({
      ...rest,
      organizationId: session.orgId,
      createdBy: session.userId,
      dueDate: dueDate ? new Date(dueDate) : null,
      labels: rest.labels ?? null,
    })
    .returning()

  return NextResponse.json({ task }, { status: 201 })
}
