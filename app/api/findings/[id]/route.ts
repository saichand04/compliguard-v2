import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

const patchFindingSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'in_remediation', 'resolved', 'accepted', 'false_positive']).optional(),
  source: z.enum(['aws', 'azure', 'gcp', 'github', 'pentest', 'manual', 'nl_test', 'integration']).optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  affectedAsset: z.string().optional(),
  cveId: z.string().optional(),
  remediationGuidance: z.string().optional(),
  remediationSteps: z.string().optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  acceptanceRationale: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * GET /api/findings/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_FINDINGS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [record] = await db
    .select()
    .from(findings)
    .where(and(eq(findings.id, id), eq(findings.organizationId, session.orgId)))

  if (!record) return ApiErrors.notFound('Finding')
  return NextResponse.json({ finding: record })
}

/**
 * PATCH /api/findings/[id]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.EDIT_FINDINGS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [existing] = await db
    .select()
    .from(findings)
    .where(and(eq(findings.id, id), eq(findings.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('Finding')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = patchFindingSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() }

  if (data.title !== undefined) updatePayload.title = data.title
  if (data.description !== undefined) updatePayload.description = data.description
  if (data.severity !== undefined) updatePayload.severity = data.severity
  if (data.status !== undefined) {
    updatePayload.status = data.status
    if (data.status === 'resolved') {
      updatePayload.resolvedAt = new Date()
      updatePayload.resolvedBy = session.userId
    } else if (data.status === 'accepted') {
      updatePayload.acceptedAt = new Date()
      updatePayload.acceptedBy = session.userId
      if (data.acceptanceRationale) updatePayload.acceptanceRationale = data.acceptanceRationale
    }
  }
  if (data.source !== undefined) updatePayload.source = data.source
  if (data.resourceType !== undefined) updatePayload.resourceType = data.resourceType
  if (data.resourceId !== undefined) updatePayload.resourceId = data.resourceId
  if (data.affectedAsset !== undefined) updatePayload.affectedAsset = data.affectedAsset
  if (data.cveId !== undefined) updatePayload.cveId = data.cveId
  if (data.remediationGuidance !== undefined) updatePayload.remediationGuidance = data.remediationGuidance
  if (data.remediationSteps !== undefined) updatePayload.remediationSteps = data.remediationSteps
  if (data.assignedTo !== undefined) updatePayload.assignedTo = data.assignedTo
  if (data.dueDate !== undefined) updatePayload.dueDate = data.dueDate ? new Date(data.dueDate) : null
  if (data.metadata !== undefined) updatePayload.metadata = data.metadata

  const [updated] = await db
    .update(findings)
    .set(updatePayload)
    .where(and(eq(findings.id, id), eq(findings.organizationId, session.orgId)))
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'finding.update',
    resourceType: 'finding',
    resourceId: id,
    resourceTitle: existing.title,
    description: `Updated finding: ${existing.title}`,
    request: req,
  })

  return NextResponse.json({ finding: updated })
}

/**
 * DELETE /api/findings/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.EDIT_FINDINGS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [existing] = await db
    .select()
    .from(findings)
    .where(and(eq(findings.id, id), eq(findings.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('Finding')

  await db
    .delete(findings)
    .where(and(eq(findings.id, id), eq(findings.organizationId, session.orgId)))

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'finding.delete',
    resourceType: 'finding',
    resourceId: id,
    resourceTitle: existing.title,
    description: `Deleted finding: ${existing.title}`,
    request: req,
  })

  return NextResponse.json({ success: true })
}
