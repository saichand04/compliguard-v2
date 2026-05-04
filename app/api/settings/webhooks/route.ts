import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { webhooks } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

/**
 * GET /api/settings/webhooks
 * List all webhooks for the organization.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const rows = await db
    .select({
      id: webhooks.id,
      name: webhooks.name,
      url: webhooks.url,
      events: webhooks.events,
      status: webhooks.status,
      consecutiveFailures: webhooks.consecutiveFailures,
      lastDeliveryAt: webhooks.lastDeliveryAt,
      lastSuccessAt: webhooks.lastSuccessAt,
      createdAt: webhooks.createdAt,
      updatedAt: webhooks.updatedAt,
    })
    .from(webhooks)
    .where(eq(webhooks.organizationId, session.orgId))
    .orderBy(desc(webhooks.createdAt))

  return NextResponse.json({ webhooks: rows })
}

/**
 * POST /api/settings/webhooks
 * Create a new webhook.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: { name: string; url: string; events: string[]; secret?: string }
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  if (!body.name) return ApiErrors.badRequest('name is required')
  if (!body.url) return ApiErrors.badRequest('url is required')
  if (!body.url.startsWith('https://')) return ApiErrors.badRequest('url must use HTTPS')
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return ApiErrors.badRequest('events must be a non-empty array')
  }

  const secret = body.secret ?? crypto.randomBytes(32).toString('hex')

  const [webhook] = await db.insert(webhooks).values({
    organizationId: session.orgId,
    createdBy: session.userId,
    name: body.name,
    url: body.url,
    secret,
    events: body.events,
    status: 'active',
  }).returning({
    id: webhooks.id,
    name: webhooks.name,
    url: webhooks.url,
    events: webhooks.events,
    status: webhooks.status,
    createdAt: webhooks.createdAt,
  })

  return NextResponse.json({ webhook, secret }, { status: 201 })
}
