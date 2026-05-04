import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { questionnaires } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { randomUUID } from 'crypto'

/** POST /api/questionnaires/[id]/send — generate token, mark as sent */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [questionnaire] = await db
    .select()
    .from(questionnaires)
    .where(and(eq(questionnaires.id, id), eq(questionnaires.organizationId, session.orgId)))

  if (!questionnaire) return ApiErrors.notFound('Questionnaire')

  // Generate secure UUID token
  const token = randomUUID()

  const existingMetadata = (questionnaire.metadata as Record<string, unknown> | null) ?? {}

  const [updated] = await db
    .update(questionnaires)
    .set({
      status: 'sent',
      sentAt: new Date(),
      metadata: { ...existingMetadata, token },
      updatedAt: new Date(),
    })
    .where(eq(questionnaires.id, id))
    .returning()

  // Build the public URL
  const baseUrl = req.headers.get('origin') ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const publicUrl = `${baseUrl}/questionnaire/${token}`

  return NextResponse.json({
    questionnaire: updated,
    token,
    publicUrl,
    mailtoLink: `mailto:?subject=Questionnaire%3A%20${encodeURIComponent(questionnaire.title)}&body=Please%20complete%20the%20following%20questionnaire%3A%0A${encodeURIComponent(publicUrl)}`,
  })
}
