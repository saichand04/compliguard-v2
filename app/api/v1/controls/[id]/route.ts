import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { controls, controlAssignments, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

const controlStatus = z.enum(['not_started', 'in_progress', 'implemented', 'needs_review', 'not_applicable'])

const patchSchema = z.object({
  status: controlStatus.optional(),
  notes: z.string().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
}).strict()

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
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, error: 'Invalid id', code: 'BAD_REQUEST' }, { status: 400 })
  }

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
  } catch (err) {
    logger.error({ err, id }, 'v1.controls.get failed')
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
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, error: 'Invalid id', code: 'BAD_REQUEST' }, { status: 400 })
  }

  let raw: unknown
  try { raw = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message, code: 'BAD_REQUEST' }, { status: 400 })
  }
  const body = parsed.data

  if (body.assignedTo) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, body.assignedTo), eq(users.organizationId, orgId)))
      .limit(1)
    if (!u) {
      return NextResponse.json({ success: false, error: 'assignedTo does not belong to this organization', code: 'BAD_REQUEST' }, { status: 400 })
    }
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
  } catch (err) {
    logger.error({ err, id }, 'v1.controls.update failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
