import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema/system_settings'
import { teamsConversationRefs } from '@/lib/db/schema/teams_bot'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  const appId = process.env.BOT_APP_ID ?? null
  const appPassword = process.env.BOT_APP_PASSWORD ?? null

  // Count active conversations
  let conversationCount = 0
  try {
    const rows = await db.select().from(teamsConversationRefs)
    conversationCount = rows.length
  } catch {
    // DB may not be ready
  }

  return NextResponse.json({
    botAppId: appId,
    connected: !!(appId && appPassword),
    conversationCount,
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/api/teams/bot`,
  })
}

export async function POST(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  let body: { appId?: string; appPassword?: string; tenantId?: string }
  try {
    body = await request.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const { appId, appPassword, tenantId } = body
  if (!appId || !appPassword || !tenantId) {
    return ApiErrors.badRequest('appId, appPassword, and tenantId are required')
  }

  try {
    // Load existing settings row
    const existing = await db.select().from(systemSettings).limit(1)
    const currentExtra = (existing[0]?.extraConfig as Record<string, unknown>) ?? {}

    const newExtra = {
      ...currentExtra,
      teamsBot: {
        appId,
        tenantId,
        updatedAt: new Date().toISOString(),
      },
    }

    if (existing.length === 0) {
      await db.insert(systemSettings).values({
        extraConfig: newExtra,
      })
    } else {
      await db
        .update(systemSettings)
        .set({ extraConfig: newExtra, updatedAt: new Date() })
        .where(eq(systemSettings.id, existing[0].id))
    }

    return NextResponse.json({ success: true, message: 'Teams Bot configuration saved' })
  } catch (err) {
    console.error('[Teams Config] DB error:', err)
    return ApiErrors.internal('Failed to save Teams Bot configuration')
  }
}
