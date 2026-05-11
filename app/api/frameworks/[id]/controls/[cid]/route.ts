import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { controls, frameworks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// TODO(security): scope frameworks per-org. Until that schema change, gate
// control writes to super_admin and reject built-in frameworks.

const uuidSchema = z.string().uuid()

const patchSchema = z.object({
  controlId: z.string().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  guidance: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict()

/**
 * PATCH /api/frameworks/[id]/controls/[cid]
 * Update a control.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'super_admin') return ApiErrors.forbidden()
  if (!hasPermission(session.role, PERMISSIONS.EDIT_FRAMEWORKS)) return ApiErrors.forbidden()

  const { id, cid } = await params
  if (!uuidSchema.safeParse(id).success) return ApiErrors.badRequest('Invalid id')
  if (!uuidSchema.safeParse(cid).success) return ApiErrors.badRequest('Invalid cid')

  // Refuse built-in frameworks.
  const [parentFw] = await db.select({ isBuiltIn: frameworks.isBuiltIn }).from(frameworks).where(eq(frameworks.id, id))
  if (!parentFw) return ApiErrors.notFound('Framework')
  if (parentFw.isBuiltIn === true) return ApiErrors.forbidden()

  const [existing] = await db
    .select()
    .from(controls)
    .where(and(eq(controls.id, cid), eq(controls.frameworkId, id)))

  if (!existing) return ApiErrors.notFound('Control')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = patchSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const { notes, ...updateData } = result.data

  // Merge notes into metadata
  let metadata = existing.metadata as Record<string, unknown> | null
  if (notes !== undefined) {
    metadata = { ...(metadata || {}), notes }
  }
  if (updateData.metadata) {
    metadata = { ...(metadata || {}), ...updateData.metadata }
  }

  try {
    const [updated] = await db
      .update(controls)
      .set({ ...updateData, metadata, updatedAt: new Date() })
      .where(and(eq(controls.id, cid), eq(controls.frameworkId, id)))
      .returning()

    await writeAuditLog({
      organizationId: session.orgId,
      userId: session.userId,
      action: 'control.update',
      resourceType: 'control',
      resourceId: cid,
      resourceTitle: updated.title,
      description: `Updated control ${updated.controlId ?? cid}`,
      before: existing,
      after: updated,
      request: req,
    })

    return NextResponse.json({ control: updated })
  } catch (err) {
    logger.error({ err, id, cid }, 'control.update failed')
    return ApiErrors.internal()
  }
}

/**
 * DELETE /api/frameworks/[id]/controls/[cid]
 * Delete a control from a framework.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'super_admin') return ApiErrors.forbidden()
  if (!hasPermission(session.role, PERMISSIONS.EDIT_FRAMEWORKS)) return ApiErrors.forbidden()

  const { id, cid } = await params
  if (!uuidSchema.safeParse(id).success) return ApiErrors.badRequest('Invalid id')
  if (!uuidSchema.safeParse(cid).success) return ApiErrors.badRequest('Invalid cid')

  const [parentFw] = await db.select({ isBuiltIn: frameworks.isBuiltIn }).from(frameworks).where(eq(frameworks.id, id))
  if (!parentFw) return ApiErrors.notFound('Framework')
  if (parentFw.isBuiltIn === true) return ApiErrors.forbidden()

  const [ctrl] = await db
    .select()
    .from(controls)
    .where(and(eq(controls.id, cid), eq(controls.frameworkId, id)))

  if (!ctrl) return ApiErrors.notFound('Control')

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'control.delete',
    resourceType: 'control',
    resourceId: cid,
    resourceTitle: ctrl.title,
    description: `Deleted control ${ctrl.controlId ?? cid}`,
    before: ctrl,
    request: req,
  })

  try {
    await db.delete(controls).where(and(eq(controls.id, cid), eq(controls.frameworkId, id)))
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ err, id, cid }, 'control.delete failed')
    return ApiErrors.internal()
  }
}
