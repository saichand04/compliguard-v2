import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { controls, controlAssignments } from '@/lib/db/schema'
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
  if (!hasScope(apiKeyData.scopes, 'read:controls')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData
  const { id } = await params

  try {
    const [result] = await db
      .select({ control: controls, assignment: controlAssignments })
      .from(controlAssignments)
      .innerJoin(controls, eq(controls.id, controlAssignments.controlId))
      .where(and(eq(controlAssignments.organizationId, orgId), eq(controls.id, id)))
      .limit(1)

    if (!result) {
      return NextResponse.json({ success: false, error: 'Control not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { ...result.control, assignment: result.assignment },
    })
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
  if (!hasScope(apiKeyData.scopes, 'write:controls')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData
  const { id } = await params

  let body: { status?: string; notes?: string; assignedTo?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
  }

  const validStatuses = ['not_started', 'in_progress', 'implemented', 'needs_review', 'not_applicable']
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ success: false, error: 'Invalid status value', code: 'BAD_REQUEST' }, { status: 400 })
  }

  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (body.status) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo

    const [updated] = await db
      .update(controlAssignments)
      .set(updateData)
      .where(and(eq(controlAssignments.organizationId, orgId), eq(controlAssignments.controlId, id)))
      .returning()

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Control not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
