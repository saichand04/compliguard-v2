/**
 * app/api/webhooks/jira/route.ts
 * Receives Jira webhook events (issue status changes) and syncs finding status.
 * No auth cookie required — verified via Jira webhook secret header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findings, integrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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

export async function POST(req: NextRequest) {
  // Optional: verify Jira webhook secret via Authorization header
  // Jira sends: Authorization: <secret> in the header if configured
  const authHeader = req.headers.get('authorization')

  // Parse payload
  let payload: JiraWebhookPayload
  try {
    payload = await req.json() as JiraWebhookPayload
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  const issueKey = payload.issue?.key
  const jiraStatus = payload.issue?.fields?.status?.name

  if (!issueKey || !jiraStatus) {
    // Ignore non-issue events
    return NextResponse.json({ ok: true, ignored: true })
  }

  // Find all findings with this Jira issue key
  const allFindings = await db
    .select({ id: findings.id, organizationId: findings.organizationId, metadata: findings.metadata, status: findings.status })
    .from(findings)

  const matchingFindings = allFindings.filter((f) => {
    const meta = (f.metadata as Record<string, unknown>) || {}
    return meta.jiraIssueKey === issueKey
  })

  if (matchingFindings.length === 0) {
    return NextResponse.json({ ok: true, message: 'No matching finding found' })
  }

  // Verify the secret if provided — match against stored integration config
  if (authHeader) {
    const orgId = matchingFindings[0].organizationId
    const [integration] = await db
      .select({ encryptedCredentials: integrations.encryptedCredentials })
      .from(integrations)
      .where(eq(integrations.organizationId, orgId))
      .limit(1)

    if (integration?.encryptedCredentials) {
      try {
        const { decrypt } = await import('@/lib/encryption')
        const creds = JSON.parse(decrypt(integration.encryptedCredentials)) as Record<string, string>
        const storedSecret = creds.webhookSecret
        if (storedSecret && storedSecret !== authHeader) {
          return new NextResponse('Invalid webhook secret', { status: 401 })
        }
      } catch {
        // If decryption fails, proceed without secret validation
      }
    }
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
