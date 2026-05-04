import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:findings')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData
  const { id } = await params

  try {
    const [finding] = await db
      .select()
      .from(findings)
      .where(and(eq(findings.id, id), eq(findings.organizationId, orgId)))
      .limit(1)

    if (!finding) {
      return NextResponse.json({ success: false, error: 'Finding not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: finding })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'write:findings')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
  }

  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    const allowedFields = ['title', 'description', 'severity', 'status', 'remediationGuidance', 'affectedAsset', 'assignedTo', 'dueDate']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'dueDate') {
          updateData[field] = body[field] ? new Date(body[field] as string) : null
        } else {
          updateData[field] = body[field]
        }
      }
    }

    if (body.status === 'resolved' && !updateData.resolvedAt) {
      updateData.resolvedAt = new Date()
    }

    const [updated] = await db
      .update(findings)
      .set(updateData)
      .where(and(eq(findings.id, id), eq(findings.organizationId, orgId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Finding not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
