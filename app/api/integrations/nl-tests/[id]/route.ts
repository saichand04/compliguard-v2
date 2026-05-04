import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { nlTests } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  query: z.string().min(1).optional(),
  schedule: z.string().optional(),
  isActive: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/integrations/nl-tests/[id]
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_INTEGRATIONS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await ctx.params

  const [test] = await db
    .select()
    .from(nlTests)
    .where(and(eq(nlTests.id, id), eq(nlTests.organizationId, session.orgId)))
    .limit(1)

  if (!test) return ApiErrors.notFound('NL Test')
  return NextResponse.json({ test })
}

/**
 * PATCH /api/integrations/nl-tests/[id]
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.MANAGE_INTEGRATIONS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await ctx.params

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = updateSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const [existing] = await db
    .select({ id: nlTests.id })
    .from(nlTests)
    .where(and(eq(nlTests.id, id), eq(nlTests.organizationId, session.orgId)))
    .limit(1)

  if (!existing) return ApiErrors.notFound('NL Test')

  const updates: Partial<typeof nlTests.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (result.data.name !== undefined) updates.name = result.data.name
  if (result.data.query !== undefined) updates.query = result.data.query
  if (result.data.schedule !== undefined) updates.schedule = result.data.schedule
  if (result.data.isActive !== undefined) updates.isActive = result.data.isActive

  const [updated] = await db
    .update(nlTests)
    .set(updates)
    .where(eq(nlTests.id, id))
    .returning()

  return NextResponse.json({ test: updated })
}

/**
 * DELETE /api/integrations/nl-tests/[id]
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.MANAGE_INTEGRATIONS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await ctx.params

  const [existing] = await db
    .select({ id: nlTests.id })
    .from(nlTests)
    .where(and(eq(nlTests.id, id), eq(nlTests.organizationId, session.orgId)))
    .limit(1)

  if (!existing) return ApiErrors.notFound('NL Test')

  await db.delete(nlTests).where(eq(nlTests.id, id))

  return NextResponse.json({ success: true })
}
