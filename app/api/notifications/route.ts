import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifications, users } from '@/lib/db/schema'
import { eq, and, count, desc, inArray } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { logger } from '@/lib/logger'
import { z } from 'zod'

/**
 * GET /api/notifications
 * List notifications for the current user with unread count.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const userNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, session.userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50)

  const [unreadRow] = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, session.userId), eq(notifications.isRead, false)))

  return NextResponse.json({
    notifications: userNotifications,
    unreadCount: unreadRow?.count || 0,
  })
}

// (C13) Mark-as-read body schema: { all: true } OR { ids: uuid[] }
const patchSchema = z.object({
  all: z.boolean().optional(),
  ids: z.array(z.string().uuid()).optional(),
}).strict()

/**
 * PATCH /api/notifications
 * Mark notifications as read.
 */
export async function PATCH(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  let raw: unknown
  try { raw = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) return ApiErrors.badRequest(parsed.error.issues[0].message)
  const body = parsed.data

  if (body.all === true) {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, session.userId), eq(notifications.isRead, false)))
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    // The WHERE already restricts to session.userId, so callers cannot
    // affect another user's rows even if they pass arbitrary ids (C13).
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, session.userId),
          inArray(notifications.id, body.ids)
        )
      )
  } else {
    return ApiErrors.badRequest('Provide { ids: string[] } or { all: true }')
  }

  return NextResponse.json({ ok: true })
}

// (C13) POST schema — strict, no organizationId from body.
const postSchema = z.object({
  type: z.enum([
    'control_overdue', 'evidence_rejected', 'evidence_approved',
    'evidence_request', 'new_finding', 'policy_expiry',
    'task_assigned', 'task_overdue', 'risk_identified',
    'vendor_review_due', 'system', 'mention', 'invite',
  ]),
  title: z.string().min(1).max(500),
  body: z.string().optional(),
  link: z.string().max(1000).optional(),
  userId: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict()

/**
 * POST /api/notifications
 * Create a notification (internal use / seeding / testing).
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.badRequest('User must belong to an organization')

  // Only admins can create notifications via API (for seeding)
  if (!['admin', 'super_admin'].includes(session.role)) {
    return ApiErrors.forbidden()
  }

  let raw: unknown
  try { raw = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const parsed = postSchema.safeParse(raw)
  if (!parsed.success) return ApiErrors.badRequest(parsed.error.issues[0].message)
  const data = parsed.data

  // (C13) Validate the target userId belongs to caller's org. Refuse otherwise.
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, data.userId), eq(users.organizationId, session.orgId)))
    .limit(1)
  if (!target) return ApiErrors.badRequest('Invalid userId for this organization')

  try {
    const [created] = await db
      .insert(notifications)
      .values({
        type: data.type,
        title: data.title,
        body: data.body,
        link: data.link,
        userId: data.userId,
        // organizationId is FORCED from session.
        organizationId: session.orgId,
        metadata: data.metadata,
        isRead: false,
      })
      .returning()

    return NextResponse.json({ notification: created }, { status: 201 })
  } catch (err) {
    logger.error({ err }, 'notifications.create failed')
    return ApiErrors.internal()
  }
}
