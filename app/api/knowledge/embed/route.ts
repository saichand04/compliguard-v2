import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { knowledgeBaseEntries } from '@/lib/db/schema'
import { eq, isNull } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { generateEmbedding, buildEmbeddingText } from '@/lib/knowledge/embeddings'
import { z } from 'zod'

const embedSchema = z.object({
  id: z.string().uuid().optional(),
  all: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return ApiErrors.forbidden()
  }

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = embedSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const { id, all } = result.data

  let entries: { id: string; title: string; content: string; tags: unknown }[] = []

  if (id) {
    // Single entry by id
    const [entry] = await db
      .select()
      .from(knowledgeBaseEntries)
      .where(eq(knowledgeBaseEntries.id, id))
      .limit(1)

    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    entries = [entry]
  } else if (all) {
    // All entries missing embeddings
    entries = await db
      .select()
      .from(knowledgeBaseEntries)
      .where(isNull(knowledgeBaseEntries.embedding))
  } else {
    return ApiErrors.badRequest('Provide either "id" or "all: true"')
  }

  let processed = 0
  let failed = 0

  for (const entry of entries) {
    try {
      const text = buildEmbeddingText(entry.title, entry.content, entry.tags)
      const embedding = await generateEmbedding(text)

      if (embedding.length > 0) {
        await db
          .update(knowledgeBaseEntries)
          .set({ embedding: embedding as unknown as null, updatedAt: new Date() })
          .where(eq(knowledgeBaseEntries.id, entry.id))
        processed++
      } else {
        // Provider not configured or no API key — skip
        failed++
      }
    } catch (err) {
      console.error('[embed] Failed for entry', entry.id, err)
      failed++
    }
  }

  return NextResponse.json({ processed, failed, total: entries.length })
}
