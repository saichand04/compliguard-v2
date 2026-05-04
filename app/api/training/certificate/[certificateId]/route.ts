import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trainingCompletions, trainingModules } from '@/lib/db/schema/training'
import { users } from '@/lib/db/schema/users'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

type RouteContext = { params: Promise<{ certificateId: string }> }

// GET /api/training/certificate/[certificateId] — return certificate data
export async function GET(req: NextRequest, context: RouteContext) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { certificateId } = await context.params

  // Find completion by certificate key
  const [completion] = await db
    .select({
      id: trainingCompletions.id,
      moduleId: trainingCompletions.moduleId,
      userId: trainingCompletions.userId,
      completedAt: trainingCompletions.completedAt,
      score: trainingCompletions.score,
      passed: trainingCompletions.passed,
      certificateKey: trainingCompletions.certificateKey,
    })
    .from(trainingCompletions)
    .where(eq(trainingCompletions.certificateKey, certificateId))

  if (!completion) return ApiErrors.notFound('Certificate')
  if (!completion.passed) return ApiErrors.notFound('Certificate')

  // Fetch module info
  const [module] = await db
    .select({
      title: trainingModules.title,
      description: trainingModules.description,
      metadata: trainingModules.metadata,
    })
    .from(trainingModules)
    .where(eq(trainingModules.id, completion.moduleId))

  // Fetch user info
  const [user] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, completion.userId))

  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email ?? 'Unknown User'

  return NextResponse.json({
    certificateId,
    recipientName: fullName,
    recipientEmail: user?.email ?? null,
    moduleTitle: module?.title ?? 'Unknown Module',
    moduleCategory:
      (module?.metadata as Record<string, string> | null)?.category ?? 'General',
    score: completion.score,
    completedAt: completion.completedAt,
    issuedAt: completion.completedAt,
  })
}
