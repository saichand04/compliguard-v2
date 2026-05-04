/**
 * GET  /api/mappings?frameworkId=&controlId=  — list all mappings for a framework/control
 * POST /api/mappings                           — create a user crosswalk override
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { controlMappings, controls, frameworks } from '@/lib/db/schema/frameworks'
import { eq, or, and } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_CONTROLS)) return ApiErrors.forbidden()

  const { searchParams } = req.nextUrl
  const frameworkId = searchParams.get('frameworkId')
  const controlId = searchParams.get('controlId')

  if (!frameworkId && !controlId) {
    return ApiErrors.badRequest('Provide frameworkId or controlId query parameter')
  }

  // If controlId is specified, return mappings for that specific control
  if (controlId) {
    const rows = await db
      .select({
        mapping: controlMappings,
        sourceControl: controls,
        targetControl: controls,
      })
      .from(controlMappings)
      .where(
        or(
          eq(controlMappings.sourceControlId, controlId),
          eq(controlMappings.targetControlId, controlId)
        )
      )
      .limit(200)

    return NextResponse.json({
      mappings: rows.map((r) => r.mapping),
      total: rows.length,
    })
  }

  // If frameworkId is specified, return all mappings for controls in that framework
  const frameworkControls = await db
    .select({ id: controls.id })
    .from(controls)
    .where(eq(controls.frameworkId, frameworkId!))

  const controlIds = frameworkControls.map((c) => c.id)
  if (controlIds.length === 0) {
    return NextResponse.json({ mappings: [], total: 0 })
  }

  // Fetch mappings where source or target is in this framework
  const rows = await db
    .select({
      mapping: controlMappings,
    })
    .from(controlMappings)
    .limit(500)

  const filtered = rows
    .map((r) => r.mapping)
    .filter(
      (m) =>
        controlIds.includes(m.sourceControlId) ||
        controlIds.includes(m.targetControlId)
    )

  return NextResponse.json({ mappings: filtered, total: filtered.length })
}

// ── POST schema ───────────────────────────────────────────────────────────────

const createMappingSchema = z.object({
  sourceControlId: z.string().uuid(),
  targetControlId: z.string().uuid(),
  mappingType: z.enum(['direct', 'partial', 'related', 'inferred']).default('direct'),
  confidence: z.number().int().min(0).max(100).default(80),
  mappingRationale: z.string().optional(),
  canonicalNistId: z.string().max(50).optional(),
})

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.CREATE_CONTROLS)) return ApiErrors.forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = createMappingSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const { sourceControlId, targetControlId, mappingType, confidence, mappingRationale, canonicalNistId } = result.data

  // Check for existing mapping (avoid duplicates)
  const existing = await db
    .select({ id: controlMappings.id })
    .from(controlMappings)
    .where(
      or(
        and(
          eq(controlMappings.sourceControlId, sourceControlId),
          eq(controlMappings.targetControlId, targetControlId)
        ),
        and(
          eq(controlMappings.sourceControlId, targetControlId),
          eq(controlMappings.targetControlId, sourceControlId)
        )
      )
    )
    .limit(1)

  if (existing.length > 0) {
    // Update existing mapping as user override
    const [updated] = await db
      .update(controlMappings)
      .set({
        mappingType,
        confidence,
        mappingRationale,
        canonicalNistId,
        isUserOverride: true,
        source: 'user',
        updatedAt: new Date(),
      })
      .where(eq(controlMappings.id, existing[0].id))
      .returning()

    return NextResponse.json({ mapping: updated, action: 'updated' })
  }

  const [mapping] = await db
    .insert(controlMappings)
    .values({
      sourceControlId,
      targetControlId,
      mappingType,
      confidence,
      mappingRationale,
      canonicalNistId,
      source: 'user',
      isUserOverride: true,
      mappedByAi: false,
    })
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'mapping.create',
    resourceType: 'control_mapping',
    resourceId: mapping.id,
    resourceTitle: `${sourceControlId} ↔ ${targetControlId}`,
    description: `Created user override mapping: ${sourceControlId} ↔ ${targetControlId}`,
    request: req,
  })

  return NextResponse.json({ mapping, action: 'created' }, { status: 201 })
}
