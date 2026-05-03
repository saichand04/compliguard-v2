import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { frameworks, organizationFrameworks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

/**
 * GET /api/frameworks
 * List all frameworks available to the organization (built-in + org-specific).
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_FRAMEWORKS)) return ApiErrors.forbidden()

  const orgId = session.orgId

  // Get all built-in frameworks + org-created frameworks
  const allFrameworks = await db.select().from(frameworks).where(eq(frameworks.isActive, true))

  // Get which frameworks this org has activated
  const activeIds = orgId
    ? (await db.select({ frameworkId: organizationFrameworks.frameworkId })
        .from(organizationFrameworks)
        .where(and(eq(organizationFrameworks.organizationId, orgId), eq(organizationFrameworks.isActive, true))))
        .map((r) => r.frameworkId)
    : []

  return NextResponse.json({
    frameworks: allFrameworks.map((fw) => ({
      ...fw,
      isActivated: activeIds.includes(fw.id),
    })),
  })
}

const createFrameworkSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  regulatoryBody: z.string().optional(),
})

/**
 * POST /api/frameworks
 * Create a new custom framework for the organization.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.CREATE_FRAMEWORKS)) return ApiErrors.forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = createFrameworkSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const [fw] = await db.insert(frameworks).values({
    ...result.data,
    isBuiltIn: false,
    isActive: true,
  }).returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'framework.create',
    resourceType: 'framework',
    resourceId: fw.id,
    resourceTitle: fw.name,
    description: `Created framework: ${fw.name}`,
    request: req,
  })

  return NextResponse.json({ framework: fw }, { status: 201 })
}
