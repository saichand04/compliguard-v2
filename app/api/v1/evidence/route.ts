import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evidence } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'

export async function GET(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:evidence')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const evidenceType = searchParams.get('type')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  try {
    const all = await db
      .select()
      .from(evidence)
      .where(eq(evidence.organizationId, orgId))
      .orderBy(desc(evidence.createdAt))
      .limit(1000)

    const filtered = all.filter((e) => {
      if (status && e.status !== status) return false
      if (evidenceType && e.evidenceType !== evidenceType) return false
      return true
    })

    const paginated = filtered.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: paginated,
      meta: {
        total: filtered.length,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        hasMore: offset + limit < filtered.length,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'write:evidence')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
  }

  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ success: false, error: 'title is required', code: 'BAD_REQUEST' }, { status: 400 })
  }

  const validTypes = ['screenshot', 'document', 'log', 'automated', 'text', 'video', 'configuration']
  const evidenceType = (body.evidenceType as string) ?? 'text'
  if (!validTypes.includes(evidenceType)) {
    return NextResponse.json({ success: false, error: 'Invalid evidenceType', code: 'BAD_REQUEST' }, { status: 400 })
  }

  try {
    const [record] = await db.insert(evidence).values({
      organizationId: orgId,
      title: body.title as string,
      description: body.description as string | undefined,
      evidenceType: evidenceType as 'screenshot' | 'document' | 'log' | 'automated' | 'text' | 'video' | 'configuration',
      textContent: body.textContent as string | undefined,
      status: 'pending',
      expiresAt: body.expiresAt ? new Date(body.expiresAt as string) : undefined,
      controlAssignmentId: body.controlAssignmentId as string | undefined,
    }).returning()

    return NextResponse.json({ success: true, data: record }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
