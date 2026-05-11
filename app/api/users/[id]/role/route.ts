import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const VALID_BUILT_IN_ROLES = ['super_admin', 'admin', 'compliance_manager', 'auditor', 'user'] as const
type BuiltInRole = typeof VALID_BUILT_IN_ROLES[number]

/** Roles an organization admin (non-super) may assign. */
const ADMIN_ASSIGNABLE_ROLES: readonly BuiltInRole[] = ['compliance_manager', 'auditor', 'user']

const assignRoleSchema = z.object({
  role: z.string().min(1, 'Role is required'),
})

/**
 * PATCH /api/users/[id]/role — assign a role to a user.
 *
 * Privilege rules enforced here:
 *   - Caller must be `admin` or `super_admin`.
 *   - Caller cannot change THEIR OWN role (closes a self-promotion path).
 *   - Only `super_admin` can promote anyone to `super_admin`, and only
 *     if no other active super_admin already exists in the organization
 *     (defense-in-depth — see comment below).
 *   - `admin` may only assign one of ADMIN_ASSIGNABLE_ROLES.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  // Only admins can assign roles
  if (!['super_admin', 'admin'].includes(session.role)) {
    return ApiErrors.forbidden()
  }

  const { id } = await params

  // Forbid changing one's own role. This blocks an admin from demoting
  // themselves into a higher role or promoting themselves to super_admin.
  if (id === session.userId) {
    return NextResponse.json({ error: 'You cannot change your own role' }, { status: 403 })
  }

  const [targetUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.organizationId, session.orgId)))

  if (!targetUser) return ApiErrors.notFound('User')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = assignRoleSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const { role } = result.data

  // ---------------------------------------------------------------------------
  // Built-in role assignment
  // ---------------------------------------------------------------------------
  if (VALID_BUILT_IN_ROLES.includes(role as BuiltInRole)) {
    const requestedRole = role as BuiltInRole

    if (requestedRole === 'super_admin') {
      // Only an existing super_admin can mint a new super_admin.
      if (session.role !== 'super_admin') {
        return NextResponse.json({ error: 'Only a super_admin can assign the super_admin role' }, { status: 403 })
      }
      // Defense-in-depth: if there is already an active super_admin in
      // this organization other than the target user, refuse to create
      // a second one. This caps the blast radius if a super_admin
      // account is compromised — the attacker cannot quietly add a
      // co-equal account they control.
      const existingSupers = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.organizationId, session.orgId),
            eq(users.role, 'super_admin'),
            eq(users.isActive, true),
          ),
        )
      const otherSupers = existingSupers.filter((u) => u.id !== id)
      if (otherSupers.length > 0) {
        return NextResponse.json(
          { error: 'An active super_admin already exists in this organization' },
          { status: 409 },
        )
      }
    } else if (session.role === 'admin' && !ADMIN_ASSIGNABLE_ROLES.includes(requestedRole)) {
      // Admin (non-super) is restricted to a fixed subset of roles.
      // In particular this rejects 'admin' itself, blocking peer-level
      // promotion paths.
      return NextResponse.json(
        { error: `Admins may only assign roles: ${ADMIN_ASSIGNABLE_ROLES.join(', ')}` },
        { status: 403 },
      )
    }

    const [updated] = await db
      .update(users)
      .set({ role: requestedRole, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.organizationId, session.orgId)))
      .returning({ id: users.id, email: users.email, role: users.role })

    return NextResponse.json({ user: updated })
  }

  // ---------------------------------------------------------------------------
  // Custom role (UUID) assignment — falls back to base role 'user'.
  // Admin is permitted to assign custom roles (admin-assignable surface).
  // ---------------------------------------------------------------------------
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(role)) {
    const [updated] = await db
      .update(users)
      .set({ role: 'user', updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.organizationId, session.orgId)))
      .returning({ id: users.id, email: users.email, role: users.role })

    return NextResponse.json({ user: { ...updated, customRoleId: role } })
  }

  return ApiErrors.badRequest('Invalid role value')
}
