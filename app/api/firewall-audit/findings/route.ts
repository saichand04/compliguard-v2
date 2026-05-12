import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { firewallFindings } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { z } from 'zod'

const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const
const STATUSES = ['open', 'in_progress', 'remediated', 'accepted', 'false_positive'] as const

const createFindingSchema = z.object({
  auditId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  severity: z.enum(SEVERITIES).default('medium'),
  status: z.enum(STATUSES).default('open'),
  ruleId: z.string().max(255).optional().nullable(),
  affectedDevice: z.string().max(255).optional().nullable(),
  affectedZone: z.string().max(255).optional().nullable(),
  riskDetails: z.string().optional().nullable(),
  remediation: z.string().optional().nullable(),
  cvssScore: z.string().max(10).optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
})

/**
 * GET /api/firewall-audit/findings
 * List findings for the org, with optional filters: auditId, severity, status.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const url = new URL(req.url)
  const auditId = url.searchParams.get('auditId')
  const severity = url.searchParams.get('severity')
  const status = url.searchParams.get('status')

  const conditions = [eq(firewallFindings.organizationId, session.orgId)]
  if (auditId) conditions.push(eq(firewallFindings.auditId, auditId))
  if (severity) conditions.push(eq(firewallFindings.severity, severity as typeof SEVERITIES[number]))
  if (status) conditions.push(eq(firewallFindings.status, status as typeof STATUSES[number]))

  const findings = await db
    .select()
    .from(firewallFindings)
    .where(and(...conditions))
    .orderBy(desc(firewallFindings.createdAt))

  return NextResponse.json({ findings })
}

/**
 * POST /api/firewall-audit/findings
 * Create a new firewall finding.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = createFindingSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data

  const [finding] = await db
    .insert(firewallFindings)
    .values({
      organizationId: session.orgId,
      auditId: data.auditId,
      title: data.title,
      description: data.description,
      severity: data.severity,
      status: data.status,
      ruleId: data.ruleId,
      affectedDevice: data.affectedDevice,
      affectedZone: data.affectedZone,
      riskDetails: data.riskDetails,
      remediation: data.remediation,
      cvssScore: data.cvssScore,
      assignedTo: data.assignedTo,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdBy: session.userId,
    })
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'firewall_finding.create',
    resourceType: 'firewall_finding',
    resourceId: finding.id,
    resourceTitle: finding.title,
    description: `Created firewall finding: ${finding.title}`,
    request: req,
  })

  return NextResponse.json({ finding }, { status: 201 })
}
