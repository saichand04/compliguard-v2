import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import {
  notifyNewFinding,
  notifyComplianceAlert,
  notifyIncidentCreated,
  broadcastMessage,
} from '@/lib/teams/notifications'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  let body: { type?: string; data?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const { type, data } = body
  if (!type || !data) {
    return ApiErrors.badRequest('type and data are required')
  }

  try {
    switch (type) {
      case 'finding':
        await notifyNewFinding(data as Parameters<typeof notifyNewFinding>[0])
        break
      case 'alert':
        await notifyComplianceAlert(data as Parameters<typeof notifyComplianceAlert>[0])
        break
      case 'incident':
        await notifyIncidentCreated(data as Parameters<typeof notifyIncidentCreated>[0])
        break
      case 'broadcast':
        await broadcastMessage((data.message as string) ?? JSON.stringify(data))
        break
      default:
        return ApiErrors.badRequest(`Unknown notification type: ${type}`)
    }

    return NextResponse.json({ success: true, type })
  } catch (err) {
    console.error('[Teams Notify] Error:', err)
    return ApiErrors.internal('Failed to send notification')
  }
}
