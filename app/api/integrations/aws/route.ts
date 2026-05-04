/**
 * app/api/integrations/aws/route.ts
 * GET — get AWS integration status/config
 * POST — save AWS credentials config
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

  const row = await getIntegrationRow(session.orgId, 'aws')
  if (!row) {
    return NextResponse.json({ connected: false, integration: null, scanHistory: [] })
  }

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

  const publicConfig = (row.config as Record<string, string> | null) ?? {}

  return NextResponse.json({
    connected: row.status === 'active',
    integration: {
      id: row.id,
      type: row.type,
      name: row.name,
      status: row.status,
      lastSyncAt: row.lastSyncAt,
      errorMessage: row.errorMessage,
      // Only return non-sensitive config fields
      config: {
        region: publicConfig.region ?? '',
        // Mask accessKeyId partially
        accessKeyId: publicConfig.accessKeyIdHint ?? '',
      },
    },
    scanHistory,
  })
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const body = await req.json() as {
    accessKeyId?: string
    secretAccessKey?: string
    region?: string
    sessionToken?: string
    name?: string
  }

  if (!body.accessKeyId || !body.secretAccessKey || !body.region) {
    return ApiErrors.badRequest('accessKeyId, secretAccessKey, and region are required')
  }

  const config: Record<string, string> = {
    accessKeyId: body.accessKeyId,
    secretAccessKey: body.secretAccessKey,
    region: body.region,
    // Store a hint (masked) in public config for display
    accessKeyIdHint: `${body.accessKeyId.slice(0, 4)}****${body.accessKeyId.slice(-4)}`,
    ...(body.sessionToken ? { sessionToken: body.sessionToken } : {}),
  }

  const integrationId = await saveIntegrationConfig(
    session.orgId,
    'aws',
    body.name ?? 'Amazon Web Services',
    config,
    ['secretAccessKey', 'sessionToken'], // fields to encrypt
  )

  return NextResponse.json({ success: true, integrationId })
}

export async function DELETE(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  await deleteIntegration(session.orgId, 'aws')

  return NextResponse.json({ success: true })
}
