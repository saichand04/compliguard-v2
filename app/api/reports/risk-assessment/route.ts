import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { riskAssessments, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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
  const filename = `risk-assessment-${today}.csv`

  try {
    const risks = await db
      .select({
        id: riskAssessments.id,
        title: riskAssessments.title,
        category: riskAssessments.category,
        severity: riskAssessments.severity,
        status: riskAssessments.status,
        inherentScore: riskAssessments.inherentScore,
        residualScore: riskAssessments.residualScore,
        mitigationPlan: riskAssessments.mitigationPlan,
        reviewDate: riskAssessments.reviewDate,
        ownerId: riskAssessments.ownerId,
      })
      .from(riskAssessments)
      .where(eq(riskAssessments.organizationId, session.orgId))
      .orderBy(riskAssessments.createdAt)

    const headers = [
      'Title', 'Category', 'Severity', 'Status',
      'InherentScore', 'ResidualScore', 'Owner', 'ReviewDate', 'MitigationPlan',
    ]

    // Fetch owner names for all unique owner IDs
    const ownerIds = [...new Set(risks.map((r) => r.ownerId).filter(Boolean))] as string[]
    const ownerMap: Record<string, string> = {}

    if (ownerIds.length > 0) {
      for (const ownerId of ownerIds) {
        try {
          const [user] = await db
            .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
            .from(users)
            .where(eq(users.id, ownerId))
            .limit(1)
          if (user) {
            ownerMap[ownerId] = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
          }
        } catch {
          // ignore individual lookup failures
        }
      }
    }

    const rows: string[][] = [headers]

    for (const r of risks) {
      rows.push([
        r.title ?? '',
        r.category ?? '',
        r.severity ?? '',
        r.status ?? '',
        r.inherentScore != null ? String(r.inherentScore) : '',
        r.residualScore != null ? String(r.residualScore) : '',
        r.ownerId ? (ownerMap[r.ownerId] ?? r.ownerId) : '',
        r.reviewDate ? r.reviewDate.toISOString() : '',
        r.mitigationPlan ?? '',
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
    console.error('[reports/risk-assessment]', err)
    return ApiErrors.internal()
  }
}
