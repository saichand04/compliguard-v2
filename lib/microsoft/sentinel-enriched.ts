/**
 * lib/microsoft/sentinel-enriched.ts
 * Enriched ingestion of Sentinel incidents with MITRE ATT&CK mapping,
 * audit trail creation, and NIST control status updates.
 */

import { db } from '@/lib/db'
import { findings, auditLogs, notifications } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { SentinelIncident } from '@/lib/microsoft/sentinel'
import { enrichWithMitre, collectNistControls, highestSeverity, MitreAttackInfo } from '@/lib/microsoft/mitre'

// ── Severity mapper ────────────────────────────────────────────────────────────

function mapSeverity(raw?: string): 'info' | 'low' | 'medium' | 'high' | 'critical' {
  const s = (raw ?? '').toLowerCase()
  if (s === 'critical') return 'critical'
  if (s === 'high') return 'high'
  if (s === 'medium') return 'medium'
  if (s === 'low') return 'low'
  return 'medium'
}

// ── Build enriched description ─────────────────────────────────────────────────

function buildEnrichedDescription(
  incident: SentinelIncident,
  mitreInfos: MitreAttackInfo[],
  nistControls: string[],
): string {
  const title = incident.properties?.title ?? incident.name
  const tactics = incident.properties?.additionalData?.tactics ?? []

  const lines: string[] = [
    `**Sentinel Incident:** ${title}`,
    `**Status:** ${incident.properties?.status ?? 'Unknown'}`,
    `**Severity:** ${incident.properties?.severity ?? 'Unknown'}`,
  ]

  if (tactics.length > 0) {
    lines.push(`**ATT&CK Tactics:** ${tactics.join(', ')}`)
  }

  if (mitreInfos.length > 0) {
    lines.push(`\n**MITRE ATT&CK Techniques:**`)
    for (const m of mitreInfos) {
      lines.push(`- [${m.techniqueId}] ${m.techniqueName} (${m.tacticName}) — ${m.url}`)
    }
  }

  if (nistControls.length > 0) {
    lines.push(`\n**Impacted NIST 800-53 Controls:** ${nistControls.join(', ')}`)
  }

  const alertProducts = incident.properties?.additionalData?.alertProductNames
  if (alertProducts && alertProducts.length > 0) {
    lines.push(`\n**Detection Sources:** ${alertProducts.join(', ')}`)
  }

  return lines.join('\n')
}

// ── Main ingest + enrich function ─────────────────────────────────────────────

