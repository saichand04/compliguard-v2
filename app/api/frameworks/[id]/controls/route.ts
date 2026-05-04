import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { frameworks, controls } from '@/lib/db/schema'
import { eq, and, ilike, or } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

/**
 * GET /api/frameworks/[id]/controls
 * List all controls for a framework. Supports ?search= query.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_FRAMEWORKS)) return ApiErrors.forbidden()

  const { id } = await params

  const [fw] = await db.select({ id: frameworks.id }).from(frameworks).where(eq(frameworks.id, id))
  if (!fw) return ApiErrors.notFound('Framework')

  const search = req.nextUrl.searchParams.get('search')

  let fwControls
  if (search) {
    fwControls = await db
      .select()
      .from(controls)
      .where(
        and(
          eq(controls.frameworkId, id),
          or(
            ilike(controls.title, `%${search}%`),
            ilike(controls.controlId, `%${search}%`),
            ilike(controls.description, `%${search}%`)
          )
        )
      )
  } else {
    fwControls = await db.select().from(controls).where(eq(controls.frameworkId, id))
  }

  return NextResponse.json({ controls: fwControls, total: fwControls.length })
}

const createControlSchema = z.object({
  controlId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  guidance: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * POST /api/frameworks/[id]/controls
 * Add a control to a framework.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.EDIT_FRAMEWORKS)) return ApiErrors.forbidden()

  const { id } = await params

  const [fw] = await db.select({ id: frameworks.id }).from(frameworks).where(eq(frameworks.id, id))
  if (!fw) return ApiErrors.notFound('Framework')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = createControlSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const { notes, ...controlData } = result.data

  const [ctrl] = await db.insert(controls).values({
    ...controlData,
    frameworkId: id,
    metadata: notes ? { notes, ...(controlData.metadata || {}) } : (controlData.metadata || null),
  }).returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'control.create',
    resourceType: 'control',
    resourceId: ctrl.id,
    resourceTitle: ctrl.title,
    description: `Added control ${ctrl.controlId ?? ctrl.id} to framework`,
    request: req,
  })

  return NextResponse.json({ control: ctrl }, { status: 201 })
}
