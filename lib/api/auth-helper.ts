import { getSessionFromRequest } from '@/lib/auth/jwt'
import { NextRequest, NextResponse } from 'next/server'
import type { SessionPayload } from '@/lib/auth/jwt'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'

/**
 * Require authenticated session for an API route.
 * Returns the session or sends a 401 response.
 */
export async function requireAuth(req: NextRequest): Promise<SessionPayload | null> {
  const session = await getSessionFromRequest(req)
  if (!session) return null
  return session
}

/**
 * Write an audit log entry.
 */
export async function writeAuditLog(params: {
  organizationId: string | null
  userId: string | null
  action: string
  resourceType?: string
  resourceId?: string
  resourceTitle?: string
  description?: string
  before?: unknown
  after?: unknown
  request?: NextRequest
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      organizationId: params.organizationId,
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceTitle: params.resourceTitle,
      description: params.description,
      before: params.before as Record<string, unknown> | undefined,
      after: params.after as Record<string, unknown> | undefined,
      ipAddress: params.request?.headers.get('x-forwarded-for') || params.request?.headers.get('x-real-ip') || undefined,
      userAgent: params.request?.headers.get('user-agent') || undefined,
    })
  } catch {
    // Audit log failures should not break the main request
  }
}

/**
 * Standard error responses.
 */
export const ApiErrors = {
  unauthorized: () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  forbidden: () => NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
  notFound: (resource = 'Resource') => NextResponse.json({ error: `${resource} not found` }, { status: 404 }),
  badRequest: (message: string) => NextResponse.json({ error: message }, { status: 400 }),
  internal: (message = 'Internal server error') => NextResponse.json({ error: message }, { status: 500 }),
}
