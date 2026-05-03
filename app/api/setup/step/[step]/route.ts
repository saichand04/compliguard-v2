import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings, organizations, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ step: string }> }
) {
  const { step } = await params
  const stepNumber = parseInt(step, 10)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Get or create system settings
  let [settings] = await db.select().from(systemSettings).limit(1)
  if (!settings) {
    const [created] = await db.insert(systemSettings).values({}).returning()
    settings = created
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
        return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 })
      }

      const { firstName, lastName, email, password } = result.data

      // Check if super admin already exists
      const [existingAdmin] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1)
      if (existingAdmin) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
      }

      const [org] = await db.select().from(organizations).limit(1)
      const passwordHash = await bcrypt.hash(password, 12)

      await db.insert(users).values({
        organizationId: org?.id,
        email: email.toLowerCase(),
        firstName,
        lastName,
        passwordHash,
        role: 'super_admin',
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
