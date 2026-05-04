/**
 * POST /api/teams/check-overdue
 *
 * Checks for overdue tasks in the authenticated user's org and sends
 * Teams reminder notifications for any that haven't been notified in 24 h.
 *
 * Can be called by a cron job (e.g., Vercel Cron) or an admin manually.
 *
 * Returns: { tasksChecked: number, notificationsSent: number }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-helper'
import { checkAndNotifyOverdueTasks } from '@/lib/teams/hooks'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Auth check — require an active session with orgId
    const session = await requireAuth(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = session.orgId!
    if (!orgId) {
      return NextResponse.json({ error: 'No organization associated with session' }, { status: 400 })
    }

    // Only admins may trigger this endpoint
    const role = session.role
    if (role && role !== 'admin' && role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }

    const { tasksChecked, notificationsSent } = await checkAndNotifyOverdueTasks(orgId)

    return NextResponse.json({ tasksChecked, notificationsSent }, { status: 200 })
  } catch (err) {
    console.error('[Teams Check-Overdue] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
