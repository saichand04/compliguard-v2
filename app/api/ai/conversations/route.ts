import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { knowledgeBaseEntries } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.orgId
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const rows = await db
    .select()
    .from(knowledgeBaseEntries)
    .where(
      and(
        eq(knowledgeBaseEntries.category, 'ai_chat'),
        eq(knowledgeBaseEntries.organizationId, orgId)
      )
    )
    .orderBy(desc(knowledgeBaseEntries.updatedAt))
    .limit(10)

  const conversations = rows.map((row) => {
    const meta = row.metadata as { conversationId?: string; userId?: string } | null
    let preview = ''
    let messageCount = 0
    try {
      const msgs = JSON.parse(row.content)
      messageCount = msgs.length
      const lastUser = [...msgs].reverse().find((m: { role: string; content: string }) => m.role === 'user')
      preview = lastUser?.content?.slice(0, 100) || ''
    } catch {
      // ignore
    }

    return {
      id: meta?.conversationId || row.id,
      dbId: row.id,
      title: row.title,
      preview,
      messageCount,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    }
  })

  return NextResponse.json({ conversations })
}

export async function DELETE(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.orgId
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  // Delete all conversations for org
  await db
    .delete(knowledgeBaseEntries)
    .where(
      and(
        eq(knowledgeBaseEntries.category, 'ai_chat'),
        eq(knowledgeBaseEntries.organizationId, orgId)
      )
    )

  return NextResponse.json({ success: true })
}
