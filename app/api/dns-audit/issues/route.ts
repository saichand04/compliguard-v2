import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dnsIssues } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { z } from 'zod'

const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const
const STATUSES = ['open', 'in_progress', 'remediated', 'accepted', 'false_positive'] as const
const ISSUE_TYPES = [
  'misconfiguration', 'dangling_record', 'missing_spf', 'missing_dmarc',
  'missing_dkim', 'zone_transfer', 'subdomain_takeover', 'cache_poisoning',
  'wildcard_record', 'other',
] as const

const createIssueSchema = z.object({
  auditId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  severity: z.enum(SEVERITIES).default('medium'),
  status: z.enum(STATUSES).default('open'),
  issueType: z.enum(ISSUE_TYPES).default('misconfiguration'),
  affectedRecord: z.string().max(500).optional().nullable(),
  recordType: z.string().max(50).optional().nullable(),
  affectedDomain: z.string().max(255).optional().nullable(),
  currentValue: z.string().optional().nullable(),
  expectedValue: z.string().optional().nullable(),
  riskDetails: z.string().optional().nullable(),
  remediation: z.string().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
})

/**
 * GET /api/dns-audit/issues
 * List DNS issues for the org, with optional filters: auditId, severity, status, issueType.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const url = new URL(req.url)
  const auditId = url.searchParams.get('auditId')
  const severity = url.searchParams.get('severity')
  const status = url.searchParams.get('status')
  const issueType = url.searchParams.get('issueType')

  const conditions = [eq(dnsIssues.organizationId, session.orgId)]
  if (auditId) conditions.push(eq(dnsIssues.auditId, auditId))
  if (severity) conditions.push(eq(dnsIssues.severity, severity as typeof SEVERITIES[number]))
  if (status) conditions.push(eq(dnsIssues.status, status as typeof STATUSES[number]))
  if (issueType) conditions.push(eq(dnsIssues.issueType, issueType as typeof ISSUE_TYPES[number]))

  const issues = await db
    .select()
    .from(dnsIssues)
    .where(and(...conditions))
    .orderBy(desc(dnsIssues.createdAt))

  return NextResponse.json({ issues })
}

/**
 * POST /api/dns-audit/issues
 * Create a new DNS issue.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = createIssueSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data

  const [issue] = await db
    .insert(dnsIssues)
    .values({
      organizationId: session.orgId,
      auditId: data.auditId,
      title: data.title,
      description: data.description,
      severity: data.severity,
      status: data.status,
      issueType: data.issueType,
      affectedRecord: data.affectedRecord,
      recordType: data.recordType,
      affectedDomain: data.affectedDomain,
      currentValue: data.currentValue,
      expectedValue: data.expectedValue,
      riskDetails: data.riskDetails,
      remediation: data.remediation,
      assignedTo: data.assignedTo,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdBy: session.userId,
    })
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'dns_issue.create',
    resourceType: 'dns_issue',
    resourceId: issue.id,
    resourceTitle: issue.title,
    description: `Created DNS issue: ${issue.title}`,
    request: req,
  })

  return NextResponse.json({ issue }, { status: 201 })
}
