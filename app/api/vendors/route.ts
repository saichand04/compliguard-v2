import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { vendors } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const createVendorSchema = z.object({
  name: z.string().min(1),
  website: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'under_review', 'terminated']).optional(),
  inherentRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  residualRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
  dpaStatus: z.string().optional(),
  dpaSignedAt: z.string().optional(),
  nextReviewDate: z.string().optional(),
  ownerId: z.string().uuid().optional(),
})

/** GET /api/vendors — list all vendors for org */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const rows = await db
    .select()
    .from(vendors)
    .where(eq(vendors.organizationId, session.orgId))
    .orderBy(desc(vendors.createdAt))

  return NextResponse.json({ vendors: rows, total: rows.length })
}

/** POST /api/vendors — create vendor */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = createVendorSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const data = result.data

  const [vendor] = await db.insert(vendors).values({
    organizationId: session.orgId,
    name: data.name,
    website: data.website,
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    category: data.category,
    description: data.description,
    status: data.status ?? 'active',
    inherentRiskLevel: data.inherentRiskLevel,
    residualRiskLevel: data.residualRiskLevel,
    riskScore: data.riskScore,
    dpaStatus: data.dpaStatus,
    dpaSignedAt: data.dpaSignedAt ? new Date(data.dpaSignedAt) : undefined,
    nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : undefined,
    ownerId: data.ownerId,
  }).returning()

  return NextResponse.json({ vendor }, { status: 201 })
}
