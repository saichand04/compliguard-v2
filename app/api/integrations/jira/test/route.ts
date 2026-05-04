/**
 * app/api/integrations/jira/test/route.ts
 * POST — Test Jira connection and fetch projects + issue types.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { getIntegrationConfig } from '@/lib/integrations/store'
import { listJiraProjects, listJiraIssueTypes, type JiraConfig } from '@/lib/integrations/jira'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  const body = await req.json() as Partial<JiraConfig>

  let config: JiraConfig

  if (body.email && body.apiToken && body.subdomain && body.projectKey) {
    // Testing with freshly-entered credentials
    config = {
      email: body.email,
      apiToken: body.apiToken,
      subdomain: body.subdomain,
      projectKey: body.projectKey,
      findingIssuetype: body.findingIssuetype,
    }
  } else {
    // Use stored config
    const raw = await getIntegrationConfig(session.orgId, 'jira')
    if (!raw?.email || !raw?.apiToken || !raw?.subdomain) {
      return ApiErrors.badRequest('Jira integration not configured')
    }
    config = {
      email: raw.email,
      apiToken: raw.apiToken,
      subdomain: raw.subdomain,
      projectKey: raw.projectKey || '',
      findingIssuetype: raw.findingIssuetype,
    }
  }

  try {
    const [projects, issueTypes] = await Promise.all([
      listJiraProjects(config),
      config.projectKey
        ? listJiraIssueTypes(config, config.projectKey)
        : Promise.resolve([]),
    ])

    return NextResponse.json({ ok: true, projects, issueTypes })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
