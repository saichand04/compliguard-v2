import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { timelinePhases } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { z } from 'zod'

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'completed', 'overdue']).optional(),
  orderIndex: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * PATCH /api/timelines/[id]/phases/[pid]
 * Update a timeline phase.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { id, pid } = await params

  const [existing] = await db
    .select()
    .from(timelinePhases)
    .where(and(eq(timelinePhases.id, pid), eq(timelinePhases.timelineId, id)))

  if (!existing) return ApiErrors.notFound('Phase')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = patchSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const { startDate, endDate, ...rest } = result.data

  const [updated] = await db
    .update(timelinePhases)
    .set({
      ...rest,
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
    })
    .where(and(eq(timelinePhases.id, pid), eq(timelinePhases.timelineId, id)))
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'timeline.phase.update',
    resourceType: 'timeline_phase',
    resourceId: pid,
    resourceTitle: updated.title,
    description: `Updated phase "${updated.title}"`,
    request: req,
  })

  return NextResponse.json({ phase: updated })
}

/**
 * DELETE /api/timelines/[id]/phases/[pid]
 * Delete a phase.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { id, pid } = await params

  const [phase] = await db
    .select()
    .from(timelinePhases)
    .where(and(eq(timelinePhases.id, pid), eq(timelinePhases.timelineId, id)))

  if (!phase) return ApiErrors.notFound('Phase')

  await db.delete(timelinePhases).where(and(eq(timelinePhases.id, pid), eq(timelinePhases.timelineId, id)))

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'timeline.phase.delete',
    resourceType: 'timeline_phase',
    resourceId: pid,
    resourceTitle: phase.title,
    description: `Deleted phase "${phase.title}"`,
    request: req,
  })

  return NextResponse.json({ success: true })
}
