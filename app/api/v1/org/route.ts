import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { organizations, organizationFrameworks, controlAssignments, findings, vendors } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'

export async function GET(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:org')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData

  try {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    // Framework count
    const [frameworkCountResult] = await db
      .select({ value: count() })
      .from(organizationFrameworks)
      .where(and(eq(organizationFrameworks.organizationId, orgId), eq(organizationFrameworks.isActive, true)))

    // Control count and compliance summary
    const controlAssignmentRecords = await db
      .select({ status: controlAssignments.status })
      .from(controlAssignments)
      .where(eq(controlAssignments.organizationId, orgId))

    const controlCount = controlAssignmentRecords.length
    const implementedCount = controlAssignmentRecords.filter(c => c.status === 'implemented').length
    const inProgressCount = controlAssignmentRecords.filter(c => c.status === 'in_progress').length
    const notStartedCount = controlAssignmentRecords.filter(c => c.status === 'not_started').length
    const complianceScore = controlCount > 0
      ? Math.round((implementedCount / controlCount) * 100)
      : 0

    // Open findings
    const [openFindingsResult] = await db
      .select({ value: count() })
      .from(findings)
      .where(and(eq(findings.organizationId, orgId), eq(findings.status, 'open')))

    // Active vendors
    const [vendorCountResult] = await db
      .select({ value: count() })
      .from(vendors)
      .where(and(eq(vendors.organizationId, orgId), eq(vendors.status, 'active')))

    return NextResponse.json({
      success: true,
      data: {
        id: org.id,
        name: org.name,
        domain: org.domain,
        industry: org.industry,
        size: org.size,
        slug: org.slug,
        createdAt: org.createdAt,
        stats: {
          frameworkCount: frameworkCountResult?.value ?? 0,
          controlCount,
          complianceScore,
          controlSummary: {
            implemented: implementedCount,
            inProgress: inProgressCount,
            notStarted: notStartedCount,
            total: controlCount,
          },
          openFindings: openFindingsResult?.value ?? 0,
          activeVendors: vendorCountResult?.value ?? 0,
        },
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
