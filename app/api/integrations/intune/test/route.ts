import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { getMSGraphToken, graphGet } from '@/lib/microsoft/graph'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  try {
    const body = (await req.json()) as {
      tenantId: string
      clientId: string
      clientSecret: string
    }

    if (!body.tenantId || !body.clientId || !body.clientSecret) {
      return ApiErrors.badRequest('tenantId, clientId, and clientSecret are required')
    }

    const token = await getMSGraphToken(body.tenantId, body.clientId, body.clientSecret)
    if (!token) {
      return NextResponse.json({ success: false, error: 'Failed to acquire token' }, { status: 400 })
    }

    // Verify Intune access by reading deviceManagement endpoint
    await graphGet<{ '@odata.context': string }>(token, '/deviceManagement')

    return NextResponse.json({
      success: true,
      message: 'Connection successful — Intune deviceManagement endpoint accessible.',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: msg }, { status: 400 })
  }
}
