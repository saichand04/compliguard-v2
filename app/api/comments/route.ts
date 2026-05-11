import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  comments, commentMentions, notifications, users,
  evidence, findings, tasks, vendors, policies,
  riskAssessments, controlAssignments,
} from '@/lib/db/schema'
import { eq, and, isNull, asc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// ── Parent-entity validator (C10) ─────────────────────────────────────────────
//
// For a given entityType + entityId, confirm the row exists AND belongs to the
// caller's org. Returns true when accessible.
//
// `control` is special: there is no per-org control row — instead we verify
// the caller's org has an assignment for the control (i.e. is using it).
async function entityBelongsToOrg(
  entityType: string,
  entityId: string,
  orgId: string,
): Promise<boolean> {
  try {
    switch (entityType) {
      case 'finding': {
        const [row] = await db
          .select({ id: findings.id })
          .from(findings)
          .where(and(eq(findings.id, entityId), eq(findings.organizationId, orgId)))
          .limit(1)
        return !!row
      }
      case 'task': {
        const [row] = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.id, entityId), eq(tasks.organizationId, orgId)))
          .limit(1)
        return !!row
      }
      case 'vendor': {
        const [row] = await db
          .select({ id: vendors.id })
          .from(vendors)
          .where(and(eq(vendors.id, entityId), eq(vendors.organizationId, orgId)))
          .limit(1)
        return !!row
      }
      case 'evidence': {
        const [row] = await db
          .select({ id: evidence.id })
          .from(evidence)
          .where(and(eq(evidence.id, entityId), eq(evidence.organizationId, orgId)))
          .limit(1)
        return !!row
      }
      case 'policy': {
        const [row] = await db
          .select({ id: policies.id })
          .from(policies)
          .where(and(eq(policies.id, entityId), eq(policies.organizationId, orgId)))
          .limit(1)
        return !!row
      }
      case 'risk': {
        const [row] = await db
          .select({ id: riskAssessments.id })
          .from(riskAssessments)
          .where(and(eq(riskAssessments.id, entityId), eq(riskAssessments.organizationId, orgId)))
          .limit(1)
        return !!row
      }
      case 'control': {
        // Controls are platform-wide; verify the caller's org has an
        // assignment for this control (i.e. is actually using it).
        const [row] = await db
          .select({ id: controlAssignments.id })
          .from(controlAssignments)
          .where(and(
            eq(controlAssignments.controlId, entityId),
            eq(controlAssignments.organizationId, orgId),
          ))
          .limit(1)
        return !!row
      }
      default:
        return false
    }
  } catch (err) {
    logger.error({ err, entityType, entityId, orgId }, 'comments.entityBelongsToOrg failed')
    return false
  }
}

const uuidSchema = z.string().uuid()

// ── GET /api/comments?entityType=control&entityId=xxx ─────────────────────────
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.badRequest('User must belong to an organization')

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')

  if (!entityType || !entityId) {
    return ApiErrors.badRequest('entityType and entityId are required')
  }
  if (!uuidSchema.safeParse(entityId).success) {
    return ApiErrors.badRequest('Invalid entityId')
  }

  if (!(await entityBelongsToOrg(entityType, entityId, session.orgId))) {
    return ApiErrors.notFound('Entity')
  }

  // Fetch top-level comments (no parent) ordered by creation time, scoped to org
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
        eq(comments.organizationId, session.orgId),
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
          eq(comments.organizationId, session.orgId),
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
const postSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  body: z.string().min(1),
  parentCommentId: z.string().uuid().optional().nullable(),
}).strict()

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  if (!session.orgId) {
    return ApiErrors.badRequest('User must belong to an organization')
  }

  let raw: unknown
  try { raw = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const parsed = postSchema.safeParse(raw)
  if (!parsed.success) return ApiErrors.badRequest(parsed.error.issues[0].message)

  const { entityType, entityId, body: commentBody, parentCommentId } = parsed.data
  if (!commentBody.trim()) return ApiErrors.badRequest('body is required')

  if (!(await entityBelongsToOrg(entityType, entityId, session.orgId))) {
    return ApiErrors.notFound('Entity')
  }

  // If replying, the parent comment must also be in the same org/entity.
  if (parentCommentId) {
    const [parent] = await db
      .select({ id: comments.id })
      .from(comments)
      .where(and(
        eq(comments.id, parentCommentId),
        eq(comments.organizationId, session.orgId),
        eq(comments.entityType, entityType),
        eq(comments.entityId, entityId),
      ))
      .limit(1)
    if (!parent) return ApiErrors.badRequest('Invalid parentCommentId')
  }

  // Create the comment — organizationId is FORCED from session.
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
    } catch (err) {
      // Don't fail the request if mention processing fails
      logger.warn({ err, commentId: created.id }, 'comments.mention-processing failed')
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
  if (!session.orgId) return ApiErrors.badRequest('User must belong to an organization')

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return ApiErrors.badRequest('Comment id is required as query param ?id=...')
  }
  if (!uuidSchema.safeParse(id).success) {
    return ApiErrors.badRequest('Invalid id')
  }

  const body = await req.json().catch(() => null) as { body?: string } | null
  const newBody = body?.body

  if (!newBody?.trim()) {
    return ApiErrors.badRequest('body is required')
  }

  // Verify authorship AND org match (C10)
  const [existing] = await db
    .select()
    .from(comments)
    .where(and(
      eq(comments.id, id),
      eq(comments.authorId, session.userId),
      eq(comments.organizationId, session.orgId),
    ))

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
    .where(and(
      eq(comments.id, id),
      eq(comments.authorId, session.userId),
      eq(comments.organizationId, session.orgId),
    ))
    .returning()

  return NextResponse.json({ comment: updated })
}

// ── DELETE /api/comments?id=xxx ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.badRequest('User must belong to an organization')

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return ApiErrors.badRequest('Comment id is required as query param ?id=...')
  }
  if (!uuidSchema.safeParse(id).success) {
    return ApiErrors.badRequest('Invalid id')
  }

  // Verify authorship AND org match (C10)
  const [existing] = await db
    .select()
    .from(comments)
    .where(and(
      eq(comments.id, id),
      eq(comments.authorId, session.userId),
      eq(comments.organizationId, session.orgId),
    ))

  if (!existing) {
    return ApiErrors.forbidden()
  }

  // Check if this comment has replies — scope reply check to same org.
  const replies = await db
    .select({ id: comments.id })
    .from(comments)
    .where(and(
      eq(comments.parentCommentId, id),
      eq(comments.organizationId, session.orgId),
    ))
    .limit(1)

  if (replies.length > 0) {
    // Soft delete: replace body with [deleted]
    await db
      .update(comments)
      .set({ body: '[deleted]', updatedAt: new Date() })
      .where(and(
        eq(comments.id, id),
        eq(comments.organizationId, session.orgId),
      ))
  } else {
    // Hard delete — log first
    const { logAudit } = await import('@/lib/audit/log')
    await logAudit({
      organizationId: session.orgId,
      userId: session.userId,
      action: 'comment.delete',
      entityType: 'comment',
      entityId: id,
      entityTitle: existing.body.slice(0, 100),
      before: existing,
      description: 'Deleted comment',
      request: req,
    })
    await db.delete(comments).where(and(
      eq(comments.id, id),
      eq(comments.organizationId, session.orgId),
    ))
  }

  return NextResponse.json({ ok: true })
}
