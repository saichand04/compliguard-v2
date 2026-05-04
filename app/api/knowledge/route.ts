import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { knowledgeBaseEntries } from '@/lib/db/schema'
import { eq, and, ilike, or, sql, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { generateEmbedding, buildEmbeddingText } from '@/lib/knowledge/embeddings'
import { z } from 'zod'

// ── GET: list entries with pagination ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const category = searchParams.get('category') ?? undefined
  const search = searchParams.get('search') ?? undefined
  const offset = (page - 1) * limit

  const conditions: ReturnType<typeof eq>[] = []

  if (category && category !== 'all') {
    conditions.push(eq(knowledgeBaseEntries.category, category))
  }

  if (search) {
    const term = `%${search}%`
    conditions.push(
      or(
        ilike(knowledgeBaseEntries.title, term),
        ilike(knowledgeBaseEntries.content, term),
        sql`${knowledgeBaseEntries.tags}::text ILIKE ${term}`,
      )!,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [entries, countResult] = await Promise.all([
    db
      .select()
      .from(knowledgeBaseEntries)
      .where(whereClause)
      .orderBy(desc(knowledgeBaseEntries.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeBaseEntries)
      .where(whereClause),
  ])

  const total = countResult[0]?.count ?? 0

  return NextResponse.json({
    entries,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}

// ── POST: create entry ────────────────────────────────────────────────────────

const createSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional().default(false),
  generateEmbedding: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return ApiErrors.forbidden()
  }

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = createSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data

  let embedding: number[] | null = null

  if (data.generateEmbedding) {
    const embText = buildEmbeddingText(data.title, data.content, data.tags ?? [])
    const emb = await generateEmbedding(embText)
    embedding = emb.length > 0 ? emb : null
  }

  const [entry] = await db
    .insert(knowledgeBaseEntries)
    .values({
      title: data.title,
      content: data.content,
      category: data.category,
      tags: data.tags ?? [],
      isPublic: data.isPublic,
      embedding: embedding as unknown as null,
      organizationId: session.orgId ?? null,
      createdBy: session.userId,
      metadata: { sourceType: 'internal' },
    })
    .returning()

  return NextResponse.json({ entry }, { status: 201 })
}
