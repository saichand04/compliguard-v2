import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { questionnaires, questionnaireQuestions } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const createQuestionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(['text', 'yes_no', 'multiple_choice', 'file_upload', 'rating']),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
  orderIndex: z.number().int().optional(),
  category: z.string().optional(),
})

/** GET /api/questionnaires/[id]/questions */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  // Verify questionnaire belongs to org
  const [q] = await db
    .select()
    .from(questionnaires)
    .where(and(eq(questionnaires.id, id), eq(questionnaires.organizationId, session.orgId)))

  if (!q) return ApiErrors.notFound('Questionnaire')

  const questions = await db
    .select()
    .from(questionnaireQuestions)
    .where(eq(questionnaireQuestions.questionnaireId, id))
    .orderBy(asc(questionnaireQuestions.orderIndex))

  return NextResponse.json({ questions, total: questions.length })
}

/** POST /api/questionnaires/[id]/questions */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

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

  // Support bulk insert (array) or single
  const isBulk = Array.isArray(body)
  const items: unknown[] = isBulk ? (body as unknown[]) : [body]

  type ParsedQuestion = {
    questionText: string
    questionType: 'text' | 'yes_no' | 'multiple_choice' | 'file_upload' | 'rating'
    options?: string[]
    isRequired?: boolean
    orderIndex?: number
    category?: string
  }

  const parsed: ParsedQuestion[] = []
  for (const item of items) {
    const r = createQuestionSchema.safeParse(item)
    if (!r.success) return ApiErrors.badRequest(r.error.issues[0].message)
    parsed.push(r.data)
  }

  const inserted = await db.insert(questionnaireQuestions).values(
    parsed.map((p, i) => ({
      questionnaireId: id,
      questionText: p.questionText,
      questionType: p.questionType,
      options: p.options ? p.options : undefined,
      isRequired: p.isRequired !== false ? 1 : 0,
      orderIndex: p.orderIndex ?? i,
      category: p.category,
    }))
  ).returning()

  return NextResponse.json({ questions: inserted }, { status: 201 })
}
