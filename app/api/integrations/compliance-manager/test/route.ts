import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { getMSGraphToken } from '@/lib/microsoft/graph'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!
  if (!orgId) return ApiErrors.forbidden()

  const body = (await req.json()) as {
    tenantId?: string
    clientId?: string
    clientSecret?: string
  }

  const { tenantId, clientId, clientSecret } = body

  if (!tenantId || !clientId || !clientSecret) {
    return ApiErrors.badRequest('tenantId, clientId, and clientSecret are required')
  }

  try {
    const token = await getMSGraphToken(tenantId, clientId, clientSecret)

    // Test Compliance Manager API access
    const testRes = await fetch(
      'https://graph.microsoft.com/beta/compliance/complianceScores',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!testRes.ok && testRes.status !== 404) {
      const errBody = await testRes.text()
      return NextResponse.json({
        success: false,
        error: `Compliance Manager API returned ${testRes.status}: ${errBody.slice(0, 200)}`,
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Microsoft Compliance Manager connection verified',
      apiAccessible: testRes.ok,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Connection test failed',
    }, { status: 400 })
  }
}
