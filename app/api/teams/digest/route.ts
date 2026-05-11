/**
 * Teams Daily Digest API — Phase 7.7
 * POST: send digest now (session auth or cronSecret)
 * GET:  return digest schedule settings
 *
 * Authentication contract for POST:
 *   - If `x-cron-secret` header OR `cronSecret` body field is present, it is
 *     compared to `process.env.CRON_SECRET` with `crypto.timingSafeEqual`.
 *     On match, the caller may pass `orgId` in the body and the session check
 *     is skipped. If `CRON_SECRET` is unset the cron path is disabled.
 *   - Otherwise the caller must have an authenticated session.
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema/system_settings'
import { sendDailyDigest } from '@/lib/teams/digest'
import { sql } from 'drizzle-orm'

function timingSafeEqualStrings(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  try {
    return crypto.timingSafeEqual(ab, bb)
  } catch {
    return false
  }
}

export const dynamic = 'force-dynamic'

interface TeamsDigestConfig {
  enabled?: boolean
  time?: string
  timezone?: string
  lastSentAt?: string | null
}

async function getDigestConfig(): Promise<TeamsDigestConfig> {
  const [row] = await db
    .select({ extraConfig: systemSettings.extraConfig })
    .from(systemSettings)
    .limit(1)

  const extra = (row?.extraConfig ?? {}) as Record<string, unknown>
  return (extra.teamsDigest ?? {}) as TeamsDigestConfig
}

export async function GET(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  const config = await getDigestConfig()

  // Calculate next scheduled time
  let nextScheduledAt: string | null = null
  if (config.enabled && config.time) {
    const [hStr, mStr] = config.time.split(':')
    const h = parseInt(hStr ?? '8', 10)
    const m = parseInt(mStr ?? '0', 10)
    const now = new Date()
    const next = new Date()
    next.setHours(h, m, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    nextScheduledAt = next.toISOString()
  }

  return NextResponse.json({
    enabled: config.enabled ?? false,
    time: config.time ?? '08:00',
    timezone: config.timezone ?? 'America/Chicago',
    lastSentAt: config.lastSentAt ?? null,
    nextScheduledAt,
  })
}

export async function POST(request: NextRequest) {
  // Support both session auth and cronSecret header/body
  let orgId: string | null = null

  const cronSecretHeader = request.headers.get('x-cron-secret')
  const envCronSecret = process.env.CRON_SECRET

  let body: { orgId?: string; cronSecret?: string } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }

  const cronSecret = cronSecretHeader ?? body.cronSecret

  if (cronSecret) {
    // cronSecret path — skip session auth, verify secret with timingSafeEqual.
    if (!envCronSecret) {
      return NextResponse.json({ error: 'Cron auth disabled (CRON_SECRET unset)' }, { status: 401 })
    }
    if (!timingSafeEqualStrings(cronSecret, envCronSecret)) {
      return NextResponse.json({ error: 'Invalid cron secret' }, { status: 401 })
    }
    orgId = body.orgId ?? null
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required when using cronSecret' }, { status: 400 })
    }
  } else {
    // Session auth path
    const session = await requireAuth(request)
    if (!session) return ApiErrors.unauthorized()
    orgId = body.orgId ?? session.orgId!
  }

  // Send digest
  const { sent } = await sendDailyDigest(orgId)

  // Update lastSentAt in systemSettings.extraConfig.teamsDigest
  try {
    const [row] = await db
      .select({ extraConfig: systemSettings.extraConfig })
      .from(systemSettings)
      .limit(1)

    const extra = ((row?.extraConfig ?? {}) as Record<string, unknown>)
    const digest = ((extra.teamsDigest ?? {}) as Record<string, unknown>)
    digest.lastSentAt = new Date().toISOString()
    extra.teamsDigest = digest

    await db
      .update(systemSettings)
      .set({ extraConfig: extra, updatedAt: new Date() })
      .where(sql`1=1`)
  } catch (err) {
    console.error('[Teams Digest] Failed to update lastSentAt:', err)
  }

  return NextResponse.json({ ok: true, sent })
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  let body: Partial<TeamsDigestConfig> = {}
  try {
    body = await request.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  // Load current settings
  const [row] = await db
    .select({ extraConfig: systemSettings.extraConfig })
    .from(systemSettings)
    .limit(1)

  const extra = ((row?.extraConfig ?? {}) as Record<string, unknown>)
  const digest = ((extra.teamsDigest ?? {}) as Record<string, unknown>)

  if (body.enabled !== undefined) digest.enabled = body.enabled
  if (body.time !== undefined) digest.time = body.time
  if (body.timezone !== undefined) digest.timezone = body.timezone
  extra.teamsDigest = digest

  await db
    .update(systemSettings)
    .set({ extraConfig: extra, updatedAt: new Date() })
    .where(sql`1=1`)

  return NextResponse.json({ ok: true })
}
