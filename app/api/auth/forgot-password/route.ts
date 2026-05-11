import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { authLimiter, checkRateLimit } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

const schema = z.object({ email: z.string().email() })

/**
 * POST /api/auth/forgot-password
 *
 * Always returns 200 {ok:true} regardless of whether the email matches
 * a real account, so that the response can't be used as an email
 * enumeration oracle. A fresh password_reset_token (32-byte hex) with
 * a one-hour expiry is written on the user row when the email does
 * match.
 *
 * Rate-limited per source IP via the shared `authLimiter` bucket.
 *
 * The actual delivery of the reset email is out of scope for this
 * handler; another job is expected to consume the token. We never
 * log it.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  try {
    await checkRateLimit(authLimiter, `forgot-${ip}`)
  } catch {
    // Don't reveal rate limiting — return the same generic ok response.
    return NextResponse.json({ ok: true })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    // Same generic response on bad input so an attacker can't probe via
    // malformed payloads either.
    return NextResponse.json({ ok: true })
  }

  const { email } = result.data

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)

  if (user) {
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await db
      .update(users)
      .set({
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))

    // Audit-only log — never log the token value itself.
    logger.info({ userId: user.id, ip }, 'Password reset token issued')
  }

  return NextResponse.json({ ok: true })
}
