import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

const createFindingSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).default('medium'),
  status: z.enum(['open', 'in_remediation', 'resolved', 'accepted', 'false_positive']).default('open'),
  source: z.enum(['aws', 'azure', 'gcp', 'github', 'pentest', 'manual', 'nl_test', 'integration']).default('manual'),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  affectedAsset: z.string().optional(),
  cveId: z.string().optional(),
  remediationGuidance: z.string().optional(),
  remediationSteps: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().optional(),
  acceptanceRationale: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * GET /api/findings
 * List findings with optional filters: severity, status, source, search, orgId
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_FINDINGS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { searchParams } = req.nextUrl
  const severity = searchParams.get('severity') || ''
  const status = searchParams.get('status') || ''
  const source = searchParams.get('source') || ''
  const search = searchParams.get('search') || ''
  const assignee = searchParams.get('assignee') || ''

  const records = await db
    .select()
    .from(findings)
    .where(eq(findings.organizationId, session.orgId))
    .orderBy(findings.createdAt)
    .limit(500)

  const filtered = records.filter((r) => {
    if (severity && r.severity !== severity) return false
    if (status && r.status !== status) return false
    if (source && r.source !== source) return false
    if (assignee && r.assignedTo !== assignee) return false
    if (search) {
      const s = search.toLowerCase()
      if (!r.title.toLowerCase().includes(s) && !(r.description?.toLowerCase().includes(s))) return false
    }
    return true
  })

  const stats = {
    critical: records.filter((r) => r.severity === 'critical').length,
    high: records.filter((r) => r.severity === 'high').length,
    medium: records.filter((r) => r.severity === 'medium').length,
    low: records.filter((r) => r.severity === 'low').length,
    info: records.filter((r) => r.severity === 'info').length,
  }

  return NextResponse.json({ findings: filtered, total: filtered.length, stats })
}

/**
 * POST /api/findings
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.CREATE_FINDINGS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = createFindingSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data

  const [record] = await db.insert(findings).values({
    organizationId: session.orgId,
    title: data.title,
    description: data.description,
    severity: data.severity,
    status: data.status,
    source: data.source,
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    affectedAsset: data.affectedAsset,
    cveId: data.cveId,
    remediationGuidance: data.remediationGuidance,
    remediationSteps: data.remediationSteps,
    assignedTo: data.assignedTo,
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    acceptanceRationale: data.acceptanceRationale,
    metadata: data.metadata,
  }).returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'finding.create',
    resourceType: 'finding',
    resourceId: record.id,
    resourceTitle: record.title,
    description: `Created finding: ${record.title}`,
    request: req,
  })

  return NextResponse.json({ finding: record }, { status: 201 })
}
