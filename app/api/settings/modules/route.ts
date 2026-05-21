import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { moduleConfig } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'
import { DEFAULT_MODULE_TOGGLES } from '@/lib/db/schema/module_config'

const moduleToggleSchema = z.object({
  pentest: z.boolean().optional(),
  firewallAudit: z.boolean().optional(),
  dnsAudit: z.boolean().optional(),
  nlTests: z.boolean().optional(),
  mcpServer: z.boolean().optional(),
  openClaw: z.boolean().optional(),
  teamsBot: z.boolean().optional(),
  training: z.boolean().optional(),
  vendors: z.boolean().optional(),
  // Cloud Security submodules
  cloudMicrosoft: z.boolean().optional(),
  cloudAWS: z.boolean().optional(),
  cloudGCP: z.boolean().optional(),
})

/**
 * GET /api/settings/modules
 * Return current module config for the org.
 * Defaults all modules to true if no config row exists yet.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const [config] = await db
    .select()
    .from(moduleConfig)
    .where(eq(moduleConfig.organizationId, session.orgId))

  if (!config) {
    // Return defaults without persisting — row is created lazily on first PATCH
    return NextResponse.json({ modules: DEFAULT_MODULE_TOGGLES })
  }

  // Merge stored values over defaults so any new module keys default to true
  const modules = { ...DEFAULT_MODULE_TOGGLES, ...(config.modules as object) }

  return NextResponse.json({ modules })
}

/**
 * PATCH /api/settings/modules
 * Update module toggles for the org.
 * Only super_admin and admin roles may update.
 */
export async function PATCH(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  // Role guard — only super_admin / admin
  const allowedRoles = ['super_admin', 'admin']
  if (!session.role || !allowedRoles.includes(session.role)) {
    return ApiErrors.forbidden()
  }

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = moduleToggleSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const incoming = result.data

  // Fetch existing config (if any)
  const [existing] = await db
    .select()
    .from(moduleConfig)
    .where(eq(moduleConfig.organizationId, session.orgId))

  const currentModules = existing
    ? { ...DEFAULT_MODULE_TOGGLES, ...(existing.modules as object) }
    : { ...DEFAULT_MODULE_TOGGLES }

  // Merge incoming changes
  const updatedModules = { ...currentModules, ...incoming }

  let savedConfig

  if (existing) {
    const [updated] = await db
      .update(moduleConfig)
      .set({ modules: updatedModules, updatedAt: new Date() })
      .where(eq(moduleConfig.organizationId, session.orgId))
      .returning()
    savedConfig = updated
  } else {
    const [created] = await db
      .insert(moduleConfig)
      .values({
        organizationId: session.orgId,
        modules: updatedModules,
      })
      .returning()
    savedConfig = created
  }

  return NextResponse.json({
    modules: { ...DEFAULT_MODULE_TOGGLES, ...(savedConfig.modules as object) },
  })
}
