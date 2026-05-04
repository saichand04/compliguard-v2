import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { webhooks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { sendTestWebhook } from '@/lib/webhooks/dispatcher'

/**
 * POST /api/settings/webhooks/[id]/test
 * Send a test ping to the webhook endpoint.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [webhook] = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, session.orgId)))
    .limit(1)

  if (!webhook) return ApiErrors.notFound('Webhook')

  try {
    await sendTestWebhook(id, session.orgId)
    return NextResponse.json({ success: true, message: 'Test ping sent' })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to send test ping' }, { status: 500 })
  }
}
