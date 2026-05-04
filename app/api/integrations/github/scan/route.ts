/**
 * app/api/integrations/github/scan/route.ts
 * POST — trigger a GitHub security scan
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { getIntegrationConfig, getIntegrationRow } from '@/lib/integrations/store'
import { runGitHubChecks } from '@/lib/integrations/github'
import { persistScanResults } from '@/lib/integrations/base'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  // Get integration config
  const config = await getIntegrationConfig(session.orgId, 'github')
  if (!config || !config.token) {
    return ApiErrors.badRequest('GitHub integration not configured. Please save your token first.')
  }

  const row = await getIntegrationRow(session.orgId, 'github')
  if (!row) {
    return ApiErrors.notFound('GitHub integration')
  }

  try {
    // Run all checks
    const results = await runGitHubChecks(config.token, config.owner)

    const passed = results.filter((r) => r.status === 'pass').length
    const failed = results.filter((r) => r.status === 'fail').length
    const warned = results.filter((r) => r.status === 'warn').length
    const skipped = results.filter((r) => r.status === 'skip').length

    const summary = {
      integrationId: row.id,
      integrationName: row.name ?? 'GitHub',
      scanType: 'security',
      totalChecks: results.length,
      passed,
      failed,
      warned,
      skipped,
      results,
      scannedAt: new Date(),
    }

    // Persist results and create findings
    await persistScanResults(session.orgId, summary)

    return NextResponse.json({
      success: true,
      summary: {
        totalChecks: results.length,
        passed,
        failed,
        warned,
        skipped,
        scannedAt: summary.scannedAt,
      },
      results,
    })
  } catch (err) {
    console.error('GitHub scan error:', err)
    return ApiErrors.internal(
      `GitHub scan failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    )
  }
}
