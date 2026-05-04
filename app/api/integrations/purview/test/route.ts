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
    // Attempt to get a Graph token — confirms credentials work
    const token = await getMSGraphToken(tenantId, clientId, clientSecret)

    // Verify Purview API access
    const testRes = await fetch(
      'https://graph.microsoft.com/beta/security/informationProtection/sensitivityLabels',
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (!testRes.ok) {
      const errBody = await testRes.text()
      return NextResponse.json({
        success: false,
        error: `Purview API returned ${testRes.status}: ${errBody.slice(0, 200)}`,
      }, { status: 400 })
    }

    const data = (await testRes.json()) as { value?: unknown[] }
    return NextResponse.json({
      success: true,
      message: 'Microsoft Purview connection verified',
      labelCount: data.value?.length ?? 0,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Connection test failed',
    }, { status: 400 })
  }
}
