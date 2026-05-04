/**
 * GET /api/controls/[id]
 * Returns a single control's full detail with all mappings and canonical resolution.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { controls, frameworks, controlAssignments } from '@/lib/db/schema/frameworks'
import { eq } from 'drizzle-orm'
import { mappingEngine } from '@/lib/mapping-engine'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_CONTROLS)) return ApiErrors.forbidden()

  const { id } = await params

  // Fetch control + framework
  const [row] = await db
    .select({
      control: controls,
      framework: frameworks,
    })
    .from(controls)
    .innerJoin(frameworks, eq(controls.frameworkId, frameworks.id))
    .where(eq(controls.id, id))
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: 'Control not found' }, { status: 404 })
  }

  // Fetch org assignment if available
  let assignment = null
  if (session.orgId) {
    const [assignmentRow] = await db
      .select()
      .from(controlAssignments)
      .where(
        eq(controlAssignments.controlId, id)
      )
      .limit(1)
    assignment = assignmentRow ?? null
  }

  // Resolve canonical NIST ID
  const canonical = await mappingEngine.resolveCanonical(
    row.framework.slug ?? '',
    row.control.controlId ?? id
  )

  // Get cross-framework mappings
  const mappedControls = await mappingEngine.getCrossFrameworkMappings(id)

  // Get mapping suggestions
  const suggestions = await mappingEngine.suggestMappings(id)

  // HITRUST decode if applicable
  let hitrustDecoded = null
  if (
    row.framework.slug === 'hitrust' ||
    (row.control.controlId && /^\d{2}\.[a-z]+\.\d+$/i.test(row.control.controlId))
  ) {
    hitrustDecoded = mappingEngine.decodeHitrustId(row.control.controlId ?? '')
  }

  return NextResponse.json({
    control: {
      id: row.control.id,
      controlId: row.control.controlId,
      title: row.control.title,
      description: row.control.description,
      guidance: row.control.guidance,
      category: row.control.category,
      subcategory: row.control.subcategory,
      testProcedure: row.control.testProcedure,
      remediation: row.control.remediation,
      isRequired: row.control.isRequired,
      weight: row.control.weight,
      metadata: row.control.metadata,
      createdAt: row.control.createdAt,
    },
    framework: {
      id: row.framework.id,
      name: row.framework.name,
      slug: row.framework.slug,
      shortName: row.framework.shortName,
    },
    assignment,
    canonical,
    hitrustDecoded,
    mappedControls,
    suggestions,
  })
}
