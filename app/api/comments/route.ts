import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { comments, commentMentions, notifications, users } from '@/lib/db/schema'
import { eq, and, isNull, asc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

// ── GET /api/comments?entityType=control&entityId=xxx ─────────────────────────
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')

  if (!entityType || !entityId) {
    return ApiErrors.badRequest('entityType and entityId are required')
  }

  // Fetch top-level comments (no parent) ordered by creation time
  const topLevelComments = await db
    .select({
      id: comments.id,
      body: comments.body,
      entityType: comments.entityType,
      entityId: comments.entityId,
      parentCommentId: comments.parentCommentId,
      isEdited: comments.isEdited,
      editedAt: comments.editedAt,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorId: comments.authorId,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorEmail: users.email,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(
      and(
        eq(comments.entityType, entityType),
        eq(comments.entityId, entityId),
        isNull(comments.parentCommentId)
      )
    )
    .orderBy(asc(comments.createdAt))

  // Fetch all replies for these top-level comments
  const topLevelIds = topLevelComments.map((c) => c.id)

  let replies: typeof topLevelComments = []
  if (topLevelIds.length > 0) {
    // Drizzle doesn't support inArray with empty arrays well; guard it
    const allReplies = await db
      .select({
        id: comments.id,
        body: comments.body,
        entityType: comments.entityType,
        entityId: comments.entityId,
        parentCommentId: comments.parentCommentId,
        isEdited: comments.isEdited,
        editedAt: comments.editedAt,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        authorId: comments.authorId,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorEmail: users.email,
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(
        and(
          eq(comments.entityType, entityType),
          eq(comments.entityId, entityId)
        )
      )
      .orderBy(asc(comments.createdAt))

    replies = allReplies.filter(
      (r) => r.parentCommentId !== null && topLevelIds.includes(r.parentCommentId)
    )
  }

  // Build nested structure
  const threaded = topLevelComments.map((c) => ({
    ...c,
    replies: replies.filter((r) => r.parentCommentId === c.id),
  }))

  return NextResponse.json({ comments: threaded })
}

// ── POST /api/comments ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  if (!session.orgId) {
    return ApiErrors.badRequest('User must belong to an organization')
  }

  const body = await req.json()
  const { entityType, entityId, body: commentBody, parentCommentId } = body

  if (!entityType || !entityId || !commentBody?.trim()) {
    return ApiErrors.badRequest('entityType, entityId, and body are required')
  }

  // Create the comment
  const [created] = await db
    .insert(comments)
    .values({
      organizationId: session.orgId,
      authorId: session.userId,
      entityType,
      entityId,
      body: commentBody.trim(),
      parentCommentId: parentCommentId ?? null,
      isEdited: false,
    })
    .returning()

  // Parse @mentions from body using regex /@(\w+)/g
  const mentionMatches = [...commentBody.matchAll(/@(\w+)/g)] as RegExpMatchArray[]
  const mentionedUsernames = mentionMatches.map((m) => m[1])

  if (mentionedUsernames.length > 0) {
    try {
      // Fetch all org members for mention matching
      const orgUsers = await db
        .select()
        .from(users)
        .where(eq(users.organizationId, session.orgId!))
        .limit(200)

      for (const username of mentionedUsernames) {
        const matched = orgUsers.find((u) => {
          const emailBase = u.email.split('@')[0].toLowerCase()
          return (
            u.firstName?.toLowerCase() === username.toLowerCase() ||
            u.lastName?.toLowerCase() === username.toLowerCase() ||
            emailBase === username.toLowerCase()
          )
        })

        if (matched && matched.id !== session.userId) {
          // Insert mention record
          await db.insert(commentMentions).values({
            commentId: created.id,
            mentionedUserId: matched.id,
            notified: false,
          })

          // Create notification for mentioned user
          await db.insert(notifications).values({
            organizationId: session.orgId!,
            userId: matched.id,
            type: 'mention',
            title: `${session.firstName || session.email} mentioned you in a comment`,
            body: commentBody.trim().slice(0, 200),
            link: `/${entityType}s`,
            isRead: false,
          })

          // Mark mention as notified
          await db
            .update(commentMentions)
            .set({ notified: true })
            .where(
              and(
                eq(commentMentions.commentId, created.id),
                eq(commentMentions.mentionedUserId, matched.id)
              )
            )
        }
      }
    } catch {
      // Don't fail the request if mention processing fails
    }
  }

  // Fetch the created comment with author info
  const [withAuthor] = await db
    .select({
      id: comments.id,
      body: comments.body,
      entityType: comments.entityType,
      entityId: comments.entityId,
      parentCommentId: comments.parentCommentId,
      isEdited: comments.isEdited,
      editedAt: comments.editedAt,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorId: comments.authorId,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorEmail: users.email,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.id, created.id))

  return NextResponse.json({ comment: withAuthor }, { status: 201 })
}

// ── PATCH /api/comments?id=xxx ────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return ApiErrors.badRequest('Comment id is required as query param ?id=...')
  }

  const body = await req.json()
  const { body: newBody } = body

  if (!newBody?.trim()) {
    return ApiErrors.badRequest('body is required')
  }

  // Verify authorship
  const [existing] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, id), eq(comments.authorId, session.userId)))

  if (!existing) {
    return ApiErrors.forbidden()
  }

  const [updated] = await db
    .update(comments)
    .set({
      body: newBody.trim(),
      isEdited: true,
      editedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(comments.id, id))
    .returning()

  return NextResponse.json({ comment: updated })
}

// ── DELETE /api/comments?id=xxx ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return ApiErrors.badRequest('Comment id is required as query param ?id=...')
  }

  // Verify authorship
  const [existing] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, id), eq(comments.authorId, session.userId)))

  if (!existing) {
    return ApiErrors.forbidden()
  }

  // Check if this comment has replies
  const replies = await db
    .select({ id: comments.id })
    .from(comments)
    .where(eq(comments.parentCommentId, id))
    .limit(1)

  if (replies.length > 0) {
    // Soft delete: replace body with [deleted]
    await db
      .update(comments)
      .set({ body: '[deleted]', updatedAt: new Date() })
      .where(eq(comments.id, id))
  } else {
    // Hard delete
    await db.delete(comments).where(eq(comments.id, id))
  }

  return NextResponse.json({ ok: true })
}
