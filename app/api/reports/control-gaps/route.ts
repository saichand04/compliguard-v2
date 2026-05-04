import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  organizationFrameworks, frameworks, controls, controlAssignments, evidence,
} from '@/lib/db/schema'
import { eq, and, notExists, sql } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const str = cell == null ? '' : String(cell)
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(',')
    )
    .join('\n')
}

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.badRequest('No organisation associated with session')

  const today = new Date().toISOString().split('T')[0]
  const filename = `control-gaps-${today}.csv`

  try {
    // Get active frameworks for this org
    const orgFrameworks = await db
      .select({
        frameworkId: organizationFrameworks.frameworkId,
        frameworkName: frameworks.name,
        frameworkShortName: frameworks.shortName,
      })
      .from(organizationFrameworks)
      .innerJoin(frameworks, eq(organizationFrameworks.frameworkId, frameworks.id))
      .where(
        and(
          eq(organizationFrameworks.organizationId, session.orgId),
          eq(organizationFrameworks.isActive, true)
        )
      )

    const headers = ['Framework', 'ControlRef', 'ControlTitle', 'Category', 'Status', 'DaysSinceCreated']
    const rows: string[][] = [headers]

    for (const fw of orgFrameworks) {
      // Get all controls for this framework
      const allControls = await db
        .select({
          id: controls.id,
          controlId: controls.controlId,
          title: controls.title,
          category: controls.category,
          createdAt: controls.createdAt,
        })
        .from(controls)
        .where(eq(controls.frameworkId, fw.frameworkId))

      for (const ctrl of allControls) {
        // Find control assignment for this org
        const assignments = await db
          .select({
            id: controlAssignments.id,
            status: controlAssignments.status,
          })
          .from(controlAssignments)
          .where(
            and(
              eq(controlAssignments.organizationId, session.orgId),
              eq(controlAssignments.controlId, ctrl.id)
            )
          )
          .limit(1)

        if (assignments.length === 0) {
          // Control has no assignment at all — it's a gap
          const daysSince = Math.floor(
            (Date.now() - ctrl.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
          rows.push([
            fw.frameworkName,
            ctrl.controlId ?? '',
            ctrl.title,
            ctrl.category ?? '',
            'not_assigned',
            String(daysSince),
          ])
          continue
        }

        const assignment = assignments[0]

        // Check if this assignment has any evidence
        const evidenceCount = await db
          .select({ id: evidence.id })
          .from(evidence)
          .where(eq(evidence.controlAssignmentId, assignment.id))
          .limit(1)

        if (evidenceCount.length === 0) {
          const daysSince = Math.floor(
            (Date.now() - ctrl.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
          rows.push([
            fw.frameworkName,
            ctrl.controlId ?? '',
            ctrl.title,
            ctrl.category ?? '',
            assignment.status,
            String(daysSince),
          ])
        }
      }
    }

    const csv = toCsv(rows)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[reports/control-gaps]', err)
    return ApiErrors.internal()
  }
}
