import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { firewallAudits, firewallFindings } from '@/lib/db/schema'
import { eq, and, desc, count, sql } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { z } from 'zod'

const AUDIT_TYPES = ['perimeter', 'internal', 'cloud', 'waf', 'ngfw', 'other'] as const
const AUDIT_STATUSES = ['open', 'in_progress', 'remediated', 'accepted', 'false_positive'] as const

const createAuditSchema = z.object({
  name: z.string().min(1).max(500),
  auditType: z.enum(AUDIT_TYPES).default('perimeter'),
  vendor: z.string().max(255).optional().nullable(),
  deviceName: z.string().max(255).optional().nullable(),
  scope: z.string().optional().nullable(),
  auditDate: z.string().optional().nullable(),
  auditorName: z.string().max(255).optional().nullable(),
  status: z.enum(AUDIT_STATUSES).default('open'),
  reportFileUrl: z.string().optional().nullable(),
  reportFileName: z.string().max(500).optional().nullable(),
})

/**
 * GET /api/firewall-audit/audits
 * List all firewall audits for the org, with aggregate finding stats.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const auditList = await db
    .select()
    .from(firewallAudits)
    .where(eq(firewallAudits.organizationId, session.orgId))
    .orderBy(desc(firewallAudits.createdAt))

  // Attach finding counts per audit
  const findingCounts = await db
    .select({
      auditId: firewallFindings.auditId,
      total: count(),
      open: sql<number>`count(*) filter (where ${firewallFindings.status} = 'open')`,
      inProgress: sql<number>`count(*) filter (where ${firewallFindings.status} = 'in_progress')`,
      remediated: sql<number>`count(*) filter (where ${firewallFindings.status} = 'remediated')`,
      critical: sql<number>`count(*) filter (where ${firewallFindings.severity} = 'critical')`,
      high: sql<number>`count(*) filter (where ${firewallFindings.severity} = 'high')`,
    })
    .from(firewallFindings)
    .where(eq(firewallFindings.organizationId, session.orgId))
    .groupBy(firewallFindings.auditId)

  const countMap = Object.fromEntries(findingCounts.map((c) => [c.auditId, c]))

  const auditsWithStats = auditList.map((a) => ({
    ...a,
    stats: countMap[a.id] ?? { total: 0, open: 0, inProgress: 0, remediated: 0, critical: 0, high: 0 },
  }))

  return NextResponse.json({ audits: auditsWithStats })
}

/**
 * POST /api/firewall-audit/audits
 * Create a new firewall audit.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = createAuditSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data

  const [audit] = await db
    .insert(firewallAudits)
    .values({
      organizationId: session.orgId,
      name: data.name,
      auditType: data.auditType,
      vendor: data.vendor,
      deviceName: data.deviceName,
      scope: data.scope,
      auditDate: data.auditDate ? new Date(data.auditDate) : null,
      auditorName: data.auditorName,
      status: data.status,
      reportFileUrl: data.reportFileUrl,
      reportFileName: data.reportFileName,
      createdBy: session.userId,
    })
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'firewall_audit.create',
    resourceType: 'firewall_audit',
    resourceId: audit.id,
    resourceTitle: audit.name,
    description: `Created firewall audit: ${audit.name}`,
    request: req,
  })

  return NextResponse.json({ audit }, { status: 201 })
}
