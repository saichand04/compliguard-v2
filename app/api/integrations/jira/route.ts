/**
 * app/api/integrations/jira/route.ts
 * GET / POST / DELETE Jira integration config.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import {
  getIntegrationRow,
  saveIntegrationConfig,
  deleteIntegration,
} from '@/lib/integrations/store'
import { db } from '@/lib/db'
import { findings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// GET /api/integrations/jira
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const row = await getIntegrationRow(session.orgId, 'jira')
  if (!row) return NextResponse.json({ connected: false })

  const cfg = (row.config as Record<string, unknown>) || {}

  // Count linked findings (those with jiraIssueKey in metadata)
  const allFindings = await db
    .select({ metadata: findings.metadata })
    .from(findings)
    .where(eq(findings.organizationId, session.orgId))

  const linkedCount = allFindings.filter(
    (f) => (f.metadata as Record<string, unknown>)?.jiraIssueKey,
  ).length

  return NextResponse.json({
    connected: row.status === 'active',
    status: row.status,
    lastSyncAt: row.lastSyncAt,
    subdomain: cfg.subdomain ?? '',
    projectKey: cfg.projectKey ?? '',
    findingIssuetype: cfg.findingIssuetype ?? 'Bug',
    linkedFindings: linkedCount,
    // email and apiToken are never returned
  })
}

// POST /api/integrations/jira — save config
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  const body = await req.json() as {
    email?: string
    apiToken?: string
    subdomain?: string
    projectKey?: string
    findingIssuetype?: string
  }

  if (!body.email || !body.apiToken || !body.subdomain || !body.projectKey) {
    return ApiErrors.badRequest('email, apiToken, subdomain, and projectKey are required')
  }

  const config: Record<string, string> = {
    email: body.email,
    apiToken: body.apiToken,
    subdomain: body.subdomain,
    projectKey: body.projectKey,
    findingIssuetype: body.findingIssuetype || 'Bug',
  }

  await saveIntegrationConfig(
    session.orgId,
    'jira',
    'Jira',
    config,
    ['apiToken'],
  )

  return NextResponse.json({ ok: true })
}

// DELETE /api/integrations/jira
export async function DELETE(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  await deleteIntegration(session.orgId, 'jira')
  return NextResponse.json({ ok: true })
}
