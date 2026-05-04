import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { knowledgeBaseEntries } from '@/lib/db/schema'
import { eq, and, ilike, or, sql, desc } from 'drizzle-orm'

// Public route — no auth required

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '12')))
  const category = searchParams.get('category') ?? undefined
  const search = searchParams.get('search') ?? undefined
  const offset = (page - 1) * limit

  const conditions: ReturnType<typeof eq>[] = [
    eq(knowledgeBaseEntries.isPublic, true),
  ]

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

  const whereClause = and(...conditions)

  const [entries, countResult] = await Promise.all([
    db
      .select({
        id: knowledgeBaseEntries.id,
        title: knowledgeBaseEntries.title,
        category: knowledgeBaseEntries.category,
        tags: knowledgeBaseEntries.tags,
        content: knowledgeBaseEntries.content,
        createdAt: knowledgeBaseEntries.createdAt,
      })
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
