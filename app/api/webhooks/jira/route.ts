/**
 * app/api/webhooks/jira/route.ts
 * Receives Jira webhook events (issue status changes) and syncs finding status.
 * No auth cookie required — verified via Jira webhook secret header.
 *
 * SECURITY (C9):
 *   - Authorization header is mandatory; we 401 if absent.
 *   - Validation uses crypto.timingSafeEqual after an equal-length precheck.
 *   - Auth runs BEFORE any DB scan so unauthenticated callers cannot DoS the DB.
 *   - If we cannot decrypt the integration's stored secret we fail closed (500).
 *   - Only the documented set of webhookEvent values is processed.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { findings, integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { jiraStatusToFindingStatus } from '@/lib/integrations/jira'

interface JiraWebhookPayload {
  webhookEvent?: string
  issue?: {
    key?: string
    fields?: {
      status?: {
        name?: string
      }
    }
  }
}

const ALLOWED_WEBHOOK_EVENTS = new Set<string>([
  'jira:issue_created',
  'jira:issue_updated',
  'jira:issue_deleted',
])

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
  // C9: require Authorization header up-front, before any DB I/O.
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return new NextResponse('Authorization required', { status: 401 })
  }

  // Parse payload
  let payload: JiraWebhookPayload
  try {
    payload = (await req.json()) as JiraWebhookPayload
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  const event = payload.webhookEvent
  if (!event || !ALLOWED_WEBHOOK_EVENTS.has(event)) {
    return new NextResponse('Unsupported webhookEvent', { status: 400 })
  }

  const issueKey = payload.issue?.key
  const jiraStatus = payload.issue?.fields?.status?.name

  if (!issueKey || !jiraStatus) {
    // Auth was good, payload is just not actionable.
    return NextResponse.json({ ok: true, ignored: true })
  }

  // Find findings with this Jira issue key (we still need this to know which
  // org's integration to validate against). The scan is gated behind the
  // Authorization-required check above.
  const allFindings = await db
    .select({
      id: findings.id,
      organizationId: findings.organizationId,
      metadata: findings.metadata,
      status: findings.status,
    })
    .from(findings)

  const matchingFindings = allFindings.filter((f) => {
    const meta = (f.metadata as Record<string, unknown>) || {}
    return meta.jiraIssueKey === issueKey
  })

  if (matchingFindings.length === 0) {
    return NextResponse.json({ ok: true, message: 'No matching finding found' })
  }

  // Validate the secret. Each finding row carries an organizationId; we look
  // up the Jira integration for that org, decrypt its stored secret, and
  // timing-safe compare to the inbound header. Any decryption failure fails
  // closed with a 500 (we refuse to proceed without validation).
  const orgId = matchingFindings[0].organizationId

  const [integration] = await db
    .select({ encryptedCredentials: integrations.encryptedCredentials })
    .from(integrations)
    .where(and(eq(integrations.organizationId, orgId), eq(integrations.type, 'jira')))
    .limit(1)

  if (!integration?.encryptedCredentials) {
    return new NextResponse('Jira integration not configured for org', { status: 401 })
  }

  let storedSecret: string | undefined
  try {
    const { decrypt } = await import('@/lib/encryption')
    const creds = JSON.parse(decrypt(integration.encryptedCredentials)) as Record<string, string>
    storedSecret = creds.webhookSecret
  } catch (err) {
    console.error('[Jira webhook] Failed to decrypt integration secret — failing closed', err)
    return new NextResponse('Integration secret unavailable', { status: 500 })
  }

  if (!storedSecret) {
    // No secret configured — refuse to process.
    return new NextResponse('Jira integration missing webhookSecret', { status: 401 })
  }

  if (!timingSafeEqualStrings(storedSecret, authHeader)) {
    return new NextResponse('Invalid webhook secret', { status: 401 })
  }

  const newStatus = jiraStatusToFindingStatus(jiraStatus)
  let updated = 0

  for (const finding of matchingFindings) {
    if (finding.status !== newStatus) {
      await db
        .update(findings)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(findings.id, finding.id))
      updated++
    }
  }

  return NextResponse.json({
    ok: true,
    issueKey,
    jiraStatus,
    findingStatus: newStatus,
    updated,
  })
}
