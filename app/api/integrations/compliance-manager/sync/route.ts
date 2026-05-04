import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '@/lib/encryption'
import {
  getComplianceManagerScore,
  syncImprovementActionsToTasks,
  mapScoreToControls,
} from '@/lib/microsoft/compliance-manager'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!
  if (!orgId) return ApiErrors.forbidden()

  // Load Azure integration config
  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, 'azure')
      )
    )
    .limit(1)

  if (!row) {
    return ApiErrors.badRequest('Microsoft Azure integration not configured. Please add credentials first.')
  }

  const config = row.config as Record<string, unknown> | null
  const tenantId = config?.tenantId as string | undefined

  if (!tenantId) {
    return ApiErrors.badRequest('tenantId missing from integration config')
  }

  let clientId = ''
  let clientSecret = ''

  if (row.encryptedCredentials) {
    try {
      const decrypted = decrypt(row.encryptedCredentials)
      const parsed = JSON.parse(decrypted) as Record<string, unknown>
      clientId = (parsed.clientId as string) ?? ''
      clientSecret = (parsed.clientSecret as string) ?? ''
    } catch {
      return ApiErrors.internal('Failed to decrypt credentials')
    }
  }

  if (!clientId || !clientSecret) {
    return ApiErrors.badRequest('Credentials missing or incomplete')
  }

  try {
    // 1. Fetch compliance score
    const score = await getComplianceManagerScore(tenantId, clientId, clientSecret)

    // 2. Sync improvement actions to tasks
    const tasksCreated = await syncImprovementActionsToTasks(orgId, score)

    // 3. Map score to controls
    await mapScoreToControls(orgId, score)

    // 4. Update last sync time
    await db
      .update(integrations)
      .set({ lastSyncAt: new Date(), updatedAt: new Date(), status: 'active' })
      .where(eq(integrations.id, row.id))

    return NextResponse.json({
      success: true,
      currentScore: score.currentScore,
      maxScore: score.maxScore,
      percentageScore: score.percentageScore,
      frameworkCount: score.frameworks.length,
      improvementActionsCount: score.improvementActions.length,
      tasksCreated,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    await db
      .update(integrations)
      .set({ status: 'error', errorMessage: message, updatedAt: new Date() })
      .where(eq(integrations.id, row.id))
    return ApiErrors.internal(message)
  }
}
