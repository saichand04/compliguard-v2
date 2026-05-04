import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { orgChartNodes } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const updateNodeSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  orderIndex: z.number().int().optional(),
})

/** PATCH /api/org-chart/[id] — update an org chart node */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [existing] = await db
    .select()
    .from(orgChartNodes)
    .where(and(eq(orgChartNodes.id, id), eq(orgChartNodes.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('Org chart node')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = updateNodeSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const data = result.data

  const [updated] = await db
    .update(orgChartNodes)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.department !== undefined && { department: data.department }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
      ...(data.userId !== undefined && { userId: data.userId }),
      ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      ...(data.orderIndex !== undefined && { orderIndex: data.orderIndex }),
      updatedAt: new Date(),
    })
    .where(and(eq(orgChartNodes.id, id), eq(orgChartNodes.organizationId, session.orgId)))
    .returning()

  return NextResponse.json({ node: updated })
}

/** DELETE /api/org-chart/[id] — delete an org chart node */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [existing] = await db
    .select()
    .from(orgChartNodes)
    .where(and(eq(orgChartNodes.id, id), eq(orgChartNodes.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('Org chart node')

  await db
    .delete(orgChartNodes)
    .where(and(eq(orgChartNodes.id, id), eq(orgChartNodes.organizationId, session.orgId)))

  return NextResponse.json({ success: true })
}
