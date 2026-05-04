import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'

export async function GET(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:tasks')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const assignee = searchParams.get('assignee')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  try {
    const all = await db
      .select()
      .from(tasks)
      .where(eq(tasks.organizationId, orgId))
      .orderBy(desc(tasks.createdAt))
      .limit(1000)

    const filtered = all.filter((t) => {
      if (status && t.status !== status) return false
      if (priority && t.priority !== priority) return false
      if (assignee && t.assignedTo !== assignee) return false
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
  if (!hasScope(apiKeyData.scopes, 'write:tasks')) {
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

  try {
    const [task] = await db.insert(tasks).values({
      organizationId: orgId,
      title: body.title as string,
      description: body.description as string | undefined,
      status: (body.status as 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled') ?? 'todo',
      priority: (body.priority as 'low' | 'medium' | 'high' | 'urgent') ?? 'medium',
      assignedTo: body.assignedTo as string | undefined,
      dueDate: body.dueDate ? new Date(body.dueDate as string) : undefined,
    }).returning()

    return NextResponse.json({ success: true, data: task }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
