import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { vendors } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const patchVendorSchema = z.object({
  name: z.string().min(1).optional(),
  website: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'under_review', 'terminated']).optional(),
  inherentRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional().nullable(),
  residualRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional().nullable(),
  riskScore: z.number().int().min(0).max(100).optional().nullable(),
  dpaStatus: z.string().optional().nullable(),
  dpaSignedAt: z.string().optional().nullable(),
  nextReviewDate: z.string().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
})

/** GET /api/vendors/[id] */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, id), eq(vendors.organizationId, session.orgId)))

  if (!vendor) return ApiErrors.notFound('Vendor')

  return NextResponse.json({ vendor })
}

/** PATCH /api/vendors/[id] */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = patchVendorSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const data = result.data
  const updateData: Record<string, unknown> = { updatedAt: new Date() }

  if (data.name !== undefined) updateData.name = data.name
  if (data.website !== undefined) updateData.website = data.website
  if (data.contactName !== undefined) updateData.contactName = data.contactName
  if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail
  if (data.category !== undefined) updateData.category = data.category
  if (data.description !== undefined) updateData.description = data.description
  if (data.status !== undefined) updateData.status = data.status
  if (data.inherentRiskLevel !== undefined) updateData.inherentRiskLevel = data.inherentRiskLevel
  if (data.residualRiskLevel !== undefined) updateData.residualRiskLevel = data.residualRiskLevel
  if (data.riskScore !== undefined) updateData.riskScore = data.riskScore
  if (data.dpaStatus !== undefined) updateData.dpaStatus = data.dpaStatus
  if (data.dpaSignedAt !== undefined) updateData.dpaSignedAt = data.dpaSignedAt ? new Date(data.dpaSignedAt as string) : null
  if (data.nextReviewDate !== undefined) updateData.nextReviewDate = data.nextReviewDate ? new Date(data.nextReviewDate as string) : null
  if (data.ownerId !== undefined) updateData.ownerId = data.ownerId

  const [updated] = await db
    .update(vendors)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set(updateData as any)
    .where(and(eq(vendors.id, id), eq(vendors.organizationId, session.orgId)))
    .returning()

  if (!updated) return ApiErrors.notFound('Vendor')

  return NextResponse.json({ vendor: updated })
}

/** DELETE /api/vendors/[id] */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [deleted] = await db
    .delete(vendors)
    .where(and(eq(vendors.id, id), eq(vendors.organizationId, session.orgId)))
    .returning()

  if (!deleted) return ApiErrors.notFound('Vendor')

  return NextResponse.json({ success: true })
}
