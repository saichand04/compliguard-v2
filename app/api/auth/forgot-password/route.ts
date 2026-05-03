import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { authLimiter, checkRateLimit } from '@/lib/rate-limiter'

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  try {
    await checkRateLimit(authLimiter, `forgot-${ip}`)
  } catch {
    return NextResponse.json({ ok: true }) // Don't reveal rate limiting
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const { email } = result.data

  // Always return 200 to prevent email enumeration
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)

  if (user) {
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours

    await db
      .update(users)
      .set({ inviteToken: token, inviteExpiresAt: expiresAt, updatedAt: new Date() })
      .where(eq(users.id, user.id))

    // In a real deployment, send the reset email here via sendPasswordReset()
    // For now, log the token (dev only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Password reset token for ${email}: ${token}`)
    }
  }

  return NextResponse.json({ ok: true })
}
