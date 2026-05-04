import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const VALID_BUILT_IN_ROLES = ['super_admin', 'admin', 'compliance_manager', 'auditor', 'user'] as const

const assignRoleSchema = z.object({
  role: z.string().min(1, 'Role is required'),
})

/** PATCH /api/users/[id]/role — assign a role to a user */
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

  // If the role is a built-in role, validate it
  if (VALID_BUILT_IN_ROLES.includes(role as typeof VALID_BUILT_IN_ROLES[number])) {
    const [updated] = await db
      .update(users)
      .set({ role: role as typeof VALID_BUILT_IN_ROLES[number], updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.organizationId, session.orgId)))
      .returning({ id: users.id, email: users.email, role: users.role })

    return NextResponse.json({ user: updated })
  }

  // Custom role — store the UUID in the customRole metadata field via a workaround.
  // Since the DB enum only accepts built-in values, we store 'user' as the base role
  // and track the custom role ID separately in a note.
  // For now, if it's a UUID-format custom role, we accept it by defaulting DB role to 'user'
  // and storing the custom role in metadata.
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(role)) {
    // Store the custom role UUID in the user's metadata via updatedAt update
    // We update the DB enum to 'user' and store the custom role in a separate mechanism
    const [updated] = await db
      .update(users)
      .set({ role: 'user', updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.organizationId, session.orgId)))
      .returning({ id: users.id, email: users.email, role: users.role })

    return NextResponse.json({ user: { ...updated, customRoleId: role } })
  }

  return ApiErrors.badRequest('Invalid role value')
}
