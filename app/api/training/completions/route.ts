import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trainingCompletions, trainingModules } from '@/lib/db/schema/training'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

// GET /api/training/completions — list all completions for current user with module details
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const completions = await db
    .select({
      id: trainingCompletions.id,
      moduleId: trainingCompletions.moduleId,
      userId: trainingCompletions.userId,
      organizationId: trainingCompletions.organizationId,
      completedAt: trainingCompletions.completedAt,
      score: trainingCompletions.score,
      passed: trainingCompletions.passed,
      attemptCount: trainingCompletions.attemptCount,
      certificateKey: trainingCompletions.certificateKey,
      metadata: trainingCompletions.metadata,
      createdAt: trainingCompletions.createdAt,
      // Module fields
      moduleTitle: trainingModules.title,
      moduleDescription: trainingModules.description,
      moduleEstimatedMinutes: trainingModules.estimatedMinutes,
      modulePassingScore: trainingModules.passingScore,
      moduleMetadata: trainingModules.metadata,
    })
    .from(trainingCompletions)
    .leftJoin(trainingModules, eq(trainingCompletions.moduleId, trainingModules.id))
    .where(eq(trainingCompletions.userId, session.userId))

  const enriched = completions.map((c) => ({
    ...c,
    moduleCategory:
      (c.moduleMetadata as Record<string, string> | null)?.category ?? 'General',
    moduleDifficulty:
      (c.moduleMetadata as Record<string, string> | null)?.difficulty ?? 'beginner',
  }))

  return NextResponse.json({ completions: enriched, total: enriched.length })
}
