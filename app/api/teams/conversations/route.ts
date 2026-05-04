/**
 * Teams Conversation References API — Phase 7.8
 * GET:    list conversations for org
 * DELETE: remove one conversation (by id) or prune stale (?prune=true)
 * PATCH:  toggle active status (deactivate = delete for schema without isActive)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { teamsConversationRefs } from '@/lib/db/schema/teams_bot'
import { eq, and, lt } from 'drizzle-orm'
import { pruneStaleConversationRefs } from '@/lib/teams/bot'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!

  const rows = await db
    .select()
    .from(teamsConversationRefs)
    .where(eq(teamsConversationRefs.organizationId, orgId))
    .orderBy(teamsConversationRefs.updatedAt)

  return NextResponse.json({ conversations: rows })
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!

  let body: { id?: string; isActive?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  if (!body.id) return ApiErrors.badRequest('id is required')

  // Since schema doesn't have isActive column, we:
  // - isActive=false → delete the record (deactivate)
  // - isActive=true → update updatedAt to refresh
  if (body.isActive === false) {
    const deleted = await db
      .delete(teamsConversationRefs)
      .where(
        and(
          eq(teamsConversationRefs.id, body.id),
          eq(teamsConversationRefs.organizationId, orgId)
        )
      )
      .returning({ id: teamsConversationRefs.id })

    if (deleted.length === 0) {
      return ApiErrors.notFound('Conversation')
    }
    return NextResponse.json({ success: true, action: 'deactivated' })
  }

  // isActive=true — update updatedAt to refresh
  const updated = await db
    .update(teamsConversationRefs)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(teamsConversationRefs.id, body.id),
        eq(teamsConversationRefs.organizationId, orgId)
      )
    )
    .returning({ id: teamsConversationRefs.id })

  if (updated.length === 0) {
    return ApiErrors.notFound('Conversation')
  }

  return NextResponse.json({ success: true, action: 'activated' })
}

export async function DELETE(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!

  // Check for prune query param
  const { searchParams } = new URL(request.url)
  if (searchParams.get('prune') === 'true') {
    const pruned = await pruneStaleConversationRefs(orgId, 30)
    return NextResponse.json({ success: true, pruned })
  }

  // Delete by id
  let body: { id?: string } = {}
  try {
    body = await request.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  if (!body.id) return ApiErrors.badRequest('id is required')

  const deleted = await db
    .delete(teamsConversationRefs)
    .where(
      and(
        eq(teamsConversationRefs.id, body.id),
        eq(teamsConversationRefs.organizationId, orgId)
      )
    )
    .returning()

  if (deleted.length === 0) {
    return ApiErrors.notFound('Conversation')
  }

  return NextResponse.json({ success: true })
}
