import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findings, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

const findingSeverity = z.enum(['info', 'low', 'medium', 'high', 'critical'])
const findingStatus = z.enum(['open', 'in_remediation', 'resolved', 'accepted', 'false_positive'])

const patchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  severity: findingSeverity.optional(),
  status: findingStatus.optional(),
  remediationGuidance: z.string().optional(),
  affectedAsset: z.string().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
}).strict()

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
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, error: 'Invalid id', code: 'BAD_REQUEST' }, { status: 400 })
  }

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
  } catch (err) {
    logger.error({ err, id }, 'v1.findings.get failed')
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
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.severity !== undefined) updateData.severity = body.severity
    if (body.status !== undefined) updateData.status = body.status
    if (body.remediationGuidance !== undefined) updateData.remediationGuidance = body.remediationGuidance
    if (body.affectedAsset !== undefined) updateData.affectedAsset = body.affectedAsset
    if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null

    if (body.status === 'resolved') {
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
  } catch (err) {
    logger.error({ err, id }, 'v1.findings.update failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
