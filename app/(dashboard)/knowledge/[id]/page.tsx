import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { knowledgeBaseEntries } from '@/lib/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { ArrowLeft, Tag, BookOpen, Calendar, Globe } from 'lucide-react'

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  frameworks:  { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)', text: '#8B5CF6' },
  controls:    { bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.3)',  text: '#06B6D4' },
  compliance:  { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)',  text: '#22C55E' },
  security:    { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', text: '#F97316' },
  operations:  { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)',  text: '#EAB308' },
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default async function KnowledgeEntryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [entry] = await db
    .select()
    .from(knowledgeBaseEntries)
    .where(eq(knowledgeBaseEntries.id, id))
    .limit(1)

  if (!entry) notFound()

  // Fetch related articles in same category (exclude current)
  const relatedEntries = entry.category
    ? await db
        .select()
        .from(knowledgeBaseEntries)
        .where(
          and(
            eq(knowledgeBaseEntries.category, entry.category),
            ne(knowledgeBaseEntries.id, entry.id),
          ),
        )
        .limit(3)
    : []

  const tags = Array.isArray(entry.tags) ? (entry.tags as string[]) : []
  const cat = entry.category ? CATEGORY_COLORS[entry.category] : null

  // Split content into paragraphs
  const paragraphs = entry.content
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      {/* Back */}
      <Link
        href="/knowledge"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', marginBottom: 24,
        }}
      >
        <ArrowLeft size={14} /> Back to Knowledge Base
      </Link>

      {/* Article header */}
      <div style={{
        backdropFilter: 'blur(20px)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {entry.category && cat && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '3px 10px', borderRadius: 99,
              background: cat.bg, border: `1px solid ${cat.border}`,
              color: cat.text, fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
            }}>
              {entry.category}
            </span>
          )}
          {entry.isPublic && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 99,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              color: '#22C55E', fontSize: 12,
            }}>
              <Globe size={10} /> Public
            </span>
          )}
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F1F5F9', margin: '0 0 16px', lineHeight: 1.35 }}>
          {entry.title}
        </h1>

        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {tags.map((tag) => (
              <span key={tag} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 12, color: 'var(--text-muted)',
              }}>
                <Tag size={10} /> {tag}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <Calendar size={12} />
          <span>Published {formatDate(entry.createdAt)}</span>
        </div>
      </div>

      {/* Article content */}
      <div style={{
        backdropFilter: 'blur(20px)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {paragraphs.map((para, i) => (
            <p key={i} style={{
              fontSize: 14.5, lineHeight: 1.8, color: '#CBD5E1', margin: 0,
            }}>
              {para}
            </p>
          ))}
        </div>
      </div>

      {/* Related articles */}
      {relatedEntries.length > 0 && (
        <div style={{
          backdropFilter: 'blur(20px)',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, padding: '24px 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BookOpen size={15} style={{ color: '#8B5CF6' }} />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#F1F5F9', margin: 0 }}>
              Related Articles
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {relatedEntries.map((rel) => {
              const relTags = Array.isArray(rel.tags) ? (rel.tags as string[]) : []
              return (
                <Link
                  key={rel.id}
                  href={`/knowledge/${rel.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'border-color 0.15s',
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', marginBottom: 4 }}>
                      {rel.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {rel.content.slice(0, 100)}…
                    </div>
                    {relTags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        {relTags.slice(0, 3).map((tag) => (
                          <span key={tag} style={{
                            padding: '1px 6px', borderRadius: 4,
                            background: 'rgba(139,92,246,0.08)',
                            border: '1px solid rgba(139,92,246,0.15)',
                            fontSize: 10, color: '#8B5CF6',
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
