import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evidence } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import fs from 'fs'
import path from 'path'

const UPLOAD_DIR = '/tmp/evidence-uploads'

/**
 * GET /api/evidence/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_EVIDENCE)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [record] = await db
    .select()
    .from(evidence)
    .where(and(eq(evidence.id, id), eq(evidence.organizationId, session.orgId)))

  if (!record) return ApiErrors.notFound('Evidence')
  return NextResponse.json({ evidence: record })
}

/**
 * PATCH /api/evidence/[id]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.EDIT_EVIDENCE)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [existing] = await db
    .select()
    .from(evidence)
    .where(and(eq(evidence.id, id), eq(evidence.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('Evidence')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const allowedFields: Record<string, unknown> = {}
  if (body.title !== undefined) allowedFields.title = body.title
  if (body.description !== undefined) allowedFields.description = body.description
  if (body.status !== undefined) allowedFields.status = body.status
  if (body.expiresAt !== undefined) allowedFields.expiresAt = body.expiresAt ? new Date(body.expiresAt as string) : null
  if (body.reviewNotes !== undefined) allowedFields.reviewNotes = body.reviewNotes
  if (body.metadata !== undefined) allowedFields.metadata = body.metadata

  // Handle review actions
  if (body.status === 'approved' || body.status === 'rejected') {
    allowedFields.reviewedBy = session.userId
    allowedFields.reviewedAt = new Date()
  }

  const [updated] = await db
    .update(evidence)
    .set({ ...allowedFields, updatedAt: new Date() })
    .where(and(eq(evidence.id, id), eq(evidence.organizationId, session.orgId)))
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'evidence.update',
    resourceType: 'evidence',
    resourceId: id,
    resourceTitle: existing.title,
    description: `Updated evidence: ${existing.title}`,
    request: req,
  })

  return NextResponse.json({ evidence: updated })
}

/**
 * DELETE /api/evidence/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.DELETE_EVIDENCE)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [existing] = await db
    .select()
    .from(evidence)
    .where(and(eq(evidence.id, id), eq(evidence.organizationId, session.orgId)))

  if (!existing) return ApiErrors.notFound('Evidence')

  // Remove file from local storage if applicable
  if (existing.storageProvider === 'local' && existing.storageKey) {
    const filePath = path.join(UPLOAD_DIR, existing.storageKey)
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch {
      // Non-fatal — file may already be missing
    }
  }

  await db
    .delete(evidence)
    .where(and(eq(evidence.id, id), eq(evidence.organizationId, session.orgId)))

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'evidence.delete',
    resourceType: 'evidence',
    resourceId: id,
    resourceTitle: existing.title,
    description: `Deleted evidence: ${existing.title}`,
    request: req,
  })

  return NextResponse.json({ success: true })
}
