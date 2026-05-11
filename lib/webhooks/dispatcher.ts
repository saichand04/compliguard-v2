import crypto from 'crypto'
import { db } from '@/lib/db'
import { webhooks, webhookDeliveries } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { safeFetch, assertPublicUrl, stripCredentials, SsrfBlockedError } from '@/lib/security/ssrf-guard'

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
 *
 * SECURITY (H3):
 *  - Refuses to dispatch if `secret` is null (webhook creation MUST set one).
 *  - Validates the destination URL via the shared SSRF guard before each
 *    fetch (blocks RFC1918, loopback, link-local, cloud metadata, etc.).
 *  - Does NOT persist the response body to webhook_deliveries.responseBody —
 *    we keep only the HTTP status, length, and a tiny truncated preview.
 *  - Always strips credentials from the URL before storing or logging.
 */
async function deliverWithRetry(
  url: string,
  secret: string | null,
  event: WebhookEvent | 'ping',
  payload: WebhookPayload,
  webhookId: string,
  orgId: string
): Promise<void> {
  // H3: refuse to send if no secret is configured. Webhooks without signing
  // secrets are an exfil channel waiting to happen.
  if (!secret) {
    await db.insert(webhookDeliveries).values({
      webhookId,
      eventType: event,
      payload: payload as Record<string, unknown>,
      status: 'failed',
      responseStatus: 'no_secret',
      responseBody: 'Refused: webhook has no signing secret configured.',
      attempts: '0',
    })
    return
  }

  // H3: pre-validate URL before any I/O. Strip creds from anything we log.
  const sanitizedUrl = stripCredentials(url)
  try {
    await assertPublicUrl(url)
  } catch (err) {
    const reason = err instanceof SsrfBlockedError ? err.message : 'invalid url'
    console.warn(`[Webhook dispatch] Blocked outbound to ${sanitizedUrl}: ${reason}`)
    await db.insert(webhookDeliveries).values({
      webhookId,
      eventType: event,
      payload: payload as Record<string, unknown>,
      status: 'failed',
      responseStatus: 'blocked',
      responseBody: `Blocked by SSRF guard: ${reason}`.slice(0, 256),
      attempts: '0',
    })
    return
  }

  const body = JSON.stringify(payload)
  const maxAttempts = 3

  let lastResponseStatus: string | null = null
  let lastResponseSummary: string | null = null
  let delivered = false

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-CompliGuard-Event': event,
        'User-Agent': 'CompliGuard-Webhooks/1.0',
        'X-CompliGuard-Signature': signPayload(secret, body),
      }

      const response = await safeFetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000), // 10s timeout
      })

      lastResponseStatus = String(response.status)

      // Read at most 256 bytes of the response so a malicious endpoint can't
      // bloat our deliveries table. We don't keep the body in full.
      const previewText = await response.text().catch(() => '')
      const truncated = previewText.slice(0, 256)
      lastResponseSummary = `len=${previewText.length} preview=${truncated.replace(/\s+/g, ' ')}`

      if (response.ok) {
        delivered = true
        await db.insert(webhookDeliveries).values({
          webhookId,
          eventType: event,
          payload: payload as Record<string, unknown>,
          status: 'delivered',
          responseStatus: lastResponseStatus,
          // Persist only the truncated, metadata-style summary — NOT the full body.
          responseBody: lastResponseSummary.slice(0, 256),
          attempts: String(attempt),
          deliveredAt: new Date(),
        })

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
      // Non-2xx → retry
    } catch (err) {
      // SSRF block in the middle of the loop should not be retried.
      if (err instanceof SsrfBlockedError) {
        lastResponseStatus = 'blocked'
        lastResponseSummary = `Blocked: ${err.message}`
        break
      }
      lastResponseStatus = 'error'
      lastResponseSummary = 'Connection failed or timeout'
    }

    if (attempt < maxAttempts) {
      await sleep(Math.pow(2, attempt - 1) * 1000)
    }
  }

  // All attempts failed
  if (!delivered) {
    await db.insert(webhookDeliveries).values({
      webhookId,
      eventType: event,
      payload: payload as Record<string, unknown>,
      status: 'failed',
      responseStatus: lastResponseStatus,
      responseBody: lastResponseSummary?.slice(0, 256) ?? null,
      attempts: String(maxAttempts),
    })

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