export async function ingestAndEnrichIncident(
  orgId: string,
  incident: SentinelIncident,
): Promise<{ findingId: string; mitreInfos: MitreAttackInfo[]; nistControls: string[] }> {
  const tactics = incident.properties?.additionalData?.tactics ?? []
  const mitreInfos = enrichWithMitre(tactics)
  const nistControls = collectNistControls(mitreInfos)
  const mitreHighestSeverity = mitreInfos.length > 0 ? highestSeverity(mitreInfos) : undefined
  const rawSeverity = mapSeverity(incident.properties?.severity)
  // Use the higher of MITRE-derived vs raw severity
  const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 }
  const effectiveSeverity =
    mitreHighestSeverity && (severityOrder[mitreHighestSeverity] ?? 0) > (severityOrder[rawSeverity] ?? 0)
      ? mitreHighestSeverity
      : rawSeverity

  const description = buildEnrichedDescription(incident, mitreInfos, nistControls)
  const title = incident.properties?.title ?? `Sentinel Incident: ${incident.name}`

  const metadata = {
    sentinelIncidentId: incident.name,
    sentinelIncidentUrl: `https://portal.azure.com/#asset/Microsoft_Azure_Security_Insights/Incident/${incident.name}`,
    tactics,
    mitreAttack: mitreInfos,
    nistControls,
    alertProductNames: incident.properties?.additionalData?.alertProductNames,
    status: incident.properties?.status,
    assignedTo: incident.properties?.owner?.assignedTo,
    enrichedAt: new Date().toISOString(),
  }

  // Upsert finding based on sentinelIncidentId
  let findingId: string

  const existingFindings = await db
    .select({ id: findings.id })
    .from(findings)
    .where(
      and(
        eq(findings.organizationId, orgId),
        eq(findings.source, 'azure'),
      ),
    )
    .limit(200)

  // Check metadata for sentinelIncidentId match
  const existing = existingFindings.find(() => false) // Will be checked via rawData below
  void existing // suppress unused var warning

  // Try to find by checking all azure findings (limited scan)
  const azureFindings = await db
    .select()
    .from(findings)
    .where(
      and(
        eq(findings.organizationId, orgId),
        eq(findings.source, 'azure'),
      ),
    )
    .limit(200)

  const matchingFinding = azureFindings.find((f) => {
    const meta = f.metadata as Record<string, unknown> | null
    return meta?.sentinelIncidentId === incident.name
  })

  if (matchingFinding) {
    // Update existing
    await db
      .update(findings)
      .set({
        title,
        description,
        severity: effectiveSeverity,
        metadata: metadata as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(findings.id, matchingFinding.id))
    findingId = matchingFinding.id
  } else {
    // Insert new finding
    const [inserted] = await db
      .insert(findings)
      .values({
        organizationId: orgId,
        title,
        description,
        severity: effectiveSeverity,
        status: 'open',
        source: 'azure',
        resourceType: 'sentinel_incident',
        resourceId: incident.name,
        metadata: metadata as Record<string, unknown>,
        rawData: incident as unknown as Record<string, unknown>,
      })
      .returning({ id: findings.id })
    findingId = inserted.id
  }

  // Create enriched audit log
  await db.insert(auditLogs).values({
    organizationId: orgId,
    userId: null,
    action: 'sentinel.incident.ingested',
    resourceType: 'finding',
    resourceId: findingId,
    resourceTitle: title,
    description: `Sentinel incident ingested and enriched with MITRE ATT&CK data. Tactics: ${tactics.join(', ') || 'None'}. NIST controls: ${nistControls.join(', ') || 'None'}.`,
    after: metadata as unknown as Record<string, unknown>,
    metadata: {
      mitreInfos,
      nistControls,
      tactics,
      sentinelIncidentId: incident.name,
      severity: effectiveSeverity,
      enrichedAt: new Date().toISOString(),
    } as Record<string, unknown>,
  })

  // Notify admins for critical/high severity
  if (effectiveSeverity === 'critical' || effectiveSeverity === 'high') {
    await notifyAdmins(orgId, title, effectiveSeverity, findingId, mitreInfos)
  }

  return { findingId, mitreInfos, nistControls }
}

// ── Notify admins ─────────────────────────────────────────────────────────────

async function notifyAdmins(
  orgId: string,
  title: string,
  severity: string,
  findingId: string,
  mitreInfos: MitreAttackInfo[],
): Promise<void> {
  try {
    const { users } = await import('@/lib/db/schema')
    const { eq } = await import('drizzle-orm')

    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.organizationId, orgId))
      .limit(20)

    const tacticNames = [...new Set(mitreInfos.map((m) => m.tacticName))].join(', ')

    for (const admin of admins) {
      await db.insert(notifications).values({
        organizationId: orgId,
        userId: admin.id,
        type: 'new_finding',
        title: `${severity.toUpperCase()} Sentinel Incident: ${title}`,
        body: mitreInfos.length > 0
          ? `MITRE ATT&CK tactics detected: ${tacticNames}. Review and remediate immediately.`
          : `A ${severity} severity Sentinel incident has been ingested. Review immediately.`,
        link: `/findings/${findingId}`,
        metadata: { findingId, severity, mitreInfos: mitreInfos.slice(0, 3) } as Record<string, unknown>,
      })
    }
  } catch {
    // Notification failures are non-critical
  }
}

// ── Re-enrich all existing Sentinel findings ──────────────────────────────────

export async function reEnrichAllIncidents(orgId: string): Promise<{
  enriched: number
  errors: number
}> {
  let enriched = 0
  let errors = 0

  const azureFindings = await db
    .select()
    .from(findings)
    .where(
      and(
        eq(findings.organizationId, orgId),
        eq(findings.source, 'azure'),
      ),
    )
    .limit(500)

  for (const finding of azureFindings) {
    try {
      const meta = finding.metadata as Record<string, unknown> | null
      if (!meta?.sentinelIncidentId) continue

      const tactics = (meta.tactics as string[]) ?? []
      const mitreInfos = enrichWithMitre(tactics)
      const nistControls = collectNistControls(mitreInfos)

      const updatedMeta = {
        ...meta,
        mitreAttack: mitreInfos,
        nistControls,
        enrichedAt: new Date().toISOString(),
      }

      await db
        .update(findings)
        .set({
          metadata: updatedMeta as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(findings.id, finding.id))

      enriched++
    } catch {
      errors++
    }
  }

  return { enriched, errors }
}
