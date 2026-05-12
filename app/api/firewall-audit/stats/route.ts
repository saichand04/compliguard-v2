import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { firewallFindings } from '@/lib/db/schema'
import { eq, and, sql, count } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

/**
 * GET /api/firewall-audit/stats
 *
 * Returns aggregate firewall finding statistics for the organisation.
 * Optional query param: auditId — scope stats to a single audit.
 *
 * Response:
 * {
 *   total: number,
 *   open: number,
 *   inProgress: number,
 *   remediated: number,
 *   accepted: number,
 *   falsePositive: number,
 *   bySeverity: { critical, high, medium, low, info }
 * }
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const url = new URL(req.url)
  const auditId = url.searchParams.get('auditId')

  const conditions = [eq(firewallFindings.organizationId, session.orgId)]
  if (auditId) conditions.push(eq(firewallFindings.auditId, auditId))

  const [stats] = await db
    .select({
      total: count(),
      open: sql<number>`count(*) filter (where ${firewallFindings.status} = 'open')`,
      inProgress: sql<number>`count(*) filter (where ${firewallFindings.status} = 'in_progress')`,
      remediated: sql<number>`count(*) filter (where ${firewallFindings.status} = 'remediated')`,
      accepted: sql<number>`count(*) filter (where ${firewallFindings.status} = 'accepted')`,
      falsePositive: sql<number>`count(*) filter (where ${firewallFindings.status} = 'false_positive')`,
      critical: sql<number>`count(*) filter (where ${firewallFindings.severity} = 'critical')`,
      high: sql<number>`count(*) filter (where ${firewallFindings.severity} = 'high')`,
      medium: sql<number>`count(*) filter (where ${firewallFindings.severity} = 'medium')`,
      low: sql<number>`count(*) filter (where ${firewallFindings.severity} = 'low')`,
      info: sql<number>`count(*) filter (where ${firewallFindings.severity} = 'info')`,
    })
    .from(firewallFindings)
    .where(and(...conditions))

  return NextResponse.json({
    total: Number(stats?.total ?? 0),
    open: Number(stats?.open ?? 0),
    inProgress: Number(stats?.inProgress ?? 0),
    remediated: Number(stats?.remediated ?? 0),
    accepted: Number(stats?.accepted ?? 0),
    falsePositive: Number(stats?.falsePositive ?? 0),
    bySeverity: {
      critical: Number(stats?.critical ?? 0),
      high: Number(stats?.high ?? 0),
      medium: Number(stats?.medium ?? 0),
      low: Number(stats?.low ?? 0),
      info: Number(stats?.info ?? 0),
    },
  })
}
