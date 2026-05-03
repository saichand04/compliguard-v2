import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { riskAssessments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_RISKS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const severity = searchParams.get('severity')

  const records = await db
    .select()
    .from(riskAssessments)
    .where(eq(riskAssessments.organizationId, session.orgId))
    .limit(100)

  const filtered = records.filter((r) => {
    if (status && r.status !== status) return false
    if (severity && r.severity !== severity) return false
    return true
  })

  return NextResponse.json({ risks: filtered, total: filtered.length })
}

const riskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  asset: z.string().optional(),
  threat: z.string().optional(),
  vulnerability: z.string().optional(),
  inherentLikelihood: z.number().int().min(1).max(5).optional(),
  inherentImpact: z.number().int().min(1).max(5).optional(),
  mitigationPlan: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.CREATE_RISKS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = riskSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.errors[0].message)

  const data = result.data
  const inherentScore = data.inherentLikelihood && data.inherentImpact
    ? data.inherentLikelihood * data.inherentImpact
    : undefined

  const [risk] = await db.insert(riskAssessments).values({
    ...data,
    organizationId: session.orgId,
    inherentScore,
    status: 'identified',
  }).returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'risk.create',
    resourceType: 'risk',
    resourceId: risk.id,
    resourceTitle: risk.title,
    description: `Created risk: ${risk.title}`,
    request: req,
  })

  return NextResponse.json({ risk }, { status: 201 })
}
