/**
 * app/api/integrations/slack/test/route.ts
 * POST — Send a test message to verify the Slack integration.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { getIntegrationConfig } from '@/lib/integrations/store'
import { sendSlackMessage, type SlackConfig } from '@/lib/integrations/slack'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  // Allow passing token/channel directly (before saving) or use stored config
  let botToken: string
  let channelId: string

  const body = await req.json() as {
    botToken?: string
    signingSecret?: string
    defaultChannelId?: string
    channels?: Record<string, string>
  }

  if (body.botToken) {
    // Testing with freshly-entered credentials
    botToken = body.botToken
    channelId = body.defaultChannelId || body.channels?.general || ''
  } else {
    // Use stored config
    const raw = await getIntegrationConfig(session.orgId, 'slack')
    if (!raw?.botToken) {
      return ApiErrors.badRequest('Slack integration not configured')
    }

    let channels: SlackConfig['channels'] = {}
    try {
      if (raw.channels) channels = JSON.parse(raw.channels) as SlackConfig['channels']
    } catch {
      // ignore
    }

    botToken = raw.botToken
    channelId = raw.defaultChannelId || channels?.general || ''
  }

  if (!channelId) {
    return ApiErrors.badRequest('No channel configured. Set a default channel ID first.')
  }

  const ok = await sendSlackMessage(
    botToken,
    channelId,
    '✅ CompliGuard connected successfully! Your Slack integration is working.',
    [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '✅ *CompliGuard connected successfully!*\nYour Slack integration is working. You will now receive compliance notifications here.',
        },
      },
    ],
  )

  if (!ok) {
    return NextResponse.json(
      { ok: false, error: 'Failed to send message. Check your bot token and channel ID.' },
      { status: 400 },
    )
  }

  return NextResponse.json({ ok: true })
}
