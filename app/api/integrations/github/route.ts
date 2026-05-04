/**
 * app/api/integrations/github/route.ts
 * GET — get GitHub integration status/config
 * POST — save token + owner config
 * DELETE — disconnect
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import {
  getIntegrationConfig,
  saveIntegrationConfig,
  getIntegrationRow,
  deleteIntegration,
} from '@/lib/integrations/store'
import { integrationScanResults } from '@/lib/db/schema'
import { db } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const row = await getIntegrationRow(session.orgId, 'github')
  if (!row) {
    return NextResponse.json({ connected: false, integration: null, scanHistory: [] })
  }

  // Get last 10 scan results
  const scanHistory = await db
    .select()
    .from(integrationScanResults)
    .where(
      and(
        eq(integrationScanResults.integrationId, row.id),
        eq(integrationScanResults.organizationId, session.orgId),
      ),
    )
    .orderBy(desc(integrationScanResults.scannedAt))
    .limit(10)

  // Return config without sensitive fields
  const publicConfig = (row.config as Record<string, string> | null) ?? {}

  return NextResponse.json({
    connected: row.status === 'active',
    integration: {
      id: row.id,
      type: row.type,
      name: row.name,
      status: row.status,
      lastSyncAt: row.lastSyncAt,
      nextSyncAt: row.nextSyncAt,
      errorMessage: row.errorMessage,
      config: publicConfig,
    },
    scanHistory,
  })
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const body = await req.json() as { token?: string; owner?: string; name?: string }

  if (!body.token) {
    return ApiErrors.badRequest('GitHub token is required')
  }

  const config: Record<string, string> = {
    token: body.token,
    ...(body.owner ? { owner: body.owner } : {}),
  }

  const integrationId = await saveIntegrationConfig(
    session.orgId,
    'github',
    body.name ?? 'GitHub',
    config,
    ['token'], // credentials to encrypt
  )

  return NextResponse.json({ success: true, integrationId })
}

export async function DELETE(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  await deleteIntegration(session.orgId, 'github')

  return NextResponse.json({ success: true })
}
