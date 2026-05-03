import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'
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
    .orderBy(notifications.createdAt)
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
    for (const id of body.ids) {
      await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(notifications.id, id), eq(notifications.userId, session.userId)))
    }
  }

  return NextResponse.json({ ok: true })
}
