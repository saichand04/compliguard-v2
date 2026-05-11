import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// NOTE(security): roles are currently platform-wide (stored in the singleton
// system_settings.extra_config.custom_roles blob). DO NOT expose write
// operations to tenant admins — only super_admin may mutate them. If you ever
// want per-org custom roles, move them to lib/db/schema/knowledge_base.ts's
// `customRoles` table (which IS org-scoped) and gate writes by org match.

// ─── Built-in roles (hardcoded) ─────────────────────────────────────────────
export const BUILT_IN_ROLES = [
  {
    id: 'super_admin',
    name: 'Super Admin',
    description: 'Full platform access including billing and system settings',
    isBuiltIn: true,
    permissions: { '*': ['*'] },
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Full org access — manage users, frameworks, controls, vendors',
    isBuiltIn: true,
    permissions: {
      frameworks: ['view', 'edit', 'delete', 'publish'],
      evidence: ['view', 'upload', 'approve', 'delete'],
      findings: ['view', 'create', 'edit', 'delete', 'accept'],
      tasks: ['view', 'create', 'edit', 'delete', 'assign'],
      vendors: ['view', 'create', 'edit', 'delete', 'risk_assess'],
      reports: ['view', 'export'],
      users_roles: ['view', 'manage'],
      settings: ['view', 'edit'],
      ai_assistant: ['use'],
      audit_log: ['view'],
    },
  },
  {
    id: 'auditor',
    name: 'Auditor',
    description: 'Read-only access plus evidence export — for external auditors',
    isBuiltIn: true,
    permissions: {
      frameworks: ['view'],
      evidence: ['view', 'upload'],
      findings: ['view', 'create', 'edit'],
      tasks: ['view'],
      vendors: ['view'],
      reports: ['view', 'export'],
      users_roles: ['view'],
      settings: ['view'],
      ai_assistant: ['use'],
      audit_log: ['view'],
    },
  },
  {
    id: 'analyst',
    name: 'Analyst',
    description: 'Create and edit controls, evidence, and findings',
    isBuiltIn: true,
    permissions: {
      frameworks: ['view', 'edit'],
      evidence: ['view', 'upload', 'approve'],
      findings: ['view', 'create', 'edit'],
      tasks: ['view', 'create', 'edit', 'assign'],
      vendors: ['view', 'create', 'edit'],
      reports: ['view', 'export'],
      users_roles: ['view'],
      settings: ['view'],
      ai_assistant: ['use'],
      audit_log: ['view'],
    },
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to all org content',
    isBuiltIn: true,
    permissions: {
      frameworks: ['view'],
      evidence: ['view'],
      findings: ['view'],
      tasks: ['view'],
      vendors: ['view'],
      reports: ['view'],
      users_roles: ['view'],
      settings: ['view'],
      ai_assistant: [],
      audit_log: [],
    },
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
    // (C12) Constrain UPDATE to the specific settings row to prevent
    // accidental UPDATE-without-WHERE clobbers of every system_settings row.
    await db
      .update(systemSettings)
      .set({ extraConfig: updated, updatedAt: new Date() })
      .where(eq(systemSettings.id, settings.id))
  } else {
    await db.insert(systemSettings).values({ extraConfig: updated })
  }
}

interface CustomRole {
  id: string
  name: string
  description: string
  permissions: Record<string, string[]>
  createdAt: string
  createdBy: string | null
}

const createRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  description: z.string().max(500).optional(),
  permissions: z.record(z.string(), z.array(z.string())),
})

/** GET /api/roles — list built-in + custom roles */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const customRoles = await getCustomRoles()

  return NextResponse.json({
    builtIn: BUILT_IN_ROLES,
    custom: customRoles,
    all: [...BUILT_IN_ROLES, ...customRoles],
  })
}

/** POST /api/roles — create a custom role (super_admin only — C12) */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'super_admin') return ApiErrors.forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = createRoleSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const data = result.data
  const existing = await getCustomRoles()

  // Check name uniqueness
  const allNames = [...BUILT_IN_ROLES.map(r => r.name.toLowerCase()), ...existing.map(r => r.name.toLowerCase())]
  if (allNames.includes(data.name.toLowerCase())) {
    return ApiErrors.badRequest('A role with this name already exists')
  }

  const newRole: CustomRole = {
    id: randomUUID(),
    name: data.name,
    description: data.description ?? '',
    permissions: data.permissions,
    createdAt: new Date().toISOString(),
    createdBy: session.userId,
  }

  await saveCustomRoles([...existing, newRole])

  return NextResponse.json({ role: { ...newRole, isBuiltIn: false } }, { status: 201 })
}
