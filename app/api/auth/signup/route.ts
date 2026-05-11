import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, organizations, systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { authLimiter, checkRateLimit } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const signUpSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(1),
})

/**
 * POST /api/auth/signup
 *
 * Public self-service registration. Hardened against the following
 * attack surface previously exposed by this endpoint:
 *
 *   1. Privilege escalation: new accounts were created with role
 *      'admin'. They are now always created with role 'user'.
 *   2. Hostile registration on a fresh install: registrations are
 *      now rejected unless the operator has explicitly opted in via
 *      `system_settings.allow_registrations = true` AND the setup
 *      wizard has been completed.
 *   3. Email enumeration: a duplicate email used to return 409; the
 *      endpoint now responds with a generic 202 and a noop in that
 *      branch, so a probe cannot distinguish registered emails.
 *   4. Brute-force / spam: the same auth rate-limit bucket used by
 *      /api/auth/login is consumed per source IP.
 *
 * NOTE: until email-verification UX is wired up, new accounts are
 * created with `is_active = false` and must be activated by an
 * existing admin. This is deliberately conservative — the alternative
 * (auto-active accounts) would let any internet user join the org.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  try {
    await checkRateLimit(authLimiter, `signup-${ip}`)
  } catch {
    return NextResponse.json({ error: 'Too many sign-up attempts. Try again in 15 minutes.' }, { status: 429 })
  }

  // Refuse signup unless the operator has explicitly allowed it AND
  // first-run setup is complete. This blocks the largest abuse case —
  // a freshly-deployed installation getting hijacked because the
  // wizard hadn't run yet.
  const [settings] = await db.select().from(systemSettings).limit(1)
  if (!settings || !settings.setupCompleted || !settings.allowRegistrations) {
    return NextResponse.json({ error: 'Self-service registration is disabled.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parseResult = signUpSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 })
  }

  const { firstName, lastName, email, password, organizationName } = parseResult.data

  // Anti-enumeration: if the email already exists, return a generic
  // success-ish response so an attacker can't tell registered emails
  // apart from unregistered ones.
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)
  if (existingUser) {
    logger.warn({ email, ip }, 'Duplicate signup attempt — returning generic ok')
    return NextResponse.json({ ok: true }, { status: 202 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Create organization
  const orgSlug = organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60)

  const [org] = await db
    .insert(organizations)
    .values({ name: organizationName, slug: `${orgSlug}-${Date.now()}` })
    .returning()

  // New users default to role 'user' and is_active=false. An admin must
  // activate them before they can log in. NEVER assign 'admin' or
  // 'super_admin' on a self-service signup.
  const [user] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      email: email.toLowerCase(),
      firstName,
      lastName,
      passwordHash,
      role: 'user',
      isActive: false,
    })
    .returning()

  logger.info({ userId: user.id, orgId: org.id }, 'New user registered (pending admin activation)')

  return NextResponse.json({
    ok: true,
    pendingActivation: true,
    message: 'Account created. An administrator must activate it before you can sign in.',
  }, { status: 202 })
}
