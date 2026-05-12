import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dnsAudits, dnsIssues } from '@/lib/db/schema'
import { eq, and, desc, count, sql } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { z } from 'zod'

const AUDIT_TYPES = ['external', 'internal', 'both'] as const
const AUDIT_STATUSES = ['active', 'completed', 'archived'] as const

const createAuditSchema = z.object({
  name: z.string().min(1).max(500),
  auditType: z.enum(AUDIT_TYPES).default('both'),
  domain: z.string().max(255).optional().nullable(),
  scope: z.string().optional().nullable(),
  auditDate: z.string().optional().nullable(),
  auditorName: z.string().max(255).optional().nullable(),
  status: z.enum(AUDIT_STATUSES).default('active'),
  reportFileUrl: z.string().optional().nullable(),
  reportFileName: z.string().max(500).optional().nullable(),
})

/**
 * GET /api/dns-audit/audits
 * List all DNS audits for the org, with aggregate issue stats.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const auditList = await db
    .select()
    .from(dnsAudits)
    .where(eq(dnsAudits.organizationId, session.orgId))
    .orderBy(desc(dnsAudits.createdAt))

  // Attach issue counts per audit
  const issueCounts = await db
    .select({
      auditId: dnsIssues.auditId,
      total: count(),
      open: sql<number>`count(*) filter (where ${dnsIssues.status} = 'open')`,
      inProgress: sql<number>`count(*) filter (where ${dnsIssues.status} = 'in_progress')`,
      remediated: sql<number>`count(*) filter (where ${dnsIssues.status} = 'remediated')`,
      critical: sql<number>`count(*) filter (where ${dnsIssues.severity} = 'critical')`,
      high: sql<number>`count(*) filter (where ${dnsIssues.severity} = 'high')`,
    })
    .from(dnsIssues)
    .where(eq(dnsIssues.organizationId, session.orgId))
    .groupBy(dnsIssues.auditId)

  const countMap = Object.fromEntries(issueCounts.map((c) => [c.auditId, c]))

  const auditsWithStats = auditList.map((a) => ({
    ...a,
    stats: countMap[a.id] ?? { total: 0, open: 0, inProgress: 0, remediated: 0, critical: 0, high: 0 },
  }))

  return NextResponse.json({ audits: auditsWithStats })
}

/**
 * POST /api/dns-audit/audits
 * Create a new DNS audit.
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
    .insert(dnsAudits)
    .values({
      organizationId: session.orgId,
      name: data.name,
      auditType: data.auditType,
      domain: data.domain,
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
    action: 'dns_audit.create',
    resourceType: 'dns_audit',
    resourceId: audit.id,
    resourceTitle: audit.name,
    description: `Created DNS audit: ${audit.name}`,
    request: req,
  })

  return NextResponse.json({ audit }, { status: 201 })
}
