import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { firewallFindings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { z } from 'zod'

const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const
const STATUSES = ['open', 'in_progress', 'remediated', 'accepted', 'false_positive'] as const

const patchFindingSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional().nullable(),
  severity: z.enum(SEVERITIES).optional(),
  status: z.enum(STATUSES).optional(),
  ruleId: z.string().max(255).optional().nullable(),
  affectedDevice: z.string().max(255).optional().nullable(),
  affectedZone: z.string().max(255).optional().nullable(),
  riskDetails: z.string().optional().nullable(),
  remediation: z.string().optional().nullable(),
  cvssScore: z.string().max(10).optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  resolvedAt: z.string().optional().nullable(),
})

/**
 * GET /api/firewall-audit/findings/[id]
 * Get a single finding by ID.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [finding] = await db
    .select()
    .from(firewallFindings)
    .where(and(eq(firewallFindings.id, id), eq(firewallFindings.organizationId, session.orgId)))

  if (!finding) return ApiErrors.notFound('Firewall Finding')

  return NextResponse.json({ finding })
}

/**
 * PATCH /api/firewall-audit/findings/[id]
 * Update a finding.
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
    .from(firewallFindings)
    .where(and(eq(firewallFindings.id, id), eq(firewallFindings.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('Firewall Finding')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = patchFindingSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() }

  if (data.title !== undefined) updatePayload.title = data.title
  if (data.description !== undefined) updatePayload.description = data.description
  if (data.severity !== undefined) updatePayload.severity = data.severity
  if (data.status !== undefined) updatePayload.status = data.status
  if (data.ruleId !== undefined) updatePayload.ruleId = data.ruleId
  if (data.affectedDevice !== undefined) updatePayload.affectedDevice = data.affectedDevice
  if (data.affectedZone !== undefined) updatePayload.affectedZone = data.affectedZone
  if (data.riskDetails !== undefined) updatePayload.riskDetails = data.riskDetails
  if (data.remediation !== undefined) updatePayload.remediation = data.remediation
  if (data.cvssScore !== undefined) updatePayload.cvssScore = data.cvssScore
  if (data.assignedTo !== undefined) updatePayload.assignedTo = data.assignedTo
  if (data.dueDate !== undefined) updatePayload.dueDate = data.dueDate ? new Date(data.dueDate) : null
  if (data.resolvedAt !== undefined) updatePayload.resolvedAt = data.resolvedAt ? new Date(data.resolvedAt) : null

  const [updated] = await db
    .update(firewallFindings)
    .set(updatePayload)
    .where(and(eq(firewallFindings.id, id), eq(firewallFindings.organizationId, session.orgId)))
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'firewall_finding.update',
    resourceType: 'firewall_finding',
    resourceId: id,
    resourceTitle: existing.title,
    description: `Updated firewall finding: ${existing.title}`,
    request: req,
  })

  return NextResponse.json({ finding: updated })
}

/**
 * DELETE /api/firewall-audit/findings/[id]
 * Delete a finding and cascade evidence/comments.
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
    .from(firewallFindings)
    .where(and(eq(firewallFindings.id, id), eq(firewallFindings.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('Firewall Finding')

  await db
    .delete(firewallFindings)
    .where(and(eq(firewallFindings.id, id), eq(firewallFindings.organizationId, session.orgId)))

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'firewall_finding.delete',
    resourceType: 'firewall_finding',
    resourceId: id,
    resourceTitle: existing.title,
    description: `Deleted firewall finding: ${existing.title}`,
    request: req,
  })

  return NextResponse.json({ success: true })
}
