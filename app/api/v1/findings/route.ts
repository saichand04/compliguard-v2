import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findings } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'

export async function GET(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:findings')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData

  const { searchParams } = request.nextUrl
  const severity = searchParams.get('severity')
  const status = searchParams.get('status')
  const source = searchParams.get('source')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  try {
    const all = await db
      .select()
      .from(findings)
      .where(eq(findings.organizationId, orgId))
      .orderBy(desc(findings.createdAt))
      .limit(1000)

    const filtered = all.filter((f) => {
      if (severity && f.severity !== severity) return false
      if (status && f.status !== status) return false
      if (source && f.source !== source) return false
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
  if (!hasScope(apiKeyData.scopes, 'write:findings')) {
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
    const [finding] = await db.insert(findings).values({
      organizationId: orgId,
      title: body.title as string,
      description: body.description as string | undefined,
      severity: (body.severity as 'info' | 'low' | 'medium' | 'high' | 'critical') ?? 'medium',
      status: (body.status as 'open' | 'in_remediation' | 'resolved' | 'accepted' | 'false_positive') ?? 'open',
      source: (body.source as 'aws' | 'azure' | 'gcp' | 'github' | 'pentest' | 'manual' | 'nl_test' | 'integration') ?? 'manual',
      remediationGuidance: body.remediationGuidance as string | undefined,
      affectedAsset: body.affectedAsset as string | undefined,
      cveId: body.cveId as string | undefined,
      dueDate: body.dueDate ? new Date(body.dueDate as string) : undefined,
    }).returning()

    return NextResponse.json({ success: true, data: finding }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
