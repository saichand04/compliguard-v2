import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { knowledgeBaseEntries } from '@/lib/db/schema'
import { eq, and, or } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/log'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

// ── GET single entry ──────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return ApiErrors.badRequest('Invalid id')

  // (C11) Visibility: public OR same-org.
  const visibility = session.orgId
    ? or(eq(knowledgeBaseEntries.isPublic, true), eq(knowledgeBaseEntries.organizationId, session.orgId))!
    : eq(knowledgeBaseEntries.isPublic, true)

  const [entry] = await db
    .select()
    .from(knowledgeBaseEntries)
    .where(and(eq(knowledgeBaseEntries.id, id), visibility))
    .limit(1)

  if (!entry) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ entry })
}

// ── PUT: update entry ─────────────────────────────────────────────────────────

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
}).strict()

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return ApiErrors.badRequest('Invalid id')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = updateSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data

  const [existing] = await db
    .select()
    .from(knowledgeBaseEntries)
    .where(eq(knowledgeBaseEntries.id, id))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // (C11) Must be in caller's org AND (author OR admin with edit permission).
  // We treat MANAGE_ROLES + admin as the edit-knowledge baseline since the
  // RBAC table doesn't expose a dedicated EDIT_KNOWLEDGE permission.
  const sameOrg = !!session.orgId && existing.organizationId === session.orgId
  const isAuthor = existing.createdBy === session.userId
  const canEdit =
    session.role === 'super_admin' ||
    (sameOrg && (isAuthor || hasPermission(session.role, PERMISSIONS.MANAGE_ROLES)))

  if (!canEdit) return ApiErrors.forbidden()

  // Only super_admin may flip isPublic.
  if (data.isPublic !== undefined && session.role !== 'super_admin') {
    return ApiErrors.forbidden()
  }

  try {
    const [updated] = await db
      .update(knowledgeBaseEntries)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBaseEntries.id, id))
      .returning()

    return NextResponse.json({ entry: updated })
  } catch (err) {
    logger.error({ err, id }, 'knowledge.update failed')
    return ApiErrors.internal()
  }
}

// ── DELETE: soft-delete (actually hard delete for now since no deletedAt) ─────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return ApiErrors.badRequest('Invalid id')

  const [existing] = await db
    .select()
    .from(knowledgeBaseEntries)
    .where(eq(knowledgeBaseEntries.id, id))
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sameOrg = !!session.orgId && existing.organizationId === session.orgId
  const isAuthor = existing.createdBy === session.userId
  const canDelete =
    session.role === 'super_admin' ||
    (sameOrg && (isAuthor || hasPermission(session.role, PERMISSIONS.MANAGE_ROLES)))

  if (!canDelete) return ApiErrors.forbidden()

  await logAudit({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'knowledge.delete',
    entityType: 'knowledge_base_entry',
    entityId: id,
    entityTitle: existing.title,
    before: existing,
    description: `Deleted knowledge base entry: ${existing.title}`,
    request: req,
  })

  try {
    await db
      .delete(knowledgeBaseEntries)
      .where(eq(knowledgeBaseEntries.id, id))

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ err, id }, 'knowledge.delete failed')
    return ApiErrors.internal()
  }
}
