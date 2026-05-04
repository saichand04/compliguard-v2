/**
 * app/api/integrations/slack/route.ts
 * GET / POST / DELETE Slack integration config.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import {
  getIntegrationRow,
  saveIntegrationConfig,
  deleteIntegration,
} from '@/lib/integrations/store'

// GET /api/integrations/slack — return current config (masked)
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const row = await getIntegrationRow(session.orgId, 'slack')
  if (!row) return NextResponse.json({ connected: false })

  const cfg = (row.config as Record<string, unknown>) || {}

  return NextResponse.json({
    connected: row.status === 'active',
    status: row.status,
    lastSyncAt: row.lastSyncAt,
    defaultChannelId: cfg.defaultChannelId ?? '',
    channels: cfg.channels ?? {},
    notificationPreferences: cfg.notificationPreferences ?? {},
    // Secrets are never returned
  })
}

// POST /api/integrations/slack — save config
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  const body = await req.json() as {
    botToken?: string
    signingSecret?: string
    defaultChannelId?: string
    channels?: Record<string, string>
    notificationPreferences?: Record<string, boolean>
  }

  if (!body.botToken || !body.signingSecret) {
    return ApiErrors.badRequest('botToken and signingSecret are required')
  }

  const config: Record<string, string> = {
    botToken: body.botToken,
    signingSecret: body.signingSecret,
    defaultChannelId: body.defaultChannelId ?? '',
    channels: JSON.stringify(body.channels ?? {}),
    notificationPreferences: JSON.stringify(body.notificationPreferences ?? {}),
  }

  await saveIntegrationConfig(
    session.orgId,
    'slack',
    'Slack',
    config,
    ['botToken', 'signingSecret'],
  )

  return NextResponse.json({ ok: true })
}

// DELETE /api/integrations/slack — remove integration
export async function DELETE(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  await deleteIntegration(session.orgId, 'slack')
  return NextResponse.json({ ok: true })
}
