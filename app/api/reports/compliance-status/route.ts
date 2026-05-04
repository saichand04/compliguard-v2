import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  organizationFrameworks, frameworks, controls, controlAssignments,
} from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
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
  const filename = `compliance-status-${today}.csv`

  try {
    // Get all active frameworks for the org
    const orgFrameworks = await db
      .select({
        orgFrameworkId: organizationFrameworks.id,
        frameworkId: frameworks.id,
        frameworkName: frameworks.name,
        frameworkShortName: frameworks.shortName,
        targetDate: organizationFrameworks.targetDate,
      })
      .from(organizationFrameworks)
      .innerJoin(frameworks, eq(organizationFrameworks.frameworkId, frameworks.id))
      .where(
        and(
          eq(organizationFrameworks.organizationId, session.orgId),
          eq(organizationFrameworks.isActive, true)
        )
      )

    const headers = [
      'Framework', 'ShortName', 'TotalControls', 'Implemented',
      'InProgress', 'NotStarted', 'NeedsReview', 'NotApplicable', 'ProgressPct', 'TargetDate',
    ]

    const rows: string[][] = [headers]

    for (const fw of orgFrameworks) {
      // Count controls for this framework
      const allControls = await db
        .select({ id: controls.id })
        .from(controls)
        .where(eq(controls.frameworkId, fw.frameworkId))

      const total = allControls.length

      if (total === 0) {
        rows.push([
          fw.frameworkName, fw.frameworkShortName ?? '', '0',
          '0', '0', '0', '0', '0', '0%', fw.targetDate?.toISOString() ?? '',
        ])
        continue
      }

      // Get assignments for this org + framework controls
      const controlIds = allControls.map((c) => c.id)

      // Count by status via assignments
      const assignmentCounts = await db
        .select({
          status: controlAssignments.status,
          count: sql<number>`count(*)`.as('count'),
        })
        .from(controlAssignments)
        .where(
          and(
            eq(controlAssignments.organizationId, session.orgId),
            sql`${controlAssignments.controlId} = ANY(${sql.raw(`ARRAY[${controlIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
          )
        )
        .groupBy(controlAssignments.status)

      const countMap: Record<string, number> = {}
      for (const row of assignmentCounts) {
        countMap[row.status] = Number(row.count)
      }

      const implemented = countMap['implemented'] ?? 0
      const inProgress = countMap['in_progress'] ?? 0
      const notStarted = countMap['not_started'] ?? 0
      const needsReview = countMap['needs_review'] ?? 0
      const notApplicable = countMap['not_applicable'] ?? 0
      const progressPct = total > 0 ? Math.round((implemented / total) * 100) : 0

      rows.push([
        fw.frameworkName,
        fw.frameworkShortName ?? '',
        String(total),
        String(implemented),
        String(inProgress),
        String(notStarted),
        String(needsReview),
        String(notApplicable),
        `${progressPct}%`,
        fw.targetDate?.toISOString() ?? '',
      ])
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
    console.error('[reports/compliance-status]', err)
    return ApiErrors.internal()
  }
}
