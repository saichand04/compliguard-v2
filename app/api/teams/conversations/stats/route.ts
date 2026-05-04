/**
 * Teams Conversation Stats API — Phase 7.8
 * GET: return { total, active, inactive, lastActiveAt, channelBreakdown }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { teamsConversationRefs } from '@/lib/db/schema/teams_bot'
import { eq, desc, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!

  const rows = await db
    .select({
      id: teamsConversationRefs.id,
      channelId: teamsConversationRefs.channelId,
      updatedAt: teamsConversationRefs.updatedAt,
    })
    .from(teamsConversationRefs)
    .where(eq(teamsConversationRefs.organizationId, orgId))
    .orderBy(desc(teamsConversationRefs.updatedAt))

  const total = rows.length

  // Consider "active" if updated within last 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const active = rows.filter((r) => new Date(r.updatedAt) > cutoff).length
  const inactive = total - active

  const lastActiveAt = rows[0]?.updatedAt?.toISOString() ?? null

  // Channel breakdown
  const channelMap: Record<string, number> = {}
  for (const row of rows) {
    const ch = row.channelId ?? 'msteams'
    channelMap[ch] = (channelMap[ch] ?? 0) + 1
  }
  const channelBreakdown = Object.entries(channelMap).map(([channel, count]) => ({
    channel,
    count,
  }))

  return NextResponse.json({
    total,
    active,
    inactive,
    lastActiveAt,
    channelBreakdown,
  })
}
