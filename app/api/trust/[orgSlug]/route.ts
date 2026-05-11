/**
 * GET /api/trust/[orgSlug]
 * Public endpoint — no auth required.
 * Returns public-safe trust portal data for an organization.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { organizations } from '@/lib/db/schema/organizations'
import {
  organizationFrameworks,
  frameworks,
  controls,
  controlAssignments,
} from '@/lib/db/schema/frameworks'
import { eq, and, count } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params

  // Look up org by slug
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1)

  // Refuse (with 404 — do NOT reveal whether the slug exists) if the org has
  // not opted into the public Trust Portal via the trustPublic flag.
  if (!org || org.trustPublic !== true) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // Get active org frameworks with framework details
  const orgFrameworkRows = await db
    .select({
      orgFramework: organizationFrameworks,
      framework: frameworks,
    })
    .from(organizationFrameworks)
    .innerJoin(frameworks, eq(organizationFrameworks.frameworkId, frameworks.id))
    .where(
      and(
        eq(organizationFrameworks.organizationId, org.id),
        eq(organizationFrameworks.isActive, true)
      )
    )

  // For each framework, compute progress
  const frameworkProgress = await Promise.all(
    orgFrameworkRows.map(async ({ framework }) => {
      // Total controls for this framework
      const [totalRow] = await db
        .select({ total: count(controls.id) })
        .from(controls)
        .where(eq(controls.frameworkId, framework.id))

      const totalControls = Number(totalRow?.total ?? 0)

      // Implemented controls for this org
      const [implementedRow] = await db
        .select({ implemented: count(controlAssignments.id) })
        .from(controlAssignments)
        .innerJoin(controls, eq(controls.id, controlAssignments.controlId))
        .where(
          and(
            eq(controls.frameworkId, framework.id),
            eq(controlAssignments.organizationId, org.id),
            eq(controlAssignments.status, 'implemented')
          )
        )

      const implementedControls = Number(implementedRow?.implemented ?? 0)
      const pct = totalControls > 0 ? Math.round((implementedControls / totalControls) * 100) : 0

      // Determine status
      let status: 'Certified' | 'Auditing' | 'In Progress' = 'In Progress'
      if (pct === 100) status = 'Certified'
      else if (pct >= 80) status = 'Auditing'

      return {
        id: framework.id,
        name: framework.name,
        shortName: framework.shortName ?? framework.name,
        version: framework.version,
        category: framework.category,
        pct,
        implementedControls,
        totalControls,
        status,
      }
    })
  )

  // Overall score = average of all framework percents (or 0 if none)
  const overallScore =
    frameworkProgress.length > 0
      ? Math.round(
          frameworkProgress.reduce((sum, f) => sum + f.pct, 0) / frameworkProgress.length
        )
      : 0

  return NextResponse.json({
    orgName: org.name,
    orgSlug: org.slug,
    logoUrl: org.logoUrl ?? null,
    overallScore,
    lastUpdated: org.updatedAt,
    activeFrameworks: frameworkProgress,
  })
}
