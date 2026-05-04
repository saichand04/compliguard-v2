import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { timelines, timelinePhases } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { z } from 'zod'

/**
 * GET /api/timelines/[id]/phases
 * List phases for a timeline.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { id } = await params

  const [tl] = await db.select({ id: timelines.id }).from(timelines).where(eq(timelines.id, id))
  if (!tl) return ApiErrors.notFound('Timeline')

  const phases = await db
    .select()
    .from(timelinePhases)
    .where(eq(timelinePhases.timelineId, id))
    .orderBy(timelinePhases.orderIndex)

  return NextResponse.json({ phases })
}

const createPhaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'overdue']).optional().default('pending'),
  orderIndex: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * POST /api/timelines/[id]/phases
 * Add a phase to a timeline.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { id } = await params

  const [tl] = await db.select({ id: timelines.id }).from(timelines).where(eq(timelines.id, id))
  if (!tl) return ApiErrors.notFound('Timeline')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = createPhaseSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  // Get current max order index
  const existingPhases = await db
    .select({ orderIndex: timelinePhases.orderIndex })
    .from(timelinePhases)
    .where(eq(timelinePhases.timelineId, id))

  const maxOrder = existingPhases.reduce((max, p) => Math.max(max, p.orderIndex ?? 0), -1)

  const [phase] = await db
    .insert(timelinePhases)
    .values({
      timelineId: id,
      title: result.data.title,
      description: result.data.description,
      startDate: result.data.startDate ? new Date(result.data.startDate) : null,
      endDate: result.data.endDate ? new Date(result.data.endDate) : null,
      status: result.data.status,
      orderIndex: result.data.orderIndex ?? maxOrder + 1,
      metadata: result.data.metadata || null,
    })
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'timeline.phase.create',
    resourceType: 'timeline_phase',
    resourceId: phase.id,
    resourceTitle: phase.title,
    description: `Added phase "${phase.title}" to timeline`,
    request: req,
  })

  return NextResponse.json({ phase }, { status: 201 })
}
