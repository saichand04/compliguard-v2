import crypto from 'crypto'
import { db } from '@/lib/db'
import { webhooks, webhookDeliveries } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export type WebhookEvent =
  | 'finding.created'
  | 'finding.updated'
  | 'finding.resolved'
  | 'evidence.uploaded'
  | 'evidence.approved'
  | 'task.created'
  | 'task.completed'
  | 'control.status_changed'
  | 'scan.completed'
  | 'questionnaire.completed'

export interface WebhookPayload {
  event: WebhookEvent | 'ping'
  timestamp: string       // ISO 8601
  organizationId: string
  data: unknown           // event-specific data
  [key: string]: unknown  // index signature for JSON serialization
}

/**
 * Sign payload with HMAC-SHA256 secret.
 * Format: sha256={hex}
 */
function signPayload(secret: string, body: string): string {
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return `sha256=${hmac}`
}

/**
 * Sleep helper for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Deliver a webhook payload to a single endpoint with retry.
 * Returns the delivery result.
 */
async function deliverWithRetry(
  url: string,
  secret: string | null,
  event: WebhookEvent | 'ping',
  payload: WebhookPayload,
  webhookId: string,
  orgId: string
): Promise<void> {
  const body = JSON.stringify(payload)
  const maxAttempts = 3

  let lastResponseStatus: string | null = null
  let lastResponseBody: string | null = null
  let delivered = false
  const startTime = Date.now()

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptStart = Date.now()
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-CompliGuard-Event': event,
        'User-Agent': 'CompliGuard-Webhooks/1.0',
      }

      if (secret) {
        headers['X-CompliGuard-Signature'] = signPayload(secret, body)
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000), // 10s timeout
      })

      lastResponseStatus = String(response.status)
      lastResponseBody = await response.text().catch(() => '')
      const duration = Date.now() - attemptStart

      if (response.ok) {
        delivered = true
        // Record successful delivery
        await db.insert(webhookDeliveries).values({
          webhookId,
          eventType: event,
          payload: payload as Record<string, unknown>,
          status: 'delivered',
          responseStatus: lastResponseStatus,
          responseBody: lastResponseBody?.slice(0, 4000) ?? null,
          attempts: String(attempt),
          deliveredAt: new Date(),
        })

        // Update webhook lastDeliveryAt and lastSuccessAt
        await db.update(webhooks)
          .set({
            lastDeliveryAt: new Date(),
            lastSuccessAt: new Date(),
            consecutiveFailures: '0',
            status: 'active',
          })
          .where(eq(webhooks.id, webhookId))

        return
      }

      // Non-2xx response — will retry
    } catch {
      lastResponseStatus = 'error'
      lastResponseBody = 'Connection failed or timeout'
    }

    if (attempt < maxAttempts) {
      // Exponential backoff: 1s, 2s
      await sleep(Math.pow(2, attempt - 1) * 1000)
    }
  }

  // All attempts failed
  const duration = Date.now() - startTime
  await db.insert(webhookDeliveries).values({
    webhookId,
    eventType: event,
    payload: payload as Record<string, unknown>,
    status: 'failed',
    responseStatus: lastResponseStatus,
    responseBody: lastResponseBody?.slice(0, 4000) ?? null,
    attempts: String(maxAttempts),
  })

  // Increment consecutive failures and potentially mark webhook as failing
  const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).limit(1)
  if (webhook) {
    const failures = parseInt(webhook.consecutiveFailures ?? '0') + 1
    await db.update(webhooks)
      .set({
        consecutiveFailures: String(failures),
        lastDeliveryAt: new Date(),
        status: failures >= 3 ? 'failing' : webhook.status,
      })
      .where(eq(webhooks.id, webhookId))
  }
}

/**
 * Dispatch an event to all registered webhooks for the org.
 */
export async function dispatchWebhookEvent(
  orgId: string,
  event: WebhookEvent,
  data: unknown
): Promise<void> {
  // Get all active webhooks for org
  const activeWebhooks = await db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.organizationId, orgId),
        eq(webhooks.status, 'active')
      )
    )

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    organizationId: orgId,
    data,
  }

  // Deliver to each webhook that subscribes to this event
  const deliveries: Promise<void>[] = []
  for (const webhook of activeWebhooks) {
    const events = Array.isArray(webhook.events) ? (webhook.events as string[]) : []
    if (!events.includes(event) && !events.includes('*')) continue

    deliveries.push(
      deliverWithRetry(
        webhook.url,
        webhook.secret,
        event,
        payload,
        webhook.id,
        orgId
      ).catch(() => {/* swallow individual failures */})
    )
  }

  // Fire all in parallel
  await Promise.all(deliveries)
}

/**
 * Send a test ping to a specific webhook.
 */
export async function sendTestWebhook(webhookId: string, orgId: string): Promise<void> {
  const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).limit(1)
  if (!webhook || webhook.organizationId !== orgId) return

  const payload: WebhookPayload = {
    event: 'ping',
    timestamp: new Date().toISOString(),
    organizationId: orgId,
    data: { message: 'Test ping from CompliGuard' },
  }

  await deliverWithRetry(
    webhook.url,
    webhook.secret,
    'ping',
    payload,
    webhook.id,
    orgId
  )
}
