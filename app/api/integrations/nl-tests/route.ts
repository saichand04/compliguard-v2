import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { nlTests } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(500),
  query: z.string().min(1),
  schedule: z.string().optional(), // 'manual' | 'daily' | 'weekly' | 'monthly' | cron string
  isActive: z.boolean().optional().default(true),
})

/**
 * GET /api/integrations/nl-tests
 * List all NL tests for the org.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_INTEGRATIONS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const tests = await db
    .select()
    .from(nlTests)
    .where(eq(nlTests.organizationId, session.orgId))
    .orderBy(nlTests.createdAt)

  return NextResponse.json({ tests, total: tests.length })
}

/**
 * POST /api/integrations/nl-tests
 * Create a new NL test.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.MANAGE_INTEGRATIONS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = createSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data

  const [test] = await db
    .insert(nlTests)
    .values({
      organizationId: session.orgId,
      name: data.name,
      query: data.query,
      schedule: data.schedule ?? 'manual',
      isActive: data.isActive,
      createdBy: session.userId,
    })
    .returning()

  return NextResponse.json({ test }, { status: 201 })
}
