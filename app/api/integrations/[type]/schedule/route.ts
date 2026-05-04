import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const scheduleSchema = z.object({
  schedule: z.string().min(1), // cron expression or 'daily' | 'weekly' | 'monthly' | 'manual'
})

const SCHEDULE_MAP: Record<string, string> = {
  daily: '0 9 * * *',
  weekly: '0 9 * * 1',
  monthly: '0 9 1 * *',
  manual: '',
}

type RouteContext = { params: Promise<{ type: string }> }

/**
 * POST /api/integrations/[type]/schedule
 * Set the sync schedule for a given integration type.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.MANAGE_INTEGRATIONS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { type } = await ctx.params

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = scheduleSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  let schedule = result.data.schedule
  // Expand shorthand to cron
  if (SCHEDULE_MAP[schedule] !== undefined) {
    schedule = SCHEDULE_MAP[schedule]
  }

  // Find existing integration
  const [existing] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, session.orgId),
        eq(integrations.type, type as typeof integrations.$inferSelect['type']),
      ),
    )
    .limit(1)

  if (!existing) return ApiErrors.notFound('Integration')

  // Compute nextSyncAt based on schedule
  let nextSyncAt: Date | null = null
  if (schedule) {
    // For simplicity, schedule next run ~1 day from now (a proper cron parser would be more precise)
    const next = new Date()
    if (schedule === '0 9 * * *') {
      // Daily at 9am — set to next 9am
      next.setHours(9, 0, 0, 0)
      if (next <= new Date()) next.setDate(next.getDate() + 1)
    } else if (schedule === '0 9 * * 1') {
      // Weekly Monday at 9am
      const daysUntilMonday = (8 - next.getDay()) % 7 || 7
      next.setDate(next.getDate() + daysUntilMonday)
      next.setHours(9, 0, 0, 0)
    } else if (schedule === '0 9 1 * *') {
      // Monthly on 1st
      next.setDate(1)
      next.setMonth(next.getMonth() + 1)
      next.setHours(9, 0, 0, 0)
    } else {
      // Custom cron — default to 24 hours from now
      next.setTime(next.getTime() + 24 * 60 * 60 * 1000)
    }
    nextSyncAt = next
  }

  const [updated] = await db
    .update(integrations)
    .set({
      syncSchedule: schedule || null,
      nextSyncAt,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, existing.id))
    .returning()

  return NextResponse.json({ integration: updated })
}
