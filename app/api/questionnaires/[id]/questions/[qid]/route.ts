import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { questionnaires, questionnaireQuestions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const patchQuestionSchema = z.object({
  questionText: z.string().min(1).optional(),
  questionType: z.enum(['text', 'yes_no', 'multiple_choice', 'file_upload', 'rating']).optional(),
  options: z.array(z.string()).optional().nullable(),
  isRequired: z.boolean().optional(),
  orderIndex: z.number().int().optional(),
  category: z.string().optional().nullable(),
})

/** PATCH /api/questionnaires/[id]/questions/[qid] */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id, qid } = await params

  // Verify questionnaire belongs to org
  const [q] = await db
    .select()
    .from(questionnaires)
    .where(and(eq(questionnaires.id, id), eq(questionnaires.organizationId, session.orgId)))

  if (!q) return ApiErrors.notFound('Questionnaire')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = patchQuestionSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const data = result.data
  const updateData: Record<string, unknown> = {}

  if (data.questionText !== undefined) updateData.questionText = data.questionText
  if (data.questionType !== undefined) updateData.questionType = data.questionType
  if (data.options !== undefined) updateData.options = data.options
  if (data.isRequired !== undefined) updateData.isRequired = data.isRequired ? 1 : 0
  if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex
  if (data.category !== undefined) updateData.category = data.category

  const [updated] = await db
    .update(questionnaireQuestions)
    .set(updateData)
    .where(and(eq(questionnaireQuestions.id, qid), eq(questionnaireQuestions.questionnaireId, id)))
    .returning()

  if (!updated) return ApiErrors.notFound('Question')

  return NextResponse.json({ question: updated })
}

/** DELETE /api/questionnaires/[id]/questions/[qid] */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id, qid } = await params

  // Verify questionnaire belongs to org
  const [q] = await db
    .select()
    .from(questionnaires)
    .where(and(eq(questionnaires.id, id), eq(questionnaires.organizationId, session.orgId)))

  if (!q) return ApiErrors.notFound('Questionnaire')

  const [deleted] = await db
    .delete(questionnaireQuestions)
    .where(and(eq(questionnaireQuestions.id, qid), eq(questionnaireQuestions.questionnaireId, id)))
    .returning()

  if (!deleted) return ApiErrors.notFound('Question')

  return NextResponse.json({ success: true })
}
