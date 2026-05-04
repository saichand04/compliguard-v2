/**
 * GET /api/mappings/[controlId]
 * Returns all cross-framework mappings for a specific control.
 * Response: { control, mappedControls: [{framework, controlId, mappingType, confidence, source}] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { mappingEngine } from '@/lib/mapping-engine'
import { db } from '@/lib/db'
import { controls, frameworks } from '@/lib/db/schema/frameworks'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ controlId: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_CONTROLS)) return ApiErrors.forbidden()

  const { controlId } = await params

  if (!controlId) {
    return ApiErrors.badRequest('controlId is required')
  }

  // Fetch the control + its framework
  const [controlRow] = await db
    .select({
      control: controls,
      framework: frameworks,
    })
    .from(controls)
    .innerJoin(frameworks, eq(controls.frameworkId, frameworks.id))
    .where(eq(controls.id, controlId))
    .limit(1)

  if (!controlRow) {
    return NextResponse.json({ error: 'Control not found' }, { status: 404 })
  }

  // Resolve canonical NIST ID
  const canonical = await mappingEngine.resolveCanonical(
    controlRow.framework.slug ?? '',
    controlRow.control.controlId ?? controlRow.control.id
  )

  // Get cross-framework mappings
  const mappedControls = await mappingEngine.getCrossFrameworkMappings(controlId)

  return NextResponse.json({
    control: {
      id: controlRow.control.id,
      controlId: controlRow.control.controlId,
      title: controlRow.control.title,
      description: controlRow.control.description,
      framework: {
        id: controlRow.framework.id,
        name: controlRow.framework.name,
        slug: controlRow.framework.slug,
      },
    },
    canonical,
    mappedControls,
    total: mappedControls.length,
  })
}
