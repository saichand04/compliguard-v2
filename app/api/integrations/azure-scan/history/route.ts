import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations, integrationScanResults } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// ─── GET — last 10 scan history entries ───────────────────────────────────────

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
    return NextResponse.json({ history: [] })
  }

  const history = await db
    .select({
      id: integrationScanResults.id,
      scannedAt: integrationScanResults.scannedAt,
      summary: integrationScanResults.summary,
    })
    .from(integrationScanResults)
    .where(eq(integrationScanResults.integrationId, integration.id))
    .orderBy(desc(integrationScanResults.scannedAt))
    .limit(10)

  return NextResponse.json({
    history: history.map(h => {
      const summary = h.summary as Record<string, unknown> | null
      return {
        id: h.id,
        scannedAt: h.scannedAt,
        status: summary?.status ?? 'completed',
        totalFindings: summary?.totalFindings ?? 0,
        criticalFindings: summary?.criticalFindings ?? 0,
        sources: summary?.sources ?? [],
        scanId: summary?.scanId,
      }
    }),
  })
}
