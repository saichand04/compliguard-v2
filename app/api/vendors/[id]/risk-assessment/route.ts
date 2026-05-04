import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { vendors, vendorRiskAssessments } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const createAssessmentSchema = z.object({
  inherentScore: z.number().int().min(1).max(25).optional(),
  residualScore: z.number().int().min(1).max(25).optional(),
  findings: z.string().optional(),
  recommendations: z.string().optional(),
  nextAssessmentDate: z.string().optional(),
  // Also update vendor risk levels
  inherentRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  residualRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
})

/** GET /api/vendors/[id]/risk-assessment — list assessment history */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  // Verify vendor belongs to org
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, id), eq(vendors.organizationId, session.orgId)))

  if (!vendor) return ApiErrors.notFound('Vendor')

  const history = await db
    .select()
    .from(vendorRiskAssessments)
    .where(and(eq(vendorRiskAssessments.vendorId, id), eq(vendorRiskAssessments.organizationId, session.orgId)))
    .orderBy(desc(vendorRiskAssessments.assessmentDate))

  return NextResponse.json({ assessments: history, total: history.length })
}

/** POST /api/vendors/[id]/risk-assessment — create new assessment */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  // Verify vendor belongs to org
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, id), eq(vendors.organizationId, session.orgId)))

  if (!vendor) return ApiErrors.notFound('Vendor')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = createAssessmentSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const data = result.data

  const [assessment] = await db.insert(vendorRiskAssessments).values({
    vendorId: id,
    organizationId: session.orgId,
    inherentScore: data.inherentScore,
    residualScore: data.residualScore,
    findings: data.findings,
    recommendations: data.recommendations,
    conductedBy: session.userId,
    nextAssessmentDate: data.nextAssessmentDate ? new Date(data.nextAssessmentDate) : undefined,
  }).returning()

  // Update vendor risk levels if provided
  const vendorUpdate: Record<string, unknown> = { updatedAt: new Date() }
  if (data.inherentRiskLevel) vendorUpdate.inherentRiskLevel = data.inherentRiskLevel
  if (data.residualRiskLevel) vendorUpdate.residualRiskLevel = data.residualRiskLevel
  if (data.riskScore !== undefined) vendorUpdate.riskScore = data.riskScore
  if (data.nextAssessmentDate) vendorUpdate.nextReviewDate = new Date(data.nextAssessmentDate)

  if (Object.keys(vendorUpdate).length > 1) {
    await db.update(vendors).set(vendorUpdate).where(eq(vendors.id, id))
  }

  return NextResponse.json({ assessment }, { status: 201 })
}
