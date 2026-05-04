import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { teamsConversationRefs } from '@/lib/db/schema/teams_bot'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  const rows = await db
    .select()
    .from(teamsConversationRefs)
    .orderBy(teamsConversationRefs.createdAt)

  return NextResponse.json({ conversations: rows })
}

export async function DELETE(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  let body: { id?: string }
  try {
    body = await request.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const { id } = body
  if (!id) return ApiErrors.badRequest('id is required')

  const deleted = await db
    .delete(teamsConversationRefs)
    .where(eq(teamsConversationRefs.id, id))
    .returning()

  if (deleted.length === 0) {
    return ApiErrors.notFound('Conversation')
  }

  return NextResponse.json({ success: true })
}
