import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { webhooks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

/**
 * GET /api/settings/webhooks/[id]
 * Get a specific webhook (includes secret for editing).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, session.orgId)))
    .limit(1)

  if (!webhook) return ApiErrors.notFound('Webhook')

  return NextResponse.json({ webhook })
}

/**
 * PATCH /api/settings/webhooks/[id]
 * Update a webhook's name, url, events, status, or secret.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [existing] = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, session.orgId)))
    .limit(1)

  if (!existing) return ApiErrors.notFound('Webhook')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (body.name !== undefined) updateData.name = body.name
  if (body.url !== undefined) {
    if (typeof body.url === 'string' && !body.url.startsWith('https://')) {
      return ApiErrors.badRequest('url must use HTTPS')
    }
    updateData.url = body.url
  }
  if (body.events !== undefined) updateData.events = body.events
  if (body.status !== undefined) updateData.status = body.status
  if (body.secret !== undefined) updateData.secret = body.secret

  const [updated] = await db
    .update(webhooks)
    .set(updateData)
    .where(eq(webhooks.id, id))
    .returning()

  return NextResponse.json({ webhook: updated })
}

/**
 * DELETE /api/settings/webhooks/[id]
 * Delete a webhook.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [existing] = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, session.orgId)))
    .limit(1)

  if (!existing) return ApiErrors.notFound('Webhook')

  await db.delete(webhooks).where(eq(webhooks.id, id))

  return NextResponse.json({ success: true, message: 'Webhook deleted' })
}
