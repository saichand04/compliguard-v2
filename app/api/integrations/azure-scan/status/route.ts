import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations, integrationScanResults } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// ─── GET — current scan status (for polling) ──────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!
  if (!orgId) return ApiErrors.forbidden()

  const [integration] = await db
    .select({ id: integrations.id, lastSyncAt: integrations.lastSyncAt })
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, 'azure')
      )
    )
    .limit(1)

  if (!integration) {
    return NextResponse.json({ status: 'not_configured' })
  }

  // Get the most recent scan
  const [lastScan] = await db
    .select({
      id: integrationScanResults.id,
      scannedAt: integrationScanResults.scannedAt,
      summary: integrationScanResults.summary,
    })
    .from(integrationScanResults)
    .where(eq(integrationScanResults.integrationId, integration.id))
    .orderBy(desc(integrationScanResults.scannedAt))
    .limit(1)

  if (!lastScan) {
    return NextResponse.json({ status: 'no_scans', lastSyncAt: integration.lastSyncAt })
  }

  const summary = lastScan.summary as Record<string, unknown> | null

  return NextResponse.json({
    status: summary?.status ?? 'completed',
    scanId: summary?.scanId,
    lastScanAt: lastScan.scannedAt,
    totalFindings: summary?.totalFindings ?? 0,
    criticalFindings: summary?.criticalFindings ?? 0,
    sources: summary?.sources ?? [],
    aiSummary: summary?.aiSummary ?? null,
  })
}
