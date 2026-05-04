/**
 * POST /api/mappings/suggest
 * Trigger AI mapping suggestions for a given control.
 * Requires authentication.
 *
 * Body: { controlId: string, targetFrameworkIds?: string[] }
 * Returns: { suggestions, configRequired, total }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { MappingEngine } from '@/lib/mapping-engine'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  controlId: z.string().uuid('controlId must be a valid UUID'),
  targetFrameworkIds: z.array(z.string().uuid()).optional(),
})

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_CONTROLS)) return ApiErrors.forbidden()

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

  const { controlId } = result.data

  // Create a per-request MappingEngine instance so _lastAiConfigRequired is isolated
  const engine = new MappingEngine()

  const suggestions = await engine.suggestMappings(controlId)
  const configRequired = engine._lastAiConfigRequired

  return NextResponse.json({
    suggestions,
    configRequired,
    total: suggestions.length,
  })
}
