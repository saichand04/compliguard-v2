/**
 * GET /api/mappings/suggestions?controlId=&status=pending
 * Fetch mapping suggestions for a control (optionally filtered by status).
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mappingSuggestions } from '@/lib/db/schema/mapping_engine'
import { controls, frameworks } from '@/lib/db/schema/frameworks'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_CONTROLS)) return ApiErrors.forbidden()

  const { searchParams } = req.nextUrl
  const controlId = searchParams.get('controlId')
  const status = searchParams.get('status') ?? 'pending'

  if (!controlId) {
    return ApiErrors.badRequest('Provide controlId query parameter')
  }

  const rows = await db
    .select({
      suggestion: mappingSuggestions,
      targetControl: controls,
      targetFramework: frameworks,
    })
    .from(mappingSuggestions)
    .innerJoin(controls, eq(controls.id, mappingSuggestions.targetControlId))
    .innerJoin(frameworks, eq(frameworks.id, controls.frameworkId))
    .where(
      and(
        eq(mappingSuggestions.sourceControlId, controlId),
        eq(mappingSuggestions.status, status as 'pending' | 'accepted' | 'rejected')
      )
    )
    .orderBy(mappingSuggestions.confidence)
    .limit(50)

  const suggestions = rows.map((r) => ({
    id: r.suggestion.id,
    sourceControlId: r.suggestion.sourceControlId,
    targetControlId: r.suggestion.targetControlId,
    targetControlRef: r.targetControl.controlId,
    targetTitle: r.targetControl.title,
    targetFramework: r.targetFramework.name,
    targetFrameworkShort: r.targetFramework.shortName ?? r.targetFramework.name,
    confidence: r.suggestion.confidence,
    rationale: r.suggestion.rationale,
    suggestedBy: r.suggestion.suggestedBy,
    status: r.suggestion.status,
    createdAt: r.suggestion.createdAt,
  }))

  return NextResponse.json({ suggestions, total: suggestions.length })
}
