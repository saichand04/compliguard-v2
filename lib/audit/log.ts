/**
 * Audit log helper for destructive operations.
 *
 * Thin re-export of writeAuditLog from lib/api/auth-helper so callers can
 * import a focused, single-purpose function: `logAudit({ ... })`.
 *
 * Use for DELETE handlers — pass a `before` snapshot of the row being removed.
 * `after` is intentionally absent for deletes.
 */

import { writeAuditLog } from '@/lib/api/auth-helper'
import type { NextRequest } from 'next/server'

export interface AuditLogInput {
  userId: string | null
  action: string
  entityType?: string
  entityId?: string
  entityTitle?: string
  organizationId: string | null
  before?: unknown
  after?: unknown
  description?: string
  request?: NextRequest
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  await writeAuditLog({
    organizationId: input.organizationId,
    userId: input.userId,
    action: input.action,
    resourceType: input.entityType,
    resourceId: input.entityId,
    resourceTitle: input.entityTitle,
    description: input.description,
    before: input.before,
    after: input.after,
    request: input.request,
  })
}
