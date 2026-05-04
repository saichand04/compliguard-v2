import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { broadcastMessage, getActiveConversations } from '@/lib/teams/notifications'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  const conversations = await getActiveConversations()

  if (conversations.length === 0) {
    return NextResponse.json({
      success: false,
      message: 'No active Teams conversations found. Install the bot in a Teams channel first.',
    })
  }

  try {
    await broadcastMessage(
      '✅ CompliGuard Teams Bot test message — your integration is working correctly!'
    )
    return NextResponse.json({
      success: true,
      message: `Test message sent to ${conversations.length} conversation(s).`,
      conversationCount: conversations.length,
    })
  } catch (err) {
    console.error('[Teams Test] Error:', err)
    return ApiErrors.internal('Failed to send test message')
  }
}
