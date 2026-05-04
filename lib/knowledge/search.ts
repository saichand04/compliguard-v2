/**
 * Knowledge Base vector and text search utilities
 *
 * Since pgvector is not installed, embedding similarity is computed in JavaScript.
 * Full-text search uses ILIKE on title, content, and tags columns.
 */

import { db } from '@/lib/db'
import { knowledgeBaseEntries } from '@/lib/db/schema'
import { isNotNull, ilike, or, sql, and, eq } from 'drizzle-orm'
import type { KnowledgeBaseEntry } from '@/lib/db/schema'

// ── Cosine similarity ─────────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}

// ── Vector search ─────────────────────────────────────────────────────────────

export async function searchByEmbedding(
  queryEmbedding: number[],
  limit = 10,
  orgId?: string,
): Promise<Array<KnowledgeBaseEntry & { score: number }>> {
  // Fetch all entries that have embeddings
  const conditions = [isNotNull(knowledgeBaseEntries.embedding)]
  if (orgId) {
    conditions.push(
      or(
        eq(knowledgeBaseEntries.organizationId, orgId),
        eq(knowledgeBaseEntries.isPublic, true),
      )!,
    )
  } else {
    conditions.push(eq(knowledgeBaseEntries.isPublic, true))
  }

  const entries = await db
    .select()
    .from(knowledgeBaseEntries)
    .where(and(...conditions))

  // Compute similarity in JS
  const scored = entries.map((entry) => {
    const embeddingRaw = entry.embedding as number[] | null
    const score = embeddingRaw ? cosineSimilarity(queryEmbedding, embeddingRaw) : 0
    return { ...entry, score }
  })

  // Sort descending by score and return top-N
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

// ── Text search ───────────────────────────────────────────────────────────────

export async function searchByText(
  query: string,
  limit = 10,
  orgId?: string,
  category?: string,
): Promise<Array<KnowledgeBaseEntry & { score: number }>> {
  const term = `%${query}%`

  const conditions: ReturnType<typeof eq>[] = []

  if (orgId) {
    conditions.push(
      or(
        eq(knowledgeBaseEntries.organizationId, orgId),
        eq(knowledgeBaseEntries.isPublic, true),
      )!,
    )
  } else {
    conditions.push(eq(knowledgeBaseEntries.isPublic, true))
  }

  if (category && category !== 'all') {
    conditions.push(eq(knowledgeBaseEntries.category, category))
  }

  // Text match condition: title, content, or tags
  conditions.push(
    or(
      ilike(knowledgeBaseEntries.title, term),
      ilike(knowledgeBaseEntries.content, term),
      sql`${knowledgeBaseEntries.tags}::text ILIKE ${term}`,
    )!,
  )

  const entries = await db
    .select()
    .from(knowledgeBaseEntries)
    .where(and(...conditions))
    .limit(limit)

  // Assign basic relevance score: title match scores higher
  const lowerQuery = query.toLowerCase()
  return entries.map((entry) => {
    let score = 0.5 // base score for any match
    if (entry.title.toLowerCase().includes(lowerQuery)) score += 0.3
    if (entry.category?.toLowerCase().includes(lowerQuery)) score += 0.1
    const tagsStr = JSON.stringify(entry.tags ?? []).toLowerCase()
    if (tagsStr.includes(lowerQuery)) score += 0.1
    return { ...entry, score: Math.min(score, 1.0) }
  })
}

// ── Hybrid search ─────────────────────────────────────────────────────────────

export async function hybridSearch(
  query: string,
  embedding?: number[],
  limit = 10,
  orgId?: string,
  category?: string,
): Promise<Array<KnowledgeBaseEntry & { score: number }>> {
  if (!query && !embedding) return []

  if (embedding && embedding.length > 0) {
    // Run both searches in parallel
    const [vectorResults, textResults] = await Promise.all([
      searchByEmbedding(embedding, limit * 2, orgId),
      query ? searchByText(query, limit * 2, orgId, category) : Promise.resolve([]),
    ])

    // Merge results by id, taking the max score
    const map = new Map<string, KnowledgeBaseEntry & { score: number }>()

    for (const r of vectorResults) {
      map.set(r.id, r)
    }
    for (const r of textResults) {
      const existing = map.get(r.id)
      if (existing) {
        // Combine scores (weighted average, vector slightly preferred)
        existing.score = existing.score * 0.6 + r.score * 0.4
      } else {
        map.set(r.id, r)
      }
    }

    const merged = Array.from(map.values())
    merged.sort((a, b) => b.score - a.score)
    return merged.slice(0, limit)
  }

  // Text-only search
  return searchByText(query, limit, orgId, category)
}

// ── Fetch entries for listing ─────────────────────────────────────────────────

export async function listEntries(params: {
  page?: number
  limit?: number
  category?: string
  search?: string
  orgId?: string
  includeNonPublic?: boolean
}): Promise<{ entries: KnowledgeBaseEntry[]; total: number }> {
  const page = params.page ?? 1
  const pageLimit = params.limit ?? 20
  const offset = (page - 1) * pageLimit

  const conditions: ReturnType<typeof eq>[] = []

  if (!params.includeNonPublic) {
    conditions.push(eq(knowledgeBaseEntries.isPublic, true))
  }

  if (params.orgId && !params.includeNonPublic) {
    // Show org entries + public entries
  }

  if (params.category && params.category !== 'all') {
    conditions.push(eq(knowledgeBaseEntries.category, params.category))
  }

  if (params.search) {
    const term = `%${params.search}%`
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
      .limit(pageLimit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeBaseEntries)
      .where(whereClause),
  ])

  return {
    entries,
    total: countResult[0]?.count ?? 0,
  }
}
