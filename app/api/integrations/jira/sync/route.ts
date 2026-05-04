/**
 * app/api/integrations/jira/sync/route.ts
 * POST — Sync all open findings from Jira (update statuses).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { getIntegrationConfig } from '@/lib/integrations/store'
import { getJiraIssueStatus, jiraStatusToFindingStatus, type JiraConfig } from '@/lib/integrations/jira'
import { db } from '@/lib/db'
import { findings, integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  const orgId = session.orgId

  const raw = await getIntegrationConfig(orgId, 'jira')
  if (!raw?.email || !raw?.apiToken || !raw?.subdomain) {
    return ApiErrors.badRequest('Jira integration not configured')
  }

  const config: JiraConfig = {
    email: raw.email,
    apiToken: raw.apiToken,
    subdomain: raw.subdomain,
    projectKey: raw.projectKey || '',
    findingIssuetype: raw.findingIssuetype,
  }

  // Get all findings with a linked Jira issue
  const allFindings = await db
    .select({ id: findings.id, status: findings.status, metadata: findings.metadata })
    .from(findings)
    .where(eq(findings.organizationId, orgId))

  const linkedFindings = allFindings.filter(
    (f) => (f.metadata as Record<string, unknown>)?.jiraIssueKey,
  )

  let synced = 0
  let errors = 0

  for (const finding of linkedFindings) {
    const meta = finding.metadata as Record<string, unknown>
    const issueKey = meta.jiraIssueKey as string

    try {
      const jiraStatus = await getJiraIssueStatus(config, issueKey)
      const newStatus = jiraStatusToFindingStatus(jiraStatus)

      if (newStatus !== finding.status) {
        await db
          .update(findings)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(findings.id, finding.id))
      }
      synced++
    } catch {
      errors++
    }
  }

  // Update lastSyncAt
  await db
    .update(integrations)
    .set({ lastSyncAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, 'jira'),
      ),
    )

  return NextResponse.json({ ok: true, synced, errors, total: linkedFindings.length })
}
