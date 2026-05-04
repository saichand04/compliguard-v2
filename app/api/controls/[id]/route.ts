/**
 * GET  /api/controls/[id]  — full control detail with mappings and canonical resolution
 * PATCH /api/controls/[id]  — update assignment status / assignedTo
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { controls, frameworks, controlAssignments } from '@/lib/db/schema/frameworks'
import { eq, and } from 'drizzle-orm'
import { mappingEngine } from '@/lib/mapping-engine'
import { z } from 'zod'

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

// ── PATCH ─────────────────────────────────────────────────────────────────────

const patchSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'implemented', 'needs_review', 'not_applicable']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.EDIT_CONTROLS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = patchSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (result.data.status !== undefined) updates.status = result.data.status
  if (result.data.assignedTo !== undefined) updates.assignedTo = result.data.assignedTo

  // Check assignment exists, create if missing
  const [existing] = await db
    .select({ id: controlAssignments.id })
    .from(controlAssignments)
    .where(and(eq(controlAssignments.controlId, id), eq(controlAssignments.organizationId, session.orgId)))
    .limit(1)

  if (existing) {
    await db
      .update(controlAssignments)
      .set(updates)
      .where(and(eq(controlAssignments.controlId, id), eq(controlAssignments.organizationId, session.orgId)))
  } else {
    await db.insert(controlAssignments).values({
      organizationId: session.orgId,
      controlId: id,
      status: (result.data.status ?? 'not_started') as 'not_started' | 'in_progress' | 'implemented' | 'needs_review' | 'not_applicable',
      assignedTo: result.data.assignedTo ?? null,
    })
  }

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'control.update_status',
    resourceType: 'control',
    resourceId: id,
    description: `Updated control status to ${result.data.status ?? 'unchanged'}`,
    request: req,
  })

  return NextResponse.json({ ok: true, updates })
}
