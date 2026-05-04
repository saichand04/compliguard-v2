import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trainingCompletions, trainingModules } from '@/lib/db/schema/training'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

// GET /api/training/stats — return training statistics for current user
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  // All active modules
  const allModules = await db
    .select({
      id: trainingModules.id,
      metadata: trainingModules.metadata,
    })
    .from(trainingModules)
    .where(eq(trainingModules.isActive, true))

  // User's completions
  const completions = await db
    .select()
    .from(trainingCompletions)
    .where(eq(trainingCompletions.userId, session.userId))

  const totalModules = allModules.length
  const passedCompletions = completions.filter((c) => c.passed === true)
  const completedModules = passedCompletions.length

  const scores = completions
    .filter((c) => c.score !== null)
    .map((c) => c.score as number)

  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : 0

  const passRate =
    completions.length > 0
      ? Math.round((passedCompletions.length / completions.length) * 100)
      : 0

  // Completions by category
  const completionsByCategory: Record<string, { total: number; completed: number }> = {}

  for (const mod of allModules) {
    const category =
      (mod.metadata as Record<string, string> | null)?.category ?? 'General'
    if (!completionsByCategory[category]) {
      completionsByCategory[category] = { total: 0, completed: 0 }
    }
    completionsByCategory[category].total++
  }

  for (const c of passedCompletions) {
    const mod = allModules.find((m) => m.id === c.moduleId)
    if (mod) {
      const category =
        (mod.metadata as Record<string, string> | null)?.category ?? 'General'
      if (completionsByCategory[category]) {
        completionsByCategory[category].completed++
      }
    }
  }

  return NextResponse.json({
    totalModules,
    completedModules,
    passRate,
    avgScore,
    // Placeholder values — could be calculated with renewal date logic
    overdueCertificates: 0,
    upcomingRenewals: 0,
    completionsByCategory,
  })
}
