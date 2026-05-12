import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { firewallAudits, firewallFindings } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { z } from 'zod'

const AUDIT_TYPES = ['perimeter', 'internal', 'cloud', 'waf', 'ngfw', 'other'] as const
const AUDIT_STATUSES = ['open', 'in_progress', 'remediated', 'accepted', 'false_positive'] as const

const patchAuditSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  auditType: z.enum(AUDIT_TYPES).optional(),
  vendor: z.string().max(255).optional().nullable(),
  deviceName: z.string().max(255).optional().nullable(),
  scope: z.string().optional().nullable(),
  auditDate: z.string().optional().nullable(),
  auditorName: z.string().max(255).optional().nullable(),
  status: z.enum(AUDIT_STATUSES).optional(),
  reportFileUrl: z.string().optional().nullable(),
  reportFileName: z.string().max(500).optional().nullable(),
})

/**
 * GET /api/firewall-audit/audits/[id]
 * Get audit detail with all its findings.
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
    .from(firewallAudits)
    .where(and(eq(firewallAudits.id, id), eq(firewallAudits.organizationId, session.orgId)))

  if (!audit) return ApiErrors.notFound('Firewall Audit')

  const findings = await db
    .select()
    .from(firewallFindings)
    .where(and(eq(firewallFindings.auditId, id), eq(firewallFindings.organizationId, session.orgId)))
    .orderBy(desc(firewallFindings.createdAt))

  return NextResponse.json({ audit, findings })
}

/**
 * PATCH /api/firewall-audit/audits/[id]
 * Update audit metadata.
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
    .from(firewallAudits)
    .where(and(eq(firewallAudits.id, id), eq(firewallAudits.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('Firewall Audit')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = patchAuditSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() }

  if (data.name !== undefined) updatePayload.name = data.name
  if (data.auditType !== undefined) updatePayload.auditType = data.auditType
  if (data.vendor !== undefined) updatePayload.vendor = data.vendor
  if (data.deviceName !== undefined) updatePayload.deviceName = data.deviceName
  if (data.scope !== undefined) updatePayload.scope = data.scope
  if (data.auditDate !== undefined) updatePayload.auditDate = data.auditDate ? new Date(data.auditDate) : null
  if (data.auditorName !== undefined) updatePayload.auditorName = data.auditorName
  if (data.status !== undefined) updatePayload.status = data.status
  if (data.reportFileUrl !== undefined) updatePayload.reportFileUrl = data.reportFileUrl
  if (data.reportFileName !== undefined) updatePayload.reportFileName = data.reportFileName

  const [updated] = await db
    .update(firewallAudits)
    .set(updatePayload)
    .where(and(eq(firewallAudits.id, id), eq(firewallAudits.organizationId, session.orgId)))
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'firewall_audit.update',
    resourceType: 'firewall_audit',
    resourceId: id,
    resourceTitle: existing.name,
    description: `Updated firewall audit: ${existing.name}`,
    request: req,
  })

  return NextResponse.json({ audit: updated })
}

/**
 * DELETE /api/firewall-audit/audits/[id]
 * Delete audit and cascade all findings/evidence/comments.
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
    .from(firewallAudits)
    .where(and(eq(firewallAudits.id, id), eq(firewallAudits.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('Firewall Audit')

  await db
    .delete(firewallAudits)
    .where(and(eq(firewallAudits.id, id), eq(firewallAudits.organizationId, session.orgId)))

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'firewall_audit.delete',
    resourceType: 'firewall_audit',
    resourceId: id,
    resourceTitle: existing.name,
    description: `Deleted firewall audit: ${existing.name}`,
    request: req,
  })

  return NextResponse.json({ success: true })
}
