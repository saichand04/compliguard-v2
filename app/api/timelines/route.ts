import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { timelines, timelinePhases } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { z } from 'zod'

/**
 * GET /api/timelines
 * List timelines for the organization (non-template by default).
 * ?templates=true to include templates.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId
  if (!orgId) return ApiErrors.forbidden()

  const includeTemplates = req.nextUrl.searchParams.get('templates') === 'true'

  const rows = await db
    .select()
    .from(timelines)
    .where(
      includeTemplates
        ? eq(timelines.organizationId, orgId)
        : and(eq(timelines.organizationId, orgId), eq(timelines.isTemplate, false))
    )
    .orderBy(desc(timelines.createdAt))

  // Attach phases for each timeline
  const result = await Promise.all(
    rows.map(async (tl) => {
      const phases = await db
        .select()
        .from(timelinePhases)
        .where(eq(timelinePhases.timelineId, tl.id))
        .orderBy(timelinePhases.orderIndex)
      return { ...tl, phases }
    })
  )

  return NextResponse.json({ timelines: result })
}

const createTimelineSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  frameworkId: z.string().uuid().optional(),
  isTemplate: z.boolean().optional().default(false),
  phases: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'overdue']).optional(),
        orderIndex: z.number().optional(),
      })
    )
    .optional(),
})

/**
 * POST /api/timelines
 * Create a new timeline (optionally with phases).
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId
  if (!orgId) return ApiErrors.forbidden()

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = createTimelineSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const { phases, ...timelineData } = result.data

  const [tl] = await db
    .insert(timelines)
    .values({
      ...timelineData,
      organizationId: orgId,
      createdBy: session.userId,
    })
    .returning()

  let insertedPhases: typeof timelinePhases.$inferSelect[] = []
  if (phases && phases.length > 0) {
    insertedPhases = await db
      .insert(timelinePhases)
      .values(
        phases.map((p, idx) => ({
          timelineId: tl.id,
          title: p.title,
          description: p.description,
          startDate: p.startDate ? new Date(p.startDate) : null,
          endDate: p.endDate ? new Date(p.endDate) : null,
          status: p.status || 'pending',
          orderIndex: p.orderIndex ?? idx,
        }))
      )
      .returning()
  }

  await writeAuditLog({
    organizationId: orgId,
    userId: session.userId,
    action: 'timeline.create',
    resourceType: 'timeline',
    resourceId: tl.id,
    resourceTitle: tl.title,
    description: `Created timeline: ${tl.title}`,
    request: req,
  })

  return NextResponse.json({ timeline: { ...tl, phases: insertedPhases } }, { status: 201 })
}
