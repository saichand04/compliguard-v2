import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { controls, controlAssignments } from '@/lib/db/schema'
import { eq, and, like } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

/**
 * GET /api/controls?frameworkId=&status=&assignedTo=
 * List controls with optional filters.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_CONTROLS)) return ApiErrors.forbidden()

  if (!session.orgId) return ApiErrors.forbidden()

  const { searchParams } = req.nextUrl
  const frameworkId = searchParams.get('frameworkId')
  const status = searchParams.get('status')
  const assignedTo = searchParams.get('assignedTo')

  // Build base query
  let query = db
    .select({
      control: controls,
      assignment: controlAssignments,
    })
    .from(controlAssignments)
    .innerJoin(controls, eq(controls.id, controlAssignments.controlId))
    .where(eq(controlAssignments.organizationId, session.orgId))
    .$dynamic()

  // Note: drizzle doesn't support dynamic where easily, so we do post-filter
  const results = await db
    .select({
      control: controls,
      assignment: controlAssignments,
    })
    .from(controlAssignments)
    .innerJoin(controls, eq(controls.id, controlAssignments.controlId))
    .where(eq(controlAssignments.organizationId, session.orgId))
    .limit(200)

  const filtered = results.filter((r) => {
    if (frameworkId && r.control.frameworkId !== frameworkId) return false
    if (status && r.assignment.status !== status) return false
    if (assignedTo && r.assignment.assignedTo !== assignedTo) return false
    return true
  })

  return NextResponse.json({
    controls: filtered.map((r) => ({
      ...r.control,
      assignment: r.assignment,
    })),
    total: filtered.length,
  })
}

const createControlSchema = z.object({
  frameworkId: z.string().uuid(),
  controlId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  guidance: z.string().optional(),
  category: z.string().optional(),
})

/**
 * POST /api/controls
 * Create a new control and optionally assign it to the current org.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.CREATE_CONTROLS)) return ApiErrors.forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = createControlSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const [control] = await db.insert(controls).values(result.data).returning()

  // Auto-create an assignment for this org
  if (session.orgId) {
    await db.insert(controlAssignments).values({
      organizationId: session.orgId,
      controlId: control.id,
      status: 'not_started',
    })
  }

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'control.create',
    resourceType: 'control',
    resourceId: control.id,
    resourceTitle: control.title,
    description: `Created control: ${control.title}`,
    request: req,
  })

  return NextResponse.json({ control }, { status: 201 })
}
