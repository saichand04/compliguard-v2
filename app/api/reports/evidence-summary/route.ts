import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evidence, users, controlAssignments, controls } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
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
  const filename = `evidence-summary-${today}.csv`

  try {
    const evidenceItems = await db
      .select({
        id: evidence.id,
        title: evidence.title,
        evidenceType: evidence.evidenceType,
        status: evidence.status,
        storageProvider: evidence.storageProvider,
        uploadedBy: evidence.uploadedBy,
        controlAssignmentId: evidence.controlAssignmentId,
        expiresAt: evidence.expiresAt,
        createdAt: evidence.createdAt,
      })
      .from(evidence)
      .where(eq(evidence.organizationId, session.orgId))
      .orderBy(desc(evidence.createdAt))
      .limit(5000)

    // Resolve uploaders
    const uploaderIds = [...new Set(evidenceItems.map((e) => e.uploadedBy).filter(Boolean))] as string[]
    const uploaderMap: Record<string, string> = {}
    for (const uid of uploaderIds) {
      try {
        const [user] = await db
          .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
          .from(users)
          .where(eq(users.id, uid))
          .limit(1)
        if (user) {
          uploaderMap[uid] = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
        }
      } catch {
        // ignore
      }
    }

    // Resolve control refs from controlAssignmentIds
    const assignmentIds = [
      ...new Set(evidenceItems.map((e) => e.controlAssignmentId).filter(Boolean)),
    ] as string[]
    const controlRefMap: Record<string, string> = {}
    for (const assignId of assignmentIds) {
      try {
        const [assignment] = await db
          .select({ controlId: controlAssignments.controlId })
          .from(controlAssignments)
          .where(eq(controlAssignments.id, assignId))
          .limit(1)
        if (assignment) {
          const [ctrl] = await db
            .select({ controlId: controls.controlId, title: controls.title })
            .from(controls)
            .where(eq(controls.id, assignment.controlId))
            .limit(1)
          if (ctrl) {
            controlRefMap[assignId] = ctrl.controlId ?? ctrl.title
          }
        }
      } catch {
        // ignore
      }
    }

    const headers = [
      'Title', 'Type', 'Status', 'ControlRef',
      'UploadedBy', 'CreatedAt', 'ExpiresAt', 'StorageProvider',
    ]

    const rows: string[][] = [headers]

    for (const e of evidenceItems) {
      rows.push([
        e.title ?? '',
        e.evidenceType ?? '',
        e.status ?? '',
        e.controlAssignmentId ? (controlRefMap[e.controlAssignmentId] ?? '') : '',
        e.uploadedBy ? (uploaderMap[e.uploadedBy] ?? e.uploadedBy) : '',
        e.createdAt.toISOString(),
        e.expiresAt?.toISOString() ?? '',
        e.storageProvider ?? '',
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
    console.error('[reports/evidence-summary]', err)
    return ApiErrors.internal()
  }
}
