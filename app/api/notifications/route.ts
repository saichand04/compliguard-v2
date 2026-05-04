import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { eq, and, count, desc, inArray } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

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

/**
 * PATCH /api/notifications
 * Mark notifications as read.
 * Body: { ids: string[] } or { all: true }
 */
export async function PATCH(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const body = await req.json()

  if (body.all === true) {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, session.userId), eq(notifications.isRead, false)))
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
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

/**
 * POST /api/notifications
 * Create a notification (internal use / seeding / testing).
 * Body matches notifications schema fields.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  // Only admins can create notifications via API (for seeding)
  if (!['admin', 'super_admin'].includes(session.role)) {
    return ApiErrors.forbidden()
  }

  const body = await req.json()

  const { type, title, body: notifBody, link, userId, organizationId, metadata } = body

  if (!type || !title || !userId || !organizationId) {
    return ApiErrors.badRequest('type, title, userId, and organizationId are required')
  }

  const [created] = await db
    .insert(notifications)
    .values({
      type,
      title,
      body: notifBody,
      link,
      userId,
      organizationId,
      metadata,
      isRead: false,
    })
    .returning()

  return NextResponse.json({ notification: created }, { status: 201 })
}
