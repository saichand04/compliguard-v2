import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hybridSearch } from '@/lib/knowledge/search'
import { generateEmbedding, buildEmbeddingText } from '@/lib/knowledge/embeddings'
import { z } from 'zod'

const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional().default(10),
  category: z.string().optional(),
  useEmbedding: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = searchSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const { query, limit, category, useEmbedding } = result.data

  // Optionally generate embedding for the query
  let queryEmbedding: number[] | undefined
  if (useEmbedding) {
    const embText = buildEmbeddingText(query, query, [])
    const emb = await generateEmbedding(embText)
    if (emb.length > 0) queryEmbedding = emb
  }

  const results = await hybridSearch(
    query,
    queryEmbedding,
    limit,
    session.orgId ?? undefined,
    category,
  )

  return NextResponse.json({
    results: results.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      tags: r.tags,
      excerpt: r.content.slice(0, 200),
      relevance: Math.round(r.score * 100) / 100,
      isPublic: r.isPublic,
      createdAt: r.createdAt,
    })),
    total: results.length,
    query,
  })
}
