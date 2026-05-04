import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { questionnaires } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  vendorId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  status: z.enum(['draft', 'sent', 'in_progress', 'completed', 'expired']).optional(),
})

/** GET /api/questionnaires/[id] */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [questionnaire] = await db
    .select()
    .from(questionnaires)
    .where(and(eq(questionnaires.id, id), eq(questionnaires.organizationId, session.orgId)))

  if (!questionnaire) return ApiErrors.notFound('Questionnaire')

  return NextResponse.json({ questionnaire })
}

/** PATCH /api/questionnaires/[id] */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = patchSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const data = result.data
  const updateData: Record<string, unknown> = { updatedAt: new Date() }

  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description
  if (data.vendorId !== undefined) updateData.vendorId = data.vendorId
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate as string) : null
  if (data.status !== undefined) updateData.status = data.status

  const [updated] = await db
    .update(questionnaires)
    .set(updateData)
    .where(and(eq(questionnaires.id, id), eq(questionnaires.organizationId, session.orgId)))
    .returning()

  if (!updated) return ApiErrors.notFound('Questionnaire')

  return NextResponse.json({ questionnaire: updated })
}

/** DELETE /api/questionnaires/[id] */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [deleted] = await db
    .delete(questionnaires)
    .where(and(eq(questionnaires.id, id), eq(questionnaires.organizationId, session.orgId)))
    .returning()

  if (!deleted) return ApiErrors.notFound('Questionnaire')

  return NextResponse.json({ success: true })
}
