import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { knowledgeBaseEntries } from '@/lib/db/schema'
import { desc, sql } from 'drizzle-orm'
import { BookOpen, Sparkles } from 'lucide-react'
import KnowledgeClient from './KnowledgeClient'

async function getInitialData() {
  try {
    const [entries, countResult] = await Promise.all([
      db
        .select()
        .from(knowledgeBaseEntries)
        .orderBy(desc(knowledgeBaseEntries.createdAt))
        .limit(12),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(knowledgeBaseEntries),
    ])

    return {
      entries: entries.map(e => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
      total: countResult[0]?.count ?? 0,
    }
  } catch {
    return { entries: [], total: 0 }
  }
}

async function getUserRole(): Promise<string> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return 'user'

    // Create a minimal request-like object to reuse existing JWT util
    const req = new NextRequest('http://localhost', {
      headers: { cookie: `session=${token}` },
    })
    const { getSessionFromRequest: getSession } = await import('@/lib/auth/jwt')
    const session = await getSession(req)
    return session?.role ?? 'user'
  } catch {
    return 'user'
  }
}

export default async function KnowledgePage() {
  const [{ entries, total }, userRole] = await Promise.all([
    getInitialData(),
    getUserRole(),
  ])

  const totalPages = Math.ceil(total / 12)

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.2))',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={18} style={{ color: '#8B5CF6' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
              Knowledge Base
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              GRC guides, frameworks, and compliance resources
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap',
        }}>
          {[
            { label: 'Total Articles', value: total, color: '#8B5CF6' },
            { label: 'Frameworks', value: entries.filter((e) => e.category === 'frameworks').length, color: '#8B5CF6' },
            { label: 'Security', value: entries.filter((e) => e.category === 'security').length, color: '#06B6D4' },
            { label: 'Compliance', value: entries.filter((e) => e.category === 'compliance').length, color: '#22C55E' },
          ].map((stat) => (
            <div key={stat.label} style={{
              backdropFilter: 'blur(20px)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, padding: '12px 18px', flex: '0 0 auto',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{stat.label}</div>
            </div>
          ))}

          <div style={{
            backdropFilter: 'blur(20px)',
            background: 'rgba(139,92,246,0.06)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 10, padding: '12px 18px', flex: '0 0 auto',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Sparkles size={14} style={{ color: '#8B5CF6' }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8B5CF6' }}>Vector Search Ready</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI embeddings on demand</div>
            </div>
          </div>
        </div>
      </div>

      {/* Client-side interactive section */}
      <Suspense fallback={
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading articles...</div>
      }>
        <KnowledgeClient
          initialEntries={entries as Parameters<typeof KnowledgeClient>[0]['initialEntries']}
          initialTotal={total}
          initialPage={1}
          initialTotalPages={totalPages}
          userRole={userRole}
        />
      </Suspense>
    </div>
  )
}
