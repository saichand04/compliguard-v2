import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations, integrationScanResults } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { runAzureComplianceScan } from '@/lib/microsoft/azure-compliance-scanner'

// In-memory store for running scans (per org)
const runningScans = new Map<string, { scanId: string; startedAt: Date; status: string }>()

// ─── POST — trigger a full Azure compliance scan ───────────────────────────────

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!
  if (!orgId) return ApiErrors.forbidden()

  // Prevent duplicate scans
  if (runningScans.has(orgId)) {
    return NextResponse.json({
      error: 'A scan is already running for this organization',
      running: true,
    }, { status: 409 })
  }

  // Start scan asynchronously
  const scanId = crypto.randomUUID()
  runningScans.set(orgId, { scanId, startedAt: new Date(), status: 'running' })

  // Run scan in background (don't await)
  runAzureComplianceScan(orgId)
    .then(result => {
      runningScans.set(orgId, { scanId, startedAt: new Date(), status: result.status })
      // Clear after 5 minutes so next scan can run
      setTimeout(() => runningScans.delete(orgId), 5 * 60 * 1000)
    })
    .catch(() => {
      runningScans.set(orgId, { scanId, startedAt: new Date(), status: 'failed' })
      setTimeout(() => runningScans.delete(orgId), 5 * 60 * 1000)
    })

  return NextResponse.json({
    scanId,
    status: 'running',
    message: 'Azure compliance scan started. Poll /api/integrations/azure-scan/status for progress.',
  }, { status: 202 })
}

// ─── GET — last scan results ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!
  if (!orgId) return ApiErrors.forbidden()

  const [integration] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, 'azure')
      )
    )
    .limit(1)

  if (!integration) {
    return NextResponse.json({ configured: false, lastScan: null })
  }

  const [lastScan] = await db
    .select()
    .from(integrationScanResults)
    .where(eq(integrationScanResults.integrationId, integration.id))
    .orderBy(desc(integrationScanResults.scannedAt))
    .limit(1)

  const running = runningScans.get(orgId)

  return NextResponse.json({
    configured: true,
    running: !!running && running.status === 'running',
    lastScan: lastScan
      ? {
          id: lastScan.id,
          scannedAt: lastScan.scannedAt,
          summary: lastScan.summary,
          rawResults: lastScan.rawResults,
        }
      : null,
  })
}
