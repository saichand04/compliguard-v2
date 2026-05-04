import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { timelines, timelinePhases } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { z } from 'zod'

/**
 * GET /api/timelines/[id]
 * Get a single timeline with its phases.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { id } = await params

  const [tl] = await db.select().from(timelines).where(eq(timelines.id, id))
  if (!tl) return ApiErrors.notFound('Timeline')

  const phases = await db
    .select()
    .from(timelinePhases)
    .where(eq(timelinePhases.timelineId, id))
    .orderBy(timelinePhases.orderIndex)

  return NextResponse.json({ timeline: { ...tl, phases } })
}

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  frameworkId: z.string().uuid().optional().nullable(),
  isTemplate: z.boolean().optional(),
})

/**
 * PATCH /api/timelines/[id]
 * Update a timeline.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { id } = await params

  const [existing] = await db.select().from(timelines).where(eq(timelines.id, id))
  if (!existing) return ApiErrors.notFound('Timeline')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = patchSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const [updated] = await db
    .update(timelines)
    .set({ ...result.data, updatedAt: new Date() })
    .where(eq(timelines.id, id))
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'timeline.update',
    resourceType: 'timeline',
    resourceId: id,
    resourceTitle: updated.title,
    description: `Updated timeline: ${updated.title}`,
    request: req,
  })

  return NextResponse.json({ timeline: updated })
}

/**
 * DELETE /api/timelines/[id]
 * Delete a timeline and all its phases.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { id } = await params

  const [tl] = await db.select().from(timelines).where(eq(timelines.id, id))
  if (!tl) return ApiErrors.notFound('Timeline')

  await db.delete(timelines).where(eq(timelines.id, id))

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'timeline.delete',
    resourceType: 'timeline',
    resourceId: id,
    resourceTitle: tl.title,
    description: `Deleted timeline: ${tl.title}`,
    request: req,
  })

  return NextResponse.json({ success: true })
}
