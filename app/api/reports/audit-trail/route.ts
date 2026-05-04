import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLogs, users } from '@/lib/db/schema'
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
  const filename = `audit-trail-${today}.csv`

  try {
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        resourceTitle: auditLogs.resourceTitle,
        description: auditLogs.description,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, session.orgId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10000)

    // Resolve user names
    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[]
    const userMap: Record<string, string> = {}

    for (const uid of userIds) {
      try {
        const [user] = await db
          .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
          .from(users)
          .where(eq(users.id, uid))
          .limit(1)
        if (user) {
          userMap[uid] = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
        }
      } catch {
        // ignore
      }
    }

    const headers = ['Timestamp', 'User', 'Action', 'EntityType', 'EntityId', 'EntityTitle', 'IPAddress', 'Details']

    const rows: string[][] = [headers]

    for (const l of logs) {
      rows.push([
        l.createdAt.toISOString(),
        l.userId ? (userMap[l.userId] ?? l.userId) : '',
        l.action ?? '',
        l.resourceType ?? '',
        l.resourceId ?? '',
        l.resourceTitle ?? '',
        l.ipAddress ?? '',
        l.description ?? '',
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
    console.error('[reports/audit-trail]', err)
    return ApiErrors.internal()
  }
}
