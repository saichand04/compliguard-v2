import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'
import { BUILT_IN_ROLES } from '../route'

// NOTE(security): roles are platform-wide. Only super_admin may mutate them.

interface CustomRole {
  id: string
  name: string
  description: string
  permissions: Record<string, string[]>
  createdAt: string
  createdBy: string | null
}

async function getCustomRoles(): Promise<CustomRole[]> {
  const [settings] = await db.select().from(systemSettings).limit(1)
  if (!settings?.extraConfig) return []
  const cfg = settings.extraConfig as Record<string, unknown>
  return (cfg.custom_roles as CustomRole[]) ?? []
}

async function saveCustomRoles(roles: CustomRole[]): Promise<void> {
  const [settings] = await db.select().from(systemSettings).limit(1)
  const existing = (settings?.extraConfig as Record<string, unknown>) ?? {}
  const updated = { ...existing, custom_roles: roles }

  if (settings) {
    // (C12) constrain UPDATE to the specific row.
    await db
      .update(systemSettings)
      .set({ extraConfig: updated, updatedAt: new Date() })
      .where(eq(systemSettings.id, settings.id))
  } else {
    await db.insert(systemSettings).values({ extraConfig: updated })
  }
}

const updateRoleSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  permissions: z.record(z.string(), z.array(z.string())).optional(),
})

/** GET /api/roles/[id] — get a single role (built-in or custom) */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { id } = await params

  // Check built-in first
  const builtIn = BUILT_IN_ROLES.find(r => r.id === id)
  if (builtIn) {
    return NextResponse.json({ role: { ...builtIn, isBuiltIn: true } })
  }

  const customRoles = await getCustomRoles()
  const role = customRoles.find(r => r.id === id)
  if (!role) return ApiErrors.notFound('Role')

  return NextResponse.json({ role: { ...role, isBuiltIn: false } })
}

/** PATCH /api/roles/[id] — update a custom role (super_admin only — C12) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'super_admin') return ApiErrors.forbidden()

  const { id } = await params

  // Cannot update built-in roles
  if (BUILT_IN_ROLES.some(r => r.id === id)) {
    return ApiErrors.forbidden()
  }

  const customRoles = await getCustomRoles()
  const idx = customRoles.findIndex(r => r.id === id)
  if (idx === -1) return ApiErrors.notFound('Role')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = updateRoleSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const data = result.data
  const updated: CustomRole = {
    ...customRoles[idx],
    ...(data.name !== undefined && { name: data.name }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.permissions !== undefined && { permissions: data.permissions }),
  }

  customRoles[idx] = updated
  await saveCustomRoles(customRoles)

  return NextResponse.json({ role: { ...updated, isBuiltIn: false } })
}

/** DELETE /api/roles/[id] — delete a custom role (super_admin only — C12) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'super_admin') return ApiErrors.forbidden()

  const { id } = await params

  if (BUILT_IN_ROLES.some(r => r.id === id)) {
    return ApiErrors.forbidden()
  }

  const customRoles = await getCustomRoles()
  const idx = customRoles.findIndex(r => r.id === id)
  if (idx === -1) return ApiErrors.notFound('Role')

  const removed = customRoles[idx]
  customRoles.splice(idx, 1)
  await saveCustomRoles(customRoles)

  const { logAudit } = await import('@/lib/audit/log')
  await logAudit({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'role.delete',
    entityType: 'custom_role',
    entityId: id,
    entityTitle: removed.name,
    before: removed,
    description: `Deleted custom role: ${removed.name}`,
    request: req,
  })

  return NextResponse.json({ success: true })
}
