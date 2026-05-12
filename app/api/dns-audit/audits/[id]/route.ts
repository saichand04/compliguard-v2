import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dnsAudits, dnsIssues } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { z } from 'zod'

const AUDIT_TYPES = ['external', 'internal', 'both'] as const
const AUDIT_STATUSES = ['active', 'completed', 'archived'] as const

const patchAuditSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  auditType: z.enum(AUDIT_TYPES).optional(),
  domain: z.string().max(255).optional().nullable(),
  scope: z.string().optional().nullable(),
  auditDate: z.string().optional().nullable(),
  auditorName: z.string().max(255).optional().nullable(),
  status: z.enum(AUDIT_STATUSES).optional(),
  reportFileUrl: z.string().optional().nullable(),
  reportFileName: z.string().max(500).optional().nullable(),
})

/**
 * GET /api/dns-audit/audits/[id]
 * Get DNS audit detail with all its issues.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [audit] = await db
    .select()
    .from(dnsAudits)
    .where(and(eq(dnsAudits.id, id), eq(dnsAudits.organizationId, session.orgId)))

  if (!audit) return ApiErrors.notFound('DNS Audit')

  const issues = await db
    .select()
    .from(dnsIssues)
    .where(and(eq(dnsIssues.auditId, id), eq(dnsIssues.organizationId, session.orgId)))
    .orderBy(desc(dnsIssues.createdAt))

  return NextResponse.json({ audit, issues })
}

/**
 * PATCH /api/dns-audit/audits/[id]
 * Update DNS audit metadata.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [existing] = await db
    .select()
    .from(dnsAudits)
    .where(and(eq(dnsAudits.id, id), eq(dnsAudits.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('DNS Audit')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = patchAuditSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() }

  if (data.name !== undefined) updatePayload.name = data.name
  if (data.auditType !== undefined) updatePayload.auditType = data.auditType
  if (data.domain !== undefined) updatePayload.domain = data.domain
  if (data.scope !== undefined) updatePayload.scope = data.scope
  if (data.auditDate !== undefined) updatePayload.auditDate = data.auditDate ? new Date(data.auditDate) : null
  if (data.auditorName !== undefined) updatePayload.auditorName = data.auditorName
  if (data.status !== undefined) updatePayload.status = data.status
  if (data.reportFileUrl !== undefined) updatePayload.reportFileUrl = data.reportFileUrl
  if (data.reportFileName !== undefined) updatePayload.reportFileName = data.reportFileName

  const [updated] = await db
    .update(dnsAudits)
    .set(updatePayload)
    .where(and(eq(dnsAudits.id, id), eq(dnsAudits.organizationId, session.orgId)))
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'dns_audit.update',
    resourceType: 'dns_audit',
    resourceId: id,
    resourceTitle: existing.name,
    description: `Updated DNS audit: ${existing.name}`,
    request: req,
  })

  return NextResponse.json({ audit: updated })
}

/**
 * DELETE /api/dns-audit/audits/[id]
 * Delete audit and cascade all issues/evidence/comments.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [existing] = await db
    .select()
    .from(dnsAudits)
    .where(and(eq(dnsAudits.id, id), eq(dnsAudits.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('DNS Audit')

  await db
    .delete(dnsAudits)
    .where(and(eq(dnsAudits.id, id), eq(dnsAudits.organizationId, session.orgId)))

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'dns_audit.delete',
    resourceType: 'dns_audit',
    resourceId: id,
    resourceTitle: existing.name,
    description: `Deleted DNS audit: ${existing.name}`,
    request: req,
  })

  return NextResponse.json({ success: true })
}
