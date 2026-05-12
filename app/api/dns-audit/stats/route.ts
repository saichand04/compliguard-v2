import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dnsIssues } from '@/lib/db/schema'
import { eq, and, sql, count } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

/**
 * GET /api/dns-audit/stats
 *
 * Returns aggregate DNS issue statistics for the organisation.
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
 *   bySeverity: { critical, high, medium, low, info },
 *   byType: { misconfiguration, dangling_record, missing_spf, missing_dmarc, missing_dkim,
 *             zone_transfer, subdomain_takeover, cache_poisoning, wildcard_record, other }
 * }
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const url = new URL(req.url)
  const auditId = url.searchParams.get('auditId')

  const conditions = [eq(dnsIssues.organizationId, session.orgId)]
  if (auditId) conditions.push(eq(dnsIssues.auditId, auditId))

  const [stats] = await db
    .select({
      total: count(),
      open: sql<number>`count(*) filter (where ${dnsIssues.status} = 'open')`,
      inProgress: sql<number>`count(*) filter (where ${dnsIssues.status} = 'in_progress')`,
      remediated: sql<number>`count(*) filter (where ${dnsIssues.status} = 'remediated')`,
      accepted: sql<number>`count(*) filter (where ${dnsIssues.status} = 'accepted')`,
      falsePositive: sql<number>`count(*) filter (where ${dnsIssues.status} = 'false_positive')`,
      critical: sql<number>`count(*) filter (where ${dnsIssues.severity} = 'critical')`,
      high: sql<number>`count(*) filter (where ${dnsIssues.severity} = 'high')`,
      medium: sql<number>`count(*) filter (where ${dnsIssues.severity} = 'medium')`,
      low: sql<number>`count(*) filter (where ${dnsIssues.severity} = 'low')`,
      info: sql<number>`count(*) filter (where ${dnsIssues.severity} = 'info')`,
      typeMisconfiguration: sql<number>`count(*) filter (where ${dnsIssues.issueType} = 'misconfiguration')`,
      typeDanglingRecord: sql<number>`count(*) filter (where ${dnsIssues.issueType} = 'dangling_record')`,
      typeMissingSpf: sql<number>`count(*) filter (where ${dnsIssues.issueType} = 'missing_spf')`,
      typeMissingDmarc: sql<number>`count(*) filter (where ${dnsIssues.issueType} = 'missing_dmarc')`,
      typeMissingDkim: sql<number>`count(*) filter (where ${dnsIssues.issueType} = 'missing_dkim')`,
      typeZoneTransfer: sql<number>`count(*) filter (where ${dnsIssues.issueType} = 'zone_transfer')`,
      typeSubdomainTakeover: sql<number>`count(*) filter (where ${dnsIssues.issueType} = 'subdomain_takeover')`,
      typeCachePoisoning: sql<number>`count(*) filter (where ${dnsIssues.issueType} = 'cache_poisoning')`,
      typeWildcardRecord: sql<number>`count(*) filter (where ${dnsIssues.issueType} = 'wildcard_record')`,
      typeOther: sql<number>`count(*) filter (where ${dnsIssues.issueType} = 'other')`,
    })
    .from(dnsIssues)
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
    byType: {
      misconfiguration: Number(stats?.typeMisconfiguration ?? 0),
      dangling_record: Number(stats?.typeDanglingRecord ?? 0),
      missing_spf: Number(stats?.typeMissingSpf ?? 0),
      missing_dmarc: Number(stats?.typeMissingDmarc ?? 0),
      missing_dkim: Number(stats?.typeMissingDkim ?? 0),
      zone_transfer: Number(stats?.typeZoneTransfer ?? 0),
      subdomain_takeover: Number(stats?.typeSubdomainTakeover ?? 0),
      cache_poisoning: Number(stats?.typeCachePoisoning ?? 0),
      wildcard_record: Number(stats?.typeWildcardRecord ?? 0),
      other: Number(stats?.typeOther ?? 0),
    },
  })
}
