/**
 * app/api/integrations/aws/test/route.ts
 * POST — test AWS credentials using STS GetCallerIdentity
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { testAWSCredentials, type AWSConfig } from '@/lib/integrations/aws'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const body = await req.json() as {
    accessKeyId?: string
    secretAccessKey?: string
    region?: string
    sessionToken?: string
  }

  if (!body.accessKeyId || !body.secretAccessKey || !body.region) {
    return ApiErrors.badRequest('accessKeyId, secretAccessKey, and region are required')
  }

  try {
    const awsConfig: AWSConfig = {
      accessKeyId: body.accessKeyId,
      secretAccessKey: body.secretAccessKey,
      region: body.region,
      sessionToken: body.sessionToken,
    }

    const identity = await testAWSCredentials(awsConfig)

    return NextResponse.json({
      success: true,
      identity,
    })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'AWS authentication failed',
      },
      { status: 401 },
    )
  }
}
