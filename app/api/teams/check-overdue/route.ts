/**
 * POST /api/teams/check-overdue
 *
 * Checks for overdue tasks in an org and sends Teams reminder notifications
 * for any that haven't been notified in 24h.
 *
 * Authentication contract:
 *   - If the `x-cron-secret` request header is present, it is compared to
 *     `process.env.CRON_SECRET` via `crypto.timingSafeEqual`. On match the
 *     caller may pass `orgId` in the request body and the session check is
 *     skipped. If `CRON_SECRET` is unset the cron path is disabled.
 *   - Otherwise the caller must have an authenticated admin/owner session
 *     and `orgId` is taken from the session.
 *
 * Returns: { tasksChecked: number, notificationsSent: number }
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireAuth } from '@/lib/api/auth-helper'
import { checkAndNotifyOverdueTasks } from '@/lib/teams/hooks'

export const dynamic = 'force-dynamic'

function timingSafeEqualStrings(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  try {
    return crypto.timingSafeEqual(ab, bb)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const cronSecretHeader = req.headers.get('x-cron-secret')
    const envCronSecret = process.env.CRON_SECRET

    // Read body once — we may need orgId from it on the cron path.
    let body: { orgId?: string } = {}
    try {
      body = (await req.json()) as { orgId?: string }
    } catch {
      // empty body OK
    }

    let orgId: string | undefined

    if (cronSecretHeader) {
      // Cron-secret path: validate, then pull orgId from body.
      if (!envCronSecret) {
        return NextResponse.json({ error: 'Cron auth disabled (CRON_SECRET unset)' }, { status: 401 })
      }
      if (!timingSafeEqualStrings(cronSecretHeader, envCronSecret)) {
        return NextResponse.json({ error: 'Invalid cron secret' }, { status: 401 })
      }
      orgId = body.orgId
      if (!orgId) {
        return NextResponse.json({ error: 'orgId is required with cron auth' }, { status: 400 })
      }
    } else {
      // Session auth path — admin/owner only.
      const session = await requireAuth(req)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      orgId = session.orgId ?? undefined
      if (!orgId) {
        return NextResponse.json({ error: 'No organization associated with session' }, { status: 400 })
      }
      const role = session.role
      if (role && role !== 'admin' && role !== 'super_admin') {
        return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
      }
    }

    const { tasksChecked, notificationsSent } = await checkAndNotifyOverdueTasks(orgId)

    return NextResponse.json({ tasksChecked, notificationsSent }, { status: 200 })
  } catch (err) {
    console.error('[Teams Check-Overdue] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
