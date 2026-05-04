import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trainingModules, trainingCompletions } from '@/lib/db/schema/training'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

// GET /api/training/modules — list all active modules with user completion stats
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  // Fetch all active modules (built-in global + org-specific)
  const modules = await db
    .select()
    .from(trainingModules)
    .where(eq(trainingModules.isActive, true))

  // Fetch user's completions
  const completions = session.userId
    ? await db
        .select()
        .from(trainingCompletions)
        .where(eq(trainingCompletions.userId, session.userId))
    : []

  const completionMap = new Map(completions.map((c) => [c.moduleId, c]))

  const modulesWithStatus = modules.map((mod) => {
    const completion = completionMap.get(mod.id)
    return {
      ...mod,
      category: (mod.metadata as Record<string, string> | null)?.category ?? 'General',
      difficulty: (mod.metadata as Record<string, string> | null)?.difficulty ?? 'beginner',
      completion: completion
        ? {
            completedAt: completion.completedAt,
            score: completion.score,
            passed: completion.passed,
            certificateKey: completion.certificateKey,
            attemptCount: completion.attemptCount,
          }
        : null,
    }
  })

  return NextResponse.json({ modules: modulesWithStatus, total: modulesWithStatus.length })
}

const createModuleSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  content: z.string().optional(),
  contentType: z.enum(['text', 'video', 'scorm', 'quiz']).default('text'),
  estimatedMinutes: z.number().int().positive().optional(),
  passingScore: z.number().int().min(0).max(100).default(80),
  isRequired: z.boolean().default(false),
  category: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
})

// POST /api/training/modules — create module (admin only)
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!['admin', 'super_admin', 'compliance_manager'].includes(session.role)) {
    return ApiErrors.forbidden()
  }
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON')
  }

  const result = createModuleSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const { category, difficulty, ...data } = result.data

  const [module] = await db
    .insert(trainingModules)
    .values({
      ...data,
      organizationId: session.orgId,
      createdBy: session.userId,
      metadata: { category: category ?? 'General', difficulty: difficulty ?? 'beginner' },
    })
    .returning()

  return NextResponse.json({ module }, { status: 201 })
}
