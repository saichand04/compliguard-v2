import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { questionnaires, questionnaireQuestions, questionnaireResponses } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { z } from 'zod'

const submitResponseSchema = z.object({
  respondentEmail: z.string().email(),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    responseText: z.string().optional(),
    responseData: z.unknown().optional(),
  })),
})

/** GET /api/questionnaire-response/[token] — public: fetch questionnaire + questions */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Find questionnaire by token stored in metadata
  const allQuestionnaires = await db
    .select()
    .from(questionnaires)
    .where(eq(questionnaires.status, 'sent'))

  const questionnaire = allQuestionnaires.find((q) => {
    const meta = q.metadata as Record<string, unknown> | null
    return meta?.token === token
  })

  // Also check in_progress status
  let found = questionnaire
  if (!found) {
    const inProgress = await db
      .select()
      .from(questionnaires)
      .where(eq(questionnaires.status, 'in_progress'))
    found = inProgress.find((q) => {
      const meta = q.metadata as Record<string, unknown> | null
      return meta?.token === token
    })
  }

  if (!found) {
    return NextResponse.json({ error: 'Questionnaire not found or link has expired' }, { status: 404 })
  }

  const questions = await db
    .select()
    .from(questionnaireQuestions)
    .where(eq(questionnaireQuestions.questionnaireId, found.id))
    .orderBy(asc(questionnaireQuestions.orderIndex))

  return NextResponse.json({
    questionnaire: {
      id: found.id,
      title: found.title,
      description: found.description,
      dueDate: found.dueDate,
    },
    questions,
  })
}

/** POST /api/questionnaire-response/[token] — public: submit responses */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Find questionnaire by token
  const allSent = await db
    .select()
    .from(questionnaires)

  const questionnaire = allSent.find((q) => {
    const meta = q.metadata as Record<string, unknown> | null
    return meta?.token === token
  })

  if (!questionnaire) {
    return NextResponse.json({ error: 'Questionnaire not found or link has expired' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = submitResponseSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
  }

  const { respondentEmail, answers } = result.data

  // Insert responses
  if (answers.length > 0) {
    await db.insert(questionnaireResponses).values(
      answers.map((a) => ({
        questionnaireId: questionnaire.id,
        questionId: a.questionId,
        responseText: a.responseText ?? null,
        responseData: a.responseData as Record<string, unknown> | undefined,
        respondentEmail,
        submittedAt: new Date(),
      }))
    )
  }

  // Mark questionnaire as in_progress or completed
  const existingMeta = (questionnaire.metadata as Record<string, unknown> | null) ?? {}
  await db
    .update(questionnaires)
    .set({
      status: 'in_progress',
      metadata: { ...existingMeta, lastRespondent: respondentEmail },
      updatedAt: new Date(),
    })
    .where(eq(questionnaires.id, questionnaire.id))

  return NextResponse.json({ success: true, message: 'Responses submitted successfully' })
}
