import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations, integrationScanResults, findings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '@/lib/encryption'
import { runPurviewChecks } from '@/lib/microsoft/purview'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!
  if (!orgId) return ApiErrors.forbidden()

  // Load Azure integration config (Purview uses same tenant credentials)
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
    return ApiErrors.badRequest('Microsoft Purview integration not configured. Please add Azure credentials first.')
  }

  const config = row.config as Record<string, unknown> | null
  const tenantId = config?.tenantId as string | undefined

  if (!tenantId) {
    return ApiErrors.badRequest('tenantId is missing from integration config')
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
    return ApiErrors.badRequest('clientId or clientSecret missing from credentials')
  }

  try {
    const results = await runPurviewChecks(tenantId, clientId, clientSecret)

    const passed = results.filter(r => r.status === 'pass').length
    const failed = results.filter(r => r.status === 'fail').length

    // Store scan results
    await db.insert(integrationScanResults).values({
      integrationId: row.id,
      organizationId: orgId,
      scanType: 'purview',
      rawResults: results as unknown as Record<string, unknown>[],
      summary: {
        totalChecks: results.length,
        passed,
        failed,
        categories: {
          dlp: results.filter(r => r.category === 'dlp').length,
          information_protection: results.filter(r => r.category === 'information_protection').length,
          data_catalog: results.filter(r => r.category === 'data_catalog').length,
          audit: results.filter(r => r.category === 'audit').length,
        },
      } as Record<string, unknown>,
    })

    // Create findings for high/critical failures
    const highSeverityFails = results.filter(
      r => r.status === 'fail' && (r.severity === 'critical' || r.severity === 'high')
    )
    for (const check of highSeverityFails) {
      try {
        await db.insert(findings).values({
          organizationId: orgId,
          title: check.title,
          description: check.recommendation,
          severity: check.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
          status: 'open',
          source: 'azure',
          resourceType: 'purview',
          resourceId: check.checkId,
          remediationGuidance: check.recommendation,
          metadata: {
            checkId: check.checkId,
            category: check.category,
            nistControls: check.nistControls,
          } as Record<string, unknown>,
        })
      } catch {
        // Skip duplicates
      }
    }

    // Update last sync time
    await db
      .update(integrations)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(integrations.id, row.id))

    return NextResponse.json({
      success: true,
      totalChecks: results.length,
      passed,
      failed,
      results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed'
    await db
      .update(integrations)
      .set({ status: 'error', errorMessage: message, updatedAt: new Date() })
      .where(eq(integrations.id, row.id))
    return ApiErrors.internal(message)
  }
}
