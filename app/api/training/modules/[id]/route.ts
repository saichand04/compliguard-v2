import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trainingModules, trainingCompletions } from '@/lib/db/schema/training'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/training/modules/[id] — single module with full content + user completion status
export async function GET(req: NextRequest, context: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { id } = await context.params

  const [module] = await db
    .select()
    .from(trainingModules)
    .where(and(eq(trainingModules.id, id), eq(trainingModules.isActive, true)))

  if (!module) return ApiErrors.notFound('Training module')

  // Fetch user completion status
  let completion = null
  if (session.userId) {
    const [comp] = await db
      .select()
      .from(trainingCompletions)
      .where(
        and(
          eq(trainingCompletions.moduleId, id),
          eq(trainingCompletions.userId, session.userId)
        )
      )
    if (comp) completion = comp
  }

  return NextResponse.json({
    module: {
      ...module,
      category: (module.metadata as Record<string, string> | null)?.category ?? 'General',
      difficulty: (module.metadata as Record<string, string> | null)?.difficulty ?? 'beginner',
    },
    completion,
  })
}

const updateModuleSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  contentType: z.enum(['text', 'video', 'scorm', 'quiz']).optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
  category: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
})

// PUT /api/training/modules/[id] — update module (admin only)
export async function PUT(req: NextRequest, context: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!['admin', 'super_admin', 'compliance_manager'].includes(session.role)) {
    return ApiErrors.forbidden()
  }

  const { id } = await context.params

  const [existing] = await db
    .select()
    .from(trainingModules)
    .where(eq(trainingModules.id, id))

  if (!existing) return ApiErrors.notFound('Training module')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON')
  }

  const result = updateModuleSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const { category, difficulty, ...data } = result.data

  const existingMeta = (existing.metadata as Record<string, string> | null) ?? {}
  const newMeta = {
    ...existingMeta,
    ...(category ? { category } : {}),
    ...(difficulty ? { difficulty } : {}),
  }

  const [updated] = await db
    .update(trainingModules)
    .set({
      ...data,
      metadata: newMeta,
      updatedAt: new Date(),
    })
    .where(eq(trainingModules.id, id))
    .returning()

  return NextResponse.json({ module: updated })
}

// DELETE /api/training/modules/[id] — soft delete (admin only)
export async function DELETE(req: NextRequest, context: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!['admin', 'super_admin'].includes(session.role)) {
    return ApiErrors.forbidden()
  }

  const { id } = await context.params

  const [existing] = await db
    .select()
    .from(trainingModules)
    .where(eq(trainingModules.id, id))

  if (!existing) return ApiErrors.notFound('Training module')

  await db
    .update(trainingModules)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(trainingModules.id, id))

  return NextResponse.json({ success: true })
}
