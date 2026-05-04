import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { integrations, integrationScanResults } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '@/lib/encryption'
import type { IntegrationCheckResult } from '@/lib/integrations/base'

type IntegrationScanSummary = {
  integrationId: string
  type: string
  name: string | null
  status: 'success' | 'error' | 'skipped'
  findingsCount: number
  checksCount: number
  error?: string
  duration: number
}

/**
 * POST /api/integrations/scan-all
 * Trigger all active integrations to run their scans in parallel.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.MANAGE_INTEGRATIONS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  // Get all active integrations for the org
  const activeIntegrations = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, session.orgId),
        eq(integrations.status, 'active'),
      ),
    )

  if (!activeIntegrations.length) {
    return NextResponse.json({
      scanned: 0,
      totalFindings: 0,
      integrations: [],
      message: 'No active integrations found.',
    })
  }

  // Run scans in parallel
  const scanResults = await Promise.allSettled(
    activeIntegrations.map((integration) => scanIntegration(integration, session.orgId!)),
  )

  const summaries: IntegrationScanSummary[] = scanResults.map((outcome, i) => {
    const intg = activeIntegrations[i]
    if (outcome.status === 'fulfilled') return outcome.value
    return {
      integrationId: intg.id,
      type: intg.type,
      name: intg.name,
      status: 'error' as const,
      findingsCount: 0,
      checksCount: 0,
      error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      duration: 0,
    }
  })

  const totalFindings = summaries.reduce((sum, s) => sum + s.findingsCount, 0)

  return NextResponse.json({
    scanned: summaries.length,
    totalFindings,
    integrations: summaries,
  })
}

async function scanIntegration(
  integration: typeof integrations.$inferSelect,
  orgId: string,
): Promise<IntegrationScanSummary> {
  const start = Date.now()

  // Decrypt credentials
  const config: Record<string, string> = {
    ...((integration.config as Record<string, string> | null) ?? {}),
  }

  if (integration.encryptedCredentials) {
    try {
      const decrypted = decrypt(integration.encryptedCredentials)
      const creds = JSON.parse(decrypted) as Record<string, string>
      Object.assign(config, creds)
    } catch {
      // Ignore decryption errors
    }
  }

  let checks: IntegrationCheckResult[] = []

  try {
    switch (integration.type) {
      case 'github': {
        const { runGitHubChecks } = await import('@/lib/integrations/github')
        checks = await runGitHubChecks(config.token ?? '', config.owner)
        break
      }
      case 'aws': {
        const { runAWSChecks } = await import('@/lib/integrations/aws')
        checks = await runAWSChecks({
          accessKeyId: config.accessKeyId ?? '',
          secretAccessKey: config.secretAccessKey ?? '',
          region: config.region ?? 'us-east-1',
          sessionToken: config.sessionToken,
        })
        break
      }
      case 'azure': {
        const { runAzureChecks } = await import('@/lib/integrations/azure')
        checks = await runAzureChecks({
          tenantId: config.tenantId ?? '',
          clientId: config.clientId ?? '',
          clientSecret: config.clientSecret ?? '',
          subscriptionId: config.subscriptionId ?? '',
        })
        break
      }
      case 'gcp': {
        const { runGCPChecks } = await import('@/lib/integrations/gcp')
        checks = await runGCPChecks({
          projectId: config.projectId ?? '',
          serviceAccountJson: config.serviceAccountJson ?? config.serviceAccountKey ?? '{}',
        })
        break
      }
      default:
        // Integration type doesn't have a scan function — skip gracefully
        break
    }

    const duration = Date.now() - start
    const findingsCount = checks.filter((c) => c.status === 'fail').length

    // Save scan result summary
    await db.insert(integrationScanResults).values({
      integrationId: integration.id,
      organizationId: orgId,
      scanType: 'full_scan',
      summary: { checksCount: checks.length, findingsCount, duration },
    })

    // Update lastSyncAt
    await db
      .update(integrations)
      .set({ lastSyncAt: new Date(), updatedAt: new Date(), errorMessage: null })
      .where(eq(integrations.id, integration.id))

    return {
      integrationId: integration.id,
      type: integration.type,
      name: integration.name,
      status: 'success',
      findingsCount,
      checksCount: checks.length,
      duration,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)

    await db
      .update(integrations)
      .set({ status: 'error', errorMessage: errorMsg, updatedAt: new Date() })
      .where(eq(integrations.id, integration.id))

    return {
      integrationId: integration.id,
      type: integration.type,
      name: integration.name,
      status: 'error',
      findingsCount: 0,
      checksCount: 0,
      error: errorMsg,
      duration: Date.now() - start,
    }
  }
}
