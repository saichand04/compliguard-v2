import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { controls, controlAssignments, frameworks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'

export async function GET(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:controls')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData

  const { searchParams } = request.nextUrl
  const framework = searchParams.get('framework')
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  try {
    const results = await db
      .select({
        control: controls,
        assignment: controlAssignments,
        frameworkName: frameworks.name,
        frameworkShortName: frameworks.shortName,
      })
      .from(controlAssignments)
      .innerJoin(controls, eq(controls.id, controlAssignments.controlId))
      .innerJoin(frameworks, eq(frameworks.id, controls.frameworkId))
      .where(eq(controlAssignments.organizationId, orgId))
      .limit(1000)

    const filtered = results.filter((r) => {
      if (framework && r.frameworkShortName !== framework && r.frameworkName !== framework) return false
      if (status && r.assignment.status !== status) return false
      return true
    })

    const paginated = filtered.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: paginated.map((r) => ({
        ...r.control,
        assignment: r.assignment,
        framework: { name: r.frameworkName, shortName: r.frameworkShortName },
      })),
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
