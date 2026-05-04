import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()

  // DB connectivity check
  let dbStatus: 'ok' | 'error' = 'ok'
  let dbLatencyMs = 0
  try {
    const dbStart = Date.now()
    await db.execute(sql`SELECT 1`)
    dbLatencyMs = Date.now() - dbStart
  } catch {
    dbStatus = 'error'
  }

  const status = dbStatus === 'ok' ? 'healthy' : 'degraded'
  const httpStatus = dbStatus === 'ok' ? 200 : 503

  return NextResponse.json(
    {
      status,
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        server: {
          status: 'ok',
          responseTimeMs: Date.now() - start,
        },
      },
    },
    { status: httpStatus }
  )
}
