import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  controls, controlAssignments, evidence,
  organizationFrameworks, frameworks,
} from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { logger } from '@/lib/logger'

// GET /api/audit/controls?frameworkId=xxx
// Returns controls with status and evidence counts for auditor view
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.badRequest('No organisation associated with session')
  if (!hasPermission(session.role, PERMISSIONS.VIEW_AUDIT_LOGS)) return ApiErrors.forbidden()

  const { searchParams } = req.nextUrl
  const frameworkId = searchParams.get('frameworkId')

  try {
    // Determine which framework(s) to query
    let frameworkIds: string[] = []

    if (frameworkId) {
      frameworkIds = [frameworkId]
    } else {
      // All active org frameworks
      const orgFrameworks = await db
        .select({ frameworkId: organizationFrameworks.frameworkId })
        .from(organizationFrameworks)
        .where(
          and(
            eq(organizationFrameworks.organizationId, session.orgId),
            eq(organizationFrameworks.isActive, true)
          )
        )
      frameworkIds = orgFrameworks.map((f) => f.frameworkId)
    }

    if (frameworkIds.length === 0) {
      return NextResponse.json({ controls: [], total: 0 })
    }

    // Get controls for these frameworks (limit to 500 per request)
    const allControls: Array<{
      id: string
      controlId: string | null
      title: string
      category: string | null
      status: string
      evidenceCount: number
    }> = []

    for (const fwId of frameworkIds) {
      const fwControls = await db
        .select({
          id: controls.id,
          controlId: controls.controlId,
          title: controls.title,
          category: controls.category,
        })
        .from(controls)
        .where(eq(controls.frameworkId, fwId))
        .limit(200)

      for (const ctrl of fwControls) {
        // Get assignment status
        const [assignment] = await db
          .select({ id: controlAssignments.id, status: controlAssignments.status })
          .from(controlAssignments)
          .where(
            and(
              eq(controlAssignments.organizationId, session.orgId),
              eq(controlAssignments.controlId, ctrl.id)
            )
          )
          .limit(1)

        // Count evidence items
        let evidenceCount = 0
        if (assignment) {
          const countResult = await db
            .select({ count: sql<number>`count(*)`.as('count') })
            .from(evidence)
            .where(eq(evidence.controlAssignmentId, assignment.id))
          evidenceCount = Number(countResult[0]?.count ?? 0)
        }

        allControls.push({
          id: ctrl.id,
          controlId: ctrl.controlId,
          title: ctrl.title,
          category: ctrl.category,
          status: assignment?.status ?? 'not_started',
          evidenceCount,
        })
      }
    }

    return NextResponse.json({ controls: allControls, total: allControls.length })
  } catch (err) {
    logger.error({ err }, 'audit.controls failed')
    return ApiErrors.internal()
  }
}
