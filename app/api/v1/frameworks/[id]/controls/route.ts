import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { controls, frameworks } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:frameworks')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, error: 'Invalid id', code: 'BAD_REQUEST' }, { status: 400 })
  }

  const { searchParams } = request.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  try {
    // Verify framework exists
    const [framework] = await db
      .select({ id: frameworks.id, name: frameworks.name })
      .from(frameworks)
      .where(eq(frameworks.id, id))
      .limit(1)

    if (!framework) {
      return NextResponse.json({ success: false, error: 'Framework not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    const [rows, totalRow] = await Promise.all([
      db
        .select()
        .from(controls)
        .where(eq(controls.frameworkId, id))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(controls)
        .where(eq(controls.frameworkId, id)),
    ])
    const total = Number(totalRow[0]?.count ?? 0)

    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        hasMore: offset + limit < total,
        frameworkId: id,
        frameworkName: framework.name,
      },
    })
  } catch (err) {
    logger.error({ err, id }, 'v1.frameworks.controls.list failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
