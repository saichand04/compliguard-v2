import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trainingModules, trainingCompletions } from '@/lib/db/schema/training'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'
import { randomUUID } from 'crypto'

type RouteContext = { params: Promise<{ id: string }> }

const completeSchema = z.object({
  score: z.number().int().min(0).max(100),
  timeSpent: z.number().int().min(0), // seconds
})

// POST /api/training/modules/[id]/complete
// Body: { score: number, timeSpent: number }
// Upserts completion record; returns pass/fail with certificateId if passed
export async function POST(req: NextRequest, context: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await context.params

  // Validate module exists and is active
  const [module] = await db
    .select()
    .from(trainingModules)
    .where(and(eq(trainingModules.id, id), eq(trainingModules.isActive, true)))

  if (!module) return ApiErrors.notFound('Training module')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON')
  }

  const result = completeSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const { score, timeSpent } = result.data
  const passingScore = module.passingScore ?? 80
  const passed = score >= passingScore

  // Check if a completion record already exists
  const [existing] = await db
    .select()
    .from(trainingCompletions)
    .where(
      and(
        eq(trainingCompletions.moduleId, id),
        eq(trainingCompletions.userId, session.userId)
      )
    )

  const now = new Date()
  const certificateKey = passed ? (existing?.certificateKey ?? randomUUID()) : (existing?.certificateKey ?? null)

  if (existing) {
    await db
      .update(trainingCompletions)
      .set({
        score,
        passed,
        completedAt: passed ? now : existing.completedAt,
        certificateKey: passed ? certificateKey : existing.certificateKey,
        attemptCount: (existing.attemptCount ?? 0) + 1,
        metadata: {
          ...((existing.metadata as Record<string, unknown>) ?? {}),
          lastTimeSpent: timeSpent,
          lastAttemptAt: now.toISOString(),
        },
      })
      .where(eq(trainingCompletions.id, existing.id))
  } else {
    await db.insert(trainingCompletions).values({
      moduleId: id,
      userId: session.userId,
      organizationId: session.orgId,
      score,
      passed,
      completedAt: passed ? now : null,
      certificateKey: passed ? certificateKey : null,
      attemptCount: 1,
      metadata: {
        lastTimeSpent: timeSpent,
        lastAttemptAt: now.toISOString(),
      },
    })
  }

  if (passed) {
    return NextResponse.json({
      passed: true,
      score,
      passingScore,
      certificateId: certificateKey,
    })
  } else {
    return NextResponse.json({
      passed: false,
      score,
      passingScore,
    })
  }
}
