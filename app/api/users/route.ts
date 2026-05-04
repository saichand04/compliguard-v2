import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

/**
 * GET /api/users?search=
 * List users in the current organization.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search')?.toLowerCase()

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
    })
    .from(users)
    .where(eq(users.organizationId, session.orgId))

  const filtered = search
    ? allUsers.filter((u) => {
        const fullName = `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase()
        return fullName.includes(search) || u.email.toLowerCase().includes(search)
      })
    : allUsers

  return NextResponse.json({ users: filtered, total: filtered.length })
}
