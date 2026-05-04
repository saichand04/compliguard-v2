/**
 * app/api/integrations/aws/scan/route.ts
 * POST — trigger an AWS security scan
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { getIntegrationConfig, getIntegrationRow } from '@/lib/integrations/store'
import { runAWSChecks, type AWSConfig } from '@/lib/integrations/aws'
import { persistScanResults } from '@/lib/integrations/base'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const config = await getIntegrationConfig(session.orgId, 'aws')
  if (!config || !config.accessKeyId || !config.secretAccessKey) {
    return ApiErrors.badRequest('AWS integration not configured. Please save your credentials first.')
  }

  const row = await getIntegrationRow(session.orgId, 'aws')
  if (!row) {
    return ApiErrors.notFound('AWS integration')
  }

  try {
    const awsConfig: AWSConfig = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region ?? 'us-east-1',
      sessionToken: config.sessionToken,
    }

    const results = await runAWSChecks(awsConfig)

    const passed = results.filter((r) => r.status === 'pass').length
    const failed = results.filter((r) => r.status === 'fail').length
    const warned = results.filter((r) => r.status === 'warn').length
    const skipped = results.filter((r) => r.status === 'skip').length

    const summary = {
      integrationId: row.id,
      integrationName: row.name ?? 'AWS',
      scanType: 'security',
      totalChecks: results.length,
      passed,
      failed,
      warned,
      skipped,
      results,
      scannedAt: new Date(),
    }

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
    console.error('AWS scan error:', err)
    return ApiErrors.internal(
      `AWS scan failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    )
  }
}
