import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { policies } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_POLICIES)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')

  const records = await db
    .select()
    .from(policies)
    .where(eq(policies.organizationId, session.orgId))
    .limit(100)

  const filtered = status ? records.filter((p) => p.status === status) : records

  return NextResponse.json({ policies: filtered, total: filtered.length })
}

const policySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.string().optional(),
  version: z.string().optional(),
  category: z.string().optional(),
  effectiveDate: z.string().optional(),
  reviewDate: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.CREATE_POLICIES)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = policySchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data
  const [policy] = await db.insert(policies).values({
    ...data,
    organizationId: session.orgId,
    ownerId: session.userId,
    effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined,
    reviewDate: data.reviewDate ? new Date(data.reviewDate) : undefined,
    status: 'draft',
  }).returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'policy.create',
    resourceType: 'policy',
    resourceId: policy.id,
    resourceTitle: policy.title,
    description: `Created policy: ${policy.title}`,
    request: req,
  })

  return NextResponse.json({ policy }, { status: 201 })
}
