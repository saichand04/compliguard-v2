import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// Supported schedule presets
const SCHEDULES: Record<string, string> = {
  hourly: '0 * * * *',
  daily: '0 0 * * *',
  weekly: '0 0 * * 0',
  monthly: '0 0 1 * *',
}

// ─── POST — set scan schedule ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!
  if (!orgId) return ApiErrors.forbidden()

  const body = (await req.json()) as {
    preset?: keyof typeof SCHEDULES
    cron?: string
  }

  let cronExpression: string | null = null

  if (body.preset && SCHEDULES[body.preset]) {
    cronExpression = SCHEDULES[body.preset]
  } else if (body.cron) {
    // Basic cron validation: 5 fields
    const parts = body.cron.trim().split(/\s+/)
    if (parts.length !== 5) {
      return ApiErrors.badRequest('Invalid cron expression. Must have 5 fields: minute hour day month weekday')
    }
    cronExpression = body.cron.trim()
  } else if (body.preset === null || body.cron === null) {
    cronExpression = null // disable schedule
  } else {
    return ApiErrors.badRequest('Provide either a preset (hourly/daily/weekly/monthly) or a cron expression')
  }

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
    return ApiErrors.badRequest('Azure integration not configured')
  }

  await db
    .update(integrations)
    .set({
      syncSchedule: cronExpression ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, integration.id))

  return NextResponse.json({
    success: true,
    schedule: cronExpression ?? 'disabled',
    message: cronExpression
      ? `Scan scheduled: ${cronExpression}`
      : 'Scheduled scanning disabled',
  })
}

// ─── GET — current schedule ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!
  if (!orgId) return ApiErrors.forbidden()

  const [integration] = await db
    .select({
      syncSchedule: integrations.syncSchedule,
      nextSyncAt: integrations.nextSyncAt,
    })
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, 'azure')
      )
    )
    .limit(1)

  if (!integration) {
    return NextResponse.json({ schedule: null, nextSyncAt: null })
  }

  // Reverse-lookup preset name
  const presetEntry = Object.entries(SCHEDULES).find(
    ([, cron]) => cron === integration.syncSchedule
  )

  return NextResponse.json({
    schedule: integration.syncSchedule ?? null,
    preset: presetEntry?.[0] ?? null,
    nextSyncAt: integration.nextSyncAt ?? null,
    availablePresets: Object.keys(SCHEDULES),
  })
}
