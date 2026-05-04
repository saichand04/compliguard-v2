import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { questionnaires } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const createQuestionnaireSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['draft', 'sent', 'in_progress', 'completed', 'expired']).optional(),
})

/** GET /api/questionnaires — list all questionnaires for org */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const rows = await db
    .select()
    .from(questionnaires)
    .where(eq(questionnaires.organizationId, session.orgId))
    .orderBy(desc(questionnaires.createdAt))

  return NextResponse.json({ questionnaires: rows, total: rows.length })
}

/** POST /api/questionnaires — create questionnaire */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = createQuestionnaireSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const data = result.data

  const [questionnaire] = await db.insert(questionnaires).values({
    organizationId: session.orgId,
    title: data.title,
    description: data.description,
    vendorId: data.vendorId,
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    status: data.status ?? 'draft',
    createdBy: session.userId,
  }).returning()

  return NextResponse.json({ questionnaire }, { status: 201 })
}
