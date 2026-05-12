import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dnsIssues } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { z } from 'zod'

const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const
const STATUSES = ['open', 'in_progress', 'remediated', 'accepted', 'false_positive'] as const
const ISSUE_TYPES = [
  'misconfiguration', 'dangling_record', 'missing_spf', 'missing_dmarc',
  'missing_dkim', 'zone_transfer', 'subdomain_takeover', 'cache_poisoning',
  'wildcard_record', 'other',
] as const

const patchIssueSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional().nullable(),
  severity: z.enum(SEVERITIES).optional(),
  status: z.enum(STATUSES).optional(),
  issueType: z.enum(ISSUE_TYPES).optional(),
  affectedRecord: z.string().max(500).optional().nullable(),
  recordType: z.string().max(50).optional().nullable(),
  affectedDomain: z.string().max(255).optional().nullable(),
  currentValue: z.string().optional().nullable(),
  expectedValue: z.string().optional().nullable(),
  riskDetails: z.string().optional().nullable(),
  remediation: z.string().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  resolvedAt: z.string().optional().nullable(),
})

/**
 * GET /api/dns-audit/issues/[id]
 * Get a single DNS issue by ID.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [issue] = await db
    .select()
    .from(dnsIssues)
    .where(and(eq(dnsIssues.id, id), eq(dnsIssues.organizationId, session.orgId)))

  if (!issue) return ApiErrors.notFound('DNS Issue')

  return NextResponse.json({ issue })
}

/**
 * PATCH /api/dns-audit/issues/[id]
 * Update a DNS issue.
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
    .from(dnsIssues)
    .where(and(eq(dnsIssues.id, id), eq(dnsIssues.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('DNS Issue')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = patchIssueSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() }

  if (data.title !== undefined) updatePayload.title = data.title
  if (data.description !== undefined) updatePayload.description = data.description
  if (data.severity !== undefined) updatePayload.severity = data.severity
  if (data.status !== undefined) updatePayload.status = data.status
  if (data.issueType !== undefined) updatePayload.issueType = data.issueType
  if (data.affectedRecord !== undefined) updatePayload.affectedRecord = data.affectedRecord
  if (data.recordType !== undefined) updatePayload.recordType = data.recordType
  if (data.affectedDomain !== undefined) updatePayload.affectedDomain = data.affectedDomain
  if (data.currentValue !== undefined) updatePayload.currentValue = data.currentValue
  if (data.expectedValue !== undefined) updatePayload.expectedValue = data.expectedValue
  if (data.riskDetails !== undefined) updatePayload.riskDetails = data.riskDetails
  if (data.remediation !== undefined) updatePayload.remediation = data.remediation
  if (data.assignedTo !== undefined) updatePayload.assignedTo = data.assignedTo
  if (data.dueDate !== undefined) updatePayload.dueDate = data.dueDate ? new Date(data.dueDate) : null
  if (data.resolvedAt !== undefined) updatePayload.resolvedAt = data.resolvedAt ? new Date(data.resolvedAt) : null

  const [updated] = await db
    .update(dnsIssues)
    .set(updatePayload)
    .where(and(eq(dnsIssues.id, id), eq(dnsIssues.organizationId, session.orgId)))
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'dns_issue.update',
    resourceType: 'dns_issue',
    resourceId: id,
    resourceTitle: existing.title,
    description: `Updated DNS issue: ${existing.title}`,
    request: req,
  })

  return NextResponse.json({ issue: updated })
}

/**
 * DELETE /api/dns-audit/issues/[id]
 * Delete a DNS issue and cascade evidence/comments.
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
    .from(dnsIssues)
    .where(and(eq(dnsIssues.id, id), eq(dnsIssues.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('DNS Issue')

  await db
    .delete(dnsIssues)
    .where(and(eq(dnsIssues.id, id), eq(dnsIssues.organizationId, session.orgId)))

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'dns_issue.delete',
    resourceType: 'dns_issue',
    resourceId: id,
    resourceTitle: existing.title,
    description: `Deleted DNS issue: ${existing.title}`,
    request: req,
  })

  return NextResponse.json({ success: true })
}
