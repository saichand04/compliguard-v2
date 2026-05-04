import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { knowledgeBaseEntries } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

const CATEGORY_LABELS: Record<string, string> = {
  frameworks: 'Frameworks',
  controls: 'Controls',
  compliance: 'Compliance',
  security: 'Security',
  operations: 'Operations',
}

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const rows = await db
    .select({
      category: knowledgeBaseEntries.category,
      count: sql<number>`count(*)::int`,
    })
    .from(knowledgeBaseEntries)
    .groupBy(knowledgeBaseEntries.category)

  const categories = rows
    .filter((r) => r.category !== null)
    .map((r) => ({
      value: r.category!,
      label: CATEGORY_LABELS[r.category!] ?? r.category!,
      count: r.count,
    }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({ categories })
}
