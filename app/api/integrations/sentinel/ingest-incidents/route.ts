/**
 * app/api/integrations/sentinel/ingest-incidents/route.ts
 * POST — pull Sentinel incidents → create findings + audit log entries.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { findings } from '@/lib/db/schema'
import { fetchSentinelIncidents } from '@/lib/microsoft/sentinel'
import { getSentinelConfig } from '@/app/api/integrations/sentinel/route'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  const config = await getSentinelConfig(session.orgId!)
  if (!config) {
    return ApiErrors.badRequest('Sentinel integration not configured.')
  }

  let incidents
  try {
    incidents = await fetchSentinelIncidents(config)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch incidents'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }

  // Filter open high/critical incidents
  const toIngest = incidents.filter(
    (i) =>
      (i.properties?.status === 'New' || i.properties?.status === 'Active') &&
      (i.properties?.severity === 'High' || i.properties?.severity === 'Medium'),
  )

  const ingested: string[] = []

  for (const incident of toIngest) {
    const props = incident.properties ?? {}
    const sevRaw = props.severity?.toLowerCase() ?? 'medium'
    const mappedSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info' =
      sevRaw === 'high' ? 'critical' : 'high'

    const tactics = props.additionalData?.tactics ?? []
    const title = props.title ?? incident.name

    const [inserted] = await db.insert(findings).values({
      organizationId: session.orgId!,
      title: `[Sentinel] ${title}`,
      description: `Sentinel incident: ${title}. Severity: ${props.severity ?? 'Unknown'}. Tactics: ${tactics.join(', ') || 'N/A'}`,
      severity: mappedSeverity,
      status: 'open',
      source: 'integration',
      resourceType: 'sentinel_incident',
      resourceId: incident.name,
      remediationGuidance: 'Investigate in Azure Sentinel and assign to an analyst for triage.',
      rawData: {
        incidentId: incident.name,
        status: props.status,
        severity: props.severity,
        tactics,
        owner: props.owner,
        createdTimeUtc: props.createdTimeUtc,
        lastModifiedTimeUtc: props.lastModifiedTimeUtc,
      },
    }).returning({ id: findings.id })

    ingested.push(inserted.id)

    // Create audit log entry for each ingested incident
    await writeAuditLog({
      organizationId: session.orgId!,
      userId: session.userId,
      action: 'sentinel_incident_ingested',
      resourceType: 'security_incident',
      resourceId: inserted.id,
      resourceTitle: title,
      description: `Sentinel incident ingested as finding: ${title}`,
      after: {
        severity: props.severity,
        tactics,
        assignee: props.owner?.assignedTo ?? null,
        status: props.status,
      },
      request: req,
    })
  }

  return NextResponse.json({
    ok: true,
    ingested: ingested.length,
    total: incidents.length,
    findingIds: ingested,
  })
}
