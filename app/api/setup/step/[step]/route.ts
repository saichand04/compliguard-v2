import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings, organizations, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getSessionFromRequest, setSessionCookie } from '@/lib/auth/jwt'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ step: string }> }
) {
  const { step } = await params
  const stepNumber = parseInt(step, 10)

  // Get or create system settings
  let [settings] = await db.select().from(systemSettings).limit(1)
  if (!settings) {
    const [created] = await db.insert(systemSettings).values({}).returning()
    settings = created
  }

  // Once setup has been completed, the wizard endpoints become privileged
  // and may only be invoked by an authenticated super_admin (e.g. to repair
  // a misconfigured deployment). Anonymous callers are blocked outright to
  // prevent an attacker from re-running the wizard and seizing the admin
  // account on a live installation.
  if (settings.setupCompleted) {
    const session = await getSessionFromRequest(req)
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Setup already complete' }, { status: 403 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  switch (stepNumber) {
    case 1: {
      // Welcome — deployment type
      const { deploymentType } = body as { deploymentType: string }
      await db.update(systemSettings)
        .set({ deploymentType: deploymentType || 'docker', setupStep: 1, updatedAt: new Date() })
        .where(eq(systemSettings.id, settings.id))
      break
    }

    case 2: {
      // Organization
      const { name, domain, industry, size } = body as { name: string; domain?: string; industry?: string; size?: string }
      if (!name) return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60)
      const [existingOrg] = await db.select().from(organizations).limit(1)

      if (existingOrg) {
        await db.update(organizations).set({ name, domain, industry, size, updatedAt: new Date() }).where(eq(organizations.id, existingOrg.id))
      } else {
        await db.insert(organizations).values({ name, domain, industry, size, slug: `${slug}-${Date.now()}` })
      }

      await db.update(systemSettings).set({ setupStep: 2, updatedAt: new Date() }).where(eq(systemSettings.id, settings.id))
      break
    }

    case 3: {
      // Admin account creation
      const adminSchema = z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
      })
      const result = adminSchema.safeParse(body)
      if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
      }

      const { firstName, lastName, email, password } = result.data

      // Check if super admin already exists
      const [existingAdmin] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1)
      if (existingAdmin) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
      }

      const [org] = await db.select().from(organizations).limit(1)
      const passwordHash = await bcrypt.hash(password, 12)

      const [createdAdmin] = await db.insert(users).values({
        organizationId: org?.id,
        email: email.toLowerCase(),
        firstName,
        lastName,
        passwordHash,
        role: 'super_admin',
      }).returning()

      // Sign the freshly-created super_admin in immediately so the remaining
      // wizard steps (which are now gated behind super_admin auth) work
      // without forcing the operator to detour through /signin.
      await setSessionCookie({
        userId: createdAdmin.id,
        orgId: createdAdmin.organizationId,
        email: createdAdmin.email,
        role: createdAdmin.role,
        firstName: createdAdmin.firstName,
        lastName: createdAdmin.lastName,
        tokenVersion: createdAdmin.tokenVersion,
      })

      await db.update(systemSettings).set({ setupStep: 3, updatedAt: new Date() }).where(eq(systemSettings.id, settings.id))
      break
    }

    case 4: {
      // Invite users (store invites for later sending)
      await db.update(systemSettings).set({ setupStep: 4, updatedAt: new Date() }).where(eq(systemSettings.id, settings.id))
      break
    }

    case 5: {
      // Email config
      const { emailProvider, fromAddress } = body as { emailProvider: string; fromAddress: string }
      await db.update(systemSettings)
        .set({ emailProvider, emailFrom: fromAddress, setupStep: 5, updatedAt: new Date() })
        .where(eq(systemSettings.id, settings.id))
      break
    }

    case 6: {
      // Storage config
      const { storageProvider } = body as { storageProvider: string }
      await db.update(systemSettings)
        .set({ storageProvider, setupStep: 6, updatedAt: new Date() })
        .where(eq(systemSettings.id, settings.id))
      break
    }

    case 7: {
      // AI provider
      const { aiProvider, model } = body as { aiProvider: string; model: string }
      await db.update(systemSettings)
        .set({ aiProvider, aiModel: model, setupStep: 7, updatedAt: new Date() })
        .where(eq(systemSettings.id, settings.id))
      break
    }

    case 8: {
      // Integrations (optional)
      await db.update(systemSettings).set({ setupStep: 8, updatedAt: new Date() }).where(eq(systemSettings.id, settings.id))
      break
    }

    default:
      return NextResponse.json({ error: 'Invalid setup step' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, step: stepNumber })
}
