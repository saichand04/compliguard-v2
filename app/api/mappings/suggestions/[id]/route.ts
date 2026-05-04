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
import { controlMappings } from '@/lib/db/schema/frameworks'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  status: z.enum(['accepted', 'rejected']),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.CREATE_CONTROLS)) return ApiErrors.forbidden()

  const { id } = await params

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
}
