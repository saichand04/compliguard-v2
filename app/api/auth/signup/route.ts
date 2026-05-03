import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, organizations, systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { setSessionCookie } from '@/lib/auth/jwt'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const signUpSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(1),
})

export async function POST(req: NextRequest) {
  // Check if registrations are enabled
  const [settings] = await db.select().from(systemSettings).limit(1)
  if (settings && !settings.allowRegistrations) {
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
    return NextResponse.json({ error: parseResult.error.errors[0].message }, { status: 400 })
  }

  const { firstName, lastName, email, password, organizationName } = parseResult.data

  // Check if email already exists
  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (existingUser) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
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

  // Create admin user
  const [user] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      email: email.toLowerCase(),
      firstName,
      lastName,
      passwordHash,
      role: 'admin',
    })
    .returning()

  // Set session cookie
  await setSessionCookie({
    userId: user.id,
    orgId: user.organizationId,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  })

  logger.info({ userId: user.id, orgId: org.id }, 'New user registered')

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
