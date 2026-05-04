import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { knowledgeBaseEntries } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.orgId
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { id } = await params

  // Find by conversationId in metadata or by db id
  const rows = await db
    .select()
    .from(knowledgeBaseEntries)
    .where(
      and(
        eq(knowledgeBaseEntries.category, 'ai_chat'),
        eq(knowledgeBaseEntries.organizationId, orgId)
      )
    )

  const row = rows.find((r) => {
    const meta = r.metadata as { conversationId?: string } | null
    return meta?.conversationId === id || r.id === id
  })

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let messages: Array<{ role: string; content: string; timestamp?: string }> = []
  try {
    messages = JSON.parse(row.content)
  } catch {
    // ignore
  }

  const meta = row.metadata as { conversationId?: string } | null

  return NextResponse.json({
    id: meta?.conversationId || row.id,
    dbId: row.id,
    title: row.title,
    messages,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.orgId
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { id } = await params

  const rows = await db
    .select()
    .from(knowledgeBaseEntries)
    .where(
      and(
        eq(knowledgeBaseEntries.category, 'ai_chat'),
        eq(knowledgeBaseEntries.organizationId, orgId)
      )
    )

  const row = rows.find((r) => {
    const meta = r.metadata as { conversationId?: string } | null
    return meta?.conversationId === id || r.id === id
  })

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db
    .delete(knowledgeBaseEntries)
    .where(eq(knowledgeBaseEntries.id, row.id))

  return NextResponse.json({ success: true })
}
