import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { webhooks, webhookDeliveries } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

/**
 * GET /api/settings/webhooks/[id]/deliveries
 * List the last 20 delivery attempts for a webhook.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  // Verify ownership
  const [webhook] = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, session.orgId)))
    .limit(1)

  if (!webhook) return ApiErrors.notFound('Webhook')

  const deliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, id))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(20)

  return NextResponse.json({ deliveries })
}

/**
 * POST /api/settings/webhooks/[id]/deliveries
 * Retry a specific failed delivery.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  // Verify ownership
  const [webhook] = await db
    .select({ id: webhooks.id, url: webhooks.url, secret: webhooks.secret })
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, session.orgId)))
    .limit(1)

  if (!webhook) return ApiErrors.notFound('Webhook')

  let body: { deliveryId: string }
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.id, body.deliveryId), eq(webhookDeliveries.webhookId, id)))
    .limit(1)

  if (!delivery) return ApiErrors.notFound('Delivery')

  // Mark as retrying
  await db
    .update(webhookDeliveries)
    .set({ status: 'retrying' })
    .where(eq(webhookDeliveries.id, delivery.id))

  // Fire and forget the retry
  const { sendTestWebhook } = await import('@/lib/webhooks/dispatcher')
  sendTestWebhook(id, session.orgId!).catch(() => {/* ignore */})

  return NextResponse.json({ success: true, message: 'Retry initiated' })
}
