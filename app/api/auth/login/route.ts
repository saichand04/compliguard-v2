import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { setSessionCookie } from '@/lib/auth/jwt'
import { authLimiter, checkRateLimit } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'

  // Rate limit by IP
  try {
    await checkRateLimit(authLimiter, ip)
  } catch {
    return NextResponse.json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parseResult = loginSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid email or password format' }, { status: 400 })
  }

  const { email, password } = parseResult.data

  // Look up user
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)

  if (!user || !user.passwordHash) {
    // Rate limit even on invalid user to prevent enumeration
    logger.warn({ email, ip }, 'Failed login: user not found')
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  if (!user.isActive) {
    return NextResponse.json({ error: 'Account is deactivated. Contact your administrator.' }, { status: 403 })
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash)
  if (!passwordValid) {
    logger.warn({ userId: user.id, ip }, 'Failed login: wrong password')
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  // Update last login timestamp
  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id))

  // Sign JWT and set cookie
  await setSessionCookie({
    userId: user.id,
    orgId: user.organizationId,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    tokenVersion: user.tokenVersion,
  })

  logger.info({ userId: user.id, ip }, 'Successful login')

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
    },
  })
}
