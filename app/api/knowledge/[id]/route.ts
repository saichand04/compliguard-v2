import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { knowledgeBaseEntries } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

// ── GET single entry ──────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { id } = await params

  const [entry] = await db
    .select()
    .from(knowledgeBaseEntries)
    .where(eq(knowledgeBaseEntries.id, id))
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
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return ApiErrors.forbidden()
  }

  const { id } = await params

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
}

// ── DELETE: soft-delete (actually hard delete for now since no deletedAt) ─────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return ApiErrors.forbidden()
  }

  const { id } = await params

  const [deleted] = await db
    .delete(knowledgeBaseEntries)
    .where(eq(knowledgeBaseEntries.id, id))
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
