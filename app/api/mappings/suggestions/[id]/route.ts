/**
 * PATCH /api/mappings/suggestions/[id]
 * Update the status of a mapping suggestion (accept or reject).
 * Requires authentication.
 *
 * Body: { status: 'accepted' | 'rejected' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mappingSuggestions } from '@/lib/db/schema/mapping_engine'
import { controlMappings, controls, frameworks, organizationFrameworks } from '@/lib/db/schema/frameworks'
import { eq, and, or } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const uuidSchema = z.string().uuid()

const bodySchema = z.object({
  status: z.enum(['accepted', 'rejected']),
}).strict()

/**
 * A control is "visible" to a caller's org when either:
 *   - the framework owning the control is built-in, OR
 *   - the framework owning the control is actively assigned to the caller's
 *     org (organization_frameworks row exists and is_active = true).
 */
async function controlVisibleToOrg(controlId: string, orgId: string): Promise<boolean> {
  const [row] = await db
    .select({ ctrlId: controls.id })
    .from(controls)
    .innerJoin(frameworks, eq(frameworks.id, controls.frameworkId))
    .leftJoin(
      organizationFrameworks,
      and(
        eq(organizationFrameworks.frameworkId, frameworks.id),
        eq(organizationFrameworks.organizationId, orgId),
        eq(organizationFrameworks.isActive, true),
      ),
    )
    .where(
      and(
        eq(controls.id, controlId),
        or(eq(frameworks.isBuiltIn, true), eq(organizationFrameworks.organizationId, orgId)),
      ),
    )
    .limit(1)
  return !!row
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.CREATE_CONTROLS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.badRequest('User must belong to an organization')

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return ApiErrors.badRequest('Invalid id')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = bodySchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const { status } = result.data

  // Find the suggestion
  const [suggestion] = await db
    .select()
    .from(mappingSuggestions)
    .where(eq(mappingSuggestions.id, id))
    .limit(1)

  if (!suggestion) {
    return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
  }

  // Validate caller's org can see the source control (otherwise they may not
  // act on this mapping at all).
  if (!(await controlVisibleToOrg(suggestion.sourceControlId, session.orgId))) {
    return ApiErrors.forbidden()
  }

  try {
    // If accepting, promote to a real control_mapping
    let resolvedMappingId: string | undefined
    if (status === 'accepted') {
      const [newMapping] = await db
        .insert(controlMappings)
        .values({
          sourceControlId: suggestion.sourceControlId,
          targetControlId: suggestion.targetControlId,
          confidence: suggestion.confidence,
          mappingRationale: suggestion.rationale ?? undefined,
          mappedByAi: suggestion.suggestedBy === 'ai',
          source: suggestion.suggestedBy === 'ai' ? 'ai' : 'scf',
          isUserOverride: false,
          mappingType: 'direct',
        })
        .returning()

      resolvedMappingId = newMapping?.id
    }

    // Update suggestion status
    const [updated] = await db
      .update(mappingSuggestions)
      .set({
        status,
        reviewedBy: session.userId,
        reviewedAt: new Date(),
        resolvedMappingId: resolvedMappingId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(mappingSuggestions.id, id))
      .returning()

    return NextResponse.json({ suggestion: updated, action: status })
  } catch (err) {
    logger.error({ err, id }, 'mappings.suggestions.patch failed')
    return ApiErrors.internal()
  }
}
