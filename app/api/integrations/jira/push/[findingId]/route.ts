/**
 * app/api/integrations/jira/push/[findingId]/route.ts
 * POST — Push a single finding to Jira as a new issue.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { getIntegrationConfig } from '@/lib/integrations/store'
import { createJiraIssue, type JiraConfig } from '@/lib/integrations/jira'
import { db } from '@/lib/db'
import { findings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ findingId: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  const { findingId } = await params
  const orgId = session.orgId

  // Load Jira config
  const raw = await getIntegrationConfig(orgId, 'jira')
  if (!raw?.email || !raw?.apiToken || !raw?.subdomain || !raw?.projectKey) {
    return ApiErrors.badRequest('Jira integration not configured')
  }

  const config: JiraConfig = {
    email: raw.email,
    apiToken: raw.apiToken,
    subdomain: raw.subdomain,
    projectKey: raw.projectKey,
    findingIssuetype: raw.findingIssuetype,
  }

  // Load the finding
  const [finding] = await db
    .select()
    .from(findings)
    .where(
      and(
        eq(findings.id, findingId),
        eq(findings.organizationId, orgId),
      ),
    )
    .limit(1)

  if (!finding) return ApiErrors.notFound('Finding')

  // Check if already linked
  const existingMeta = (finding.metadata as Record<string, unknown>) || {}
  if (existingMeta.jiraIssueKey) {
    return NextResponse.json({
      ok: false,
      error: 'Finding already linked to Jira',
      issueKey: existingMeta.jiraIssueKey,
      issueUrl: existingMeta.jiraUrl,
    }, { status: 400 })
  }

  try {
    const { issueKey, issueUrl } = await createJiraIssue(config, {
      id: finding.id,
      title: finding.title,
      description: finding.description || '',
      severity: finding.severity,
      source: finding.source,
      cveId: finding.cveId || undefined,
      remediation: finding.remediationGuidance || undefined,
    })

    // Update finding metadata with Jira issue key
    const newMeta = { ...existingMeta, jiraIssueKey: issueKey, jiraUrl: issueUrl }
    await db
      .update(findings)
      .set({ metadata: newMeta, updatedAt: new Date() })
      .where(eq(findings.id, finding.id))

    return NextResponse.json({ ok: true, issueKey, issueUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create Jira issue'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
