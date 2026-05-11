import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { and, eq, gt, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authLimiter, checkRateLimit } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

const schema = z.object({
  token: z.string().min(32).max(256),
  newPassword: z.string().min(12, 'Password must be at least 12 characters'),
})

/**
 * POST /api/auth/reset-password
 *
 * Consumes a single-use password_reset_token that was issued by
 * /api/auth/forgot-password. On success:
 *
 *   1. Validates the token is present and not expired.
 *   2. Hashes the new password with bcrypt (12 rounds).
 *   3. Writes the new password_hash AND nulls the reset token in the
 *      same UPDATE so the token cannot be replayed.
 *   4. Bumps token_version, which invalidates every JWT previously
 *      issued for this account (forces re-login everywhere).
 *
 * Always responds with a generic "ok" message on the no-match path so
 * the endpoint can't be used as a token-validity oracle.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  try {
    await checkRateLimit(authLimiter, `reset-${ip}`)
  } catch {
    return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { token, newPassword } = parsed.data

  const now = new Date()
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.passwordResetToken, token),
        gt(users.passwordResetExpiresAt, now),
      ),
    )
    .limit(1)

  if (!user) {
    // Don't disclose whether the token was unknown vs. expired.
    logger.warn({ ip }, 'Password reset attempted with invalid/expired token')
    return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)

  // Single-use: null out the token and its expiry in the same UPDATE so
  // a concurrent request with the same token cannot succeed twice.
  // tokenVersion is bumped so every previously-issued JWT for this
  // account is now rejected by verifyToken().
  await db
    .update(users)
    .set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      tokenVersion: sql`${users.tokenVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  logger.info({ userId: user.id, ip }, 'Password reset succeeded')

  return NextResponse.json({ ok: true })
}
