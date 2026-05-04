/**
 * app/api/integrations/sentinel/enrich-incidents/route.ts
 * POST — Re-enrich all existing Sentinel findings with latest MITRE data.
 * GET  — Fetch enriched incidents + audit trail for XDR advanced page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { findings, auditLogs } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { reEnrichAllIncidents } from '@/lib/microsoft/sentinel-enriched'
import { getSentinelConfig } from '@/app/api/integrations/sentinel/route'
import {
  syncThreatIndicators,
  storeThreatIndicators,
  getTiSummary,
} from '@/lib/microsoft/threat-intel'

// POST — Re-enrich all incidents
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  try {
    const result = await reEnrichAllIncidents(session.orgId!)
    return NextResponse.json({
      ok: true,
      enriched: result.enriched,
      errors: result.errors,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Enrichment failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// GET — Fetch enriched incidents + audit trail + TI summary
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!

  // Fetch azure findings with MITRE metadata
  const enrichedFindings = await db
    .select()
    .from(findings)
    .where(
      and(
        eq(findings.organizationId, orgId),
        eq(findings.source, 'azure'),
      ),
    )
    .orderBy(desc(findings.createdAt))
    .limit(50)

  // Fetch audit log entries for sentinel incidents
  const auditEntries = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, orgId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(20)

  const sentinelAuditEntries = auditEntries.filter(
    (e) => e.action === 'sentinel.incident.ingested' || e.action === 'sentinel_incident_ingested',
  )

  // Compute MITRE tactic coverage from findings
  const tacticCoverage: Record<string, number> = {}
  for (const finding of enrichedFindings) {
    const meta = finding.metadata as Record<string, unknown> | null
    const tactics = (meta?.tactics as string[]) ?? []
    for (const tactic of tactics) {
      tacticCoverage[tactic] = (tacticCoverage[tactic] ?? 0) + 1
    }
  }

  // TI sync if Sentinel is configured
  let tiSummary: ReturnType<typeof getTiSummary> | null = null
  const config = await getSentinelConfig(orgId)
  if (config) {
    try {
      const indicators = await syncThreatIndicators(config)
      await storeThreatIndicators(orgId, indicators)
      tiSummary = getTiSummary(indicators)
    } catch {
      tiSummary = null
    }
  }

  return NextResponse.json({
    findings: enrichedFindings.map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      status: f.status,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      metadata: f.metadata,
    })),
    auditEntries: sentinelAuditEntries.map((e) => ({
      id: e.id,
      action: e.action,
      resourceTitle: e.resourceTitle,
      description: e.description,
      metadata: e.metadata,
      createdAt: e.createdAt,
    })),
    tacticCoverage,
    tiSummary,
    connected: !!config,
  })
}
