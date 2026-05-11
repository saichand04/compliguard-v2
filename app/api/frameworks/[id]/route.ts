import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { frameworks, controls } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// TODO(security): scope frameworks per-org. The frameworks table is currently
// platform-wide (no organization_id column). Until that schema change happens,
// PATCH/DELETE/publish/rollback are gated to super_admin so tenant admins
// cannot cross-write into each other's framework definitions. Built-in
// frameworks are always rejected for writes.

const uuidSchema = z.string().uuid()

/**
 * GET /api/frameworks/[id]
 * Get a single framework with control count.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_FRAMEWORKS)) return ApiErrors.forbidden()

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return ApiErrors.badRequest('Invalid id')

  const [fw] = await db.select().from(frameworks).where(eq(frameworks.id, id))
  if (!fw) return ApiErrors.notFound('Framework')

  const [{ value: controlCount }] = await db
    .select({ value: count() })
    .from(controls)
    .where(eq(controls.frameworkId, id))

  return NextResponse.json({ framework: { ...fw, controlCount } })
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  shortName: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  regulatoryBody: z.string().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict()

/**
 * PATCH /api/frameworks/[id]
 * Update framework fields (super_admin only — see top-of-file TODO).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'super_admin') return ApiErrors.forbidden()
  if (!hasPermission(session.role, PERMISSIONS.EDIT_FRAMEWORKS)) return ApiErrors.forbidden()

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return ApiErrors.badRequest('Invalid id')

  const [existing] = await db.select().from(frameworks).where(eq(frameworks.id, id))
  if (!existing) return ApiErrors.notFound('Framework')

  // Built-in frameworks are read-only.
  if (existing.isBuiltIn === true) return ApiErrors.forbidden()

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = patchSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  try {
    const [updated] = await db
      .update(frameworks)
      .set({ ...result.data, updatedAt: new Date() })
      .where(eq(frameworks.id, id))
      .returning()

    await writeAuditLog({
      organizationId: session.orgId,
      userId: session.userId,
      action: 'framework.update',
      resourceType: 'framework',
      resourceId: id,
      resourceTitle: updated.name,
      description: `Updated framework: ${updated.name}`,
      before: existing,
      after: updated,
      request: req,
    })

    return NextResponse.json({ framework: updated })
  } catch (err) {
    logger.error({ err, id }, 'framework.update failed')
    return ApiErrors.internal()
  }
}

/**
 * DELETE /api/frameworks/[id]
 * Archive (soft-delete) a framework (super_admin only — see top-of-file TODO).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'super_admin') return ApiErrors.forbidden()
  if (!hasPermission(session.role, PERMISSIONS.DELETE_FRAMEWORKS)) return ApiErrors.forbidden()

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return ApiErrors.badRequest('Invalid id')

  const [fw] = await db.select().from(frameworks).where(eq(frameworks.id, id))
  if (!fw) return ApiErrors.notFound('Framework')

  if (fw.isBuiltIn === true) return ApiErrors.forbidden()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'framework.delete',
    resourceType: 'framework',
    resourceId: id,
    resourceTitle: fw.name,
    description: `Archived framework: ${fw.name}`,
    before: fw,
    request: req,
  })

  try {
    await db.update(frameworks).set({ isActive: false, updatedAt: new Date() }).where(eq(frameworks.id, id))
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ err, id }, 'framework.delete failed')
    return ApiErrors.internal()
  }
}
