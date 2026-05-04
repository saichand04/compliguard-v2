'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, X, BookOpen, Tag, ChevronLeft, ChevronRight, Filter, Loader2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface KBEntry {
  id: string
  title: string
  category: string | null
  tags: unknown
  content: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

interface PaginationInfo {
  total: number
  page: number
  totalPages: number
}

interface KnowledgeClientProps {
  initialEntries: KBEntry[]
  initialTotal: number
  initialPage: number
  initialTotalPages: number
  userRole: string
}

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'frameworks', label: 'Frameworks' },
  { value: 'controls', label: 'Controls' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'security', label: 'Security' },
  { value: 'operations', label: 'Operations' },
]

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  frameworks:  { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)', text: '#8B5CF6' },
  controls:    { bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.3)',  text: '#06B6D4' },
  compliance:  { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)',  text: '#22C55E' },
  security:    { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', text: '#F97316' },
  operations:  { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)',  text: '#EAB308' },
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null
  const c = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.frameworks
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.text, fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
    }}>
      {category}
    </span>
  )
}

// ── Add Article Modal ─────────────────────────────────────────────────────────

interface AddModalProps {
  onClose: () => void
  onCreated: (entry: KBEntry) => void
}

function AddArticleModal({ onClose, onCreated }: AddModalProps) {
  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'frameworks',
    tags: '',
    isPublic: true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          category: form.category,
          tags,
          isPublic: form.isPublic,
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to create article')
        return
      }

      const { entry } = await res.json()
      onCreated(entry)
      onClose()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 640, margin: '0 16px',
        background: '#0E1120', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: 32, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9' }}>Add Knowledge Article</div>
          <button onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#EF4444', fontSize: 13,
            }}>{error}</div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Title *
            </label>
            <input
              className="input-glass"
              style={{ width: '100%' }}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Article title..."
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Category
            </label>
            <select
              className="input-glass"
              style={{ width: '100%' }}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Content *
            </label>
            <textarea
              className="input-glass"
              style={{ width: '100%', minHeight: 200, resize: 'vertical' }}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Write the article content..."
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Tags (comma-separated)
            </label>
            <input
              className="input-glass"
              style={{ width: '100%' }}
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="NIST, compliance, security..."
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
            />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Make article public</span>
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 20px', borderRadius: 8,
                background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                border: 'none', color: '#fff', fontWeight: 600, fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create Article
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Client Component ─────────────────────────────────────────────────────

export default function KnowledgeClient({
  initialEntries,
  initialTotal,
  initialPage,
  initialTotalPages,
  userRole,
}: KnowledgeClientProps) {
  const router = useRouter()
  const [entries, setEntries] = useState<KBEntry[]>(initialEntries)
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: initialTotal,
    page: initialPage,
    totalPages: initialTotalPages,
  })
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isAdmin = userRole === 'admin' || userRole === 'super_admin'

  const fetchEntries = useCallback(async (page = 1, q = search, cat = category) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '12',
        ...(cat !== 'all' && { category: cat }),
        ...(q && { search: q }),
      })
      const res = await fetch(`/api/knowledge?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setEntries(data.entries)
      setPagination({ total: data.total, page: data.page, totalPages: data.totalPages })
    } finally {
      setLoading(false)
    }
  }, [search, category])

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchEntries(1, search, category)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCategoryChange = (cat: string) => {
    setCategory(cat)
    fetchEntries(1, search, cat)
  }

  const handlePage = (p: number) => fetchEntries(p, search, category)

  const getTags = (entry: KBEntry): string[] => {
    if (!entry.tags) return []
    if (Array.isArray(entry.tags)) return entry.tags as string[]
    return []
  }

  return (
    <>
      {showAddModal && isAdmin && (
        <AddArticleModal
          onClose={() => setShowAddModal(false)}
          onCreated={(entry) => {
            setEntries((prev) => [entry, ...prev])
            setPagination((p) => ({ ...p, total: p.total + 1 }))
          }}
        />
      )}

      {/* Header controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
          <Search size={15} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            className="input-glass"
            style={{ width: '100%', paddingLeft: 38 }}
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="btn-icon"
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24 }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => router.push('/knowledge/admin')}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            >
              <Filter size={14} /> Admin
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Plus size={14} /> Add Article
            </button>
          </div>
        )}
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
        {CATEGORIES.map((cat) => {
          const active = category === cat.value
          const color = cat.value !== 'all' ? CATEGORY_COLORS[cat.value] : null
          return (
            <button
              key={cat.value}
              onClick={() => handleCategoryChange(cat.value)}
              style={{
                padding: '5px 14px', borderRadius: 99,
                border: active
                  ? `1px solid ${color?.border ?? 'rgba(139,92,246,0.5)'}`
                  : '1px solid rgba(255,255,255,0.06)',
                background: active
                  ? color?.bg ?? 'rgba(139,92,246,0.12)'
                  : 'rgba(255,255,255,0.03)',
                color: active ? (color?.text ?? '#8B5CF6') : 'var(--text-muted)',
                fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={13} className="animate-spin" /> Searching...
          </span>
        ) : (
          <span>{pagination.total} article{pagination.total !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ''}</span>
        )}
      </div>

      {/* Article grid */}
      {entries.length === 0 && !loading ? (
        <div style={{
          textAlign: 'center', padding: '80px 20px',
          background: 'rgba(255,255,255,0.02)', borderRadius: 16,
          border: '1px dashed rgba(255,255,255,0.08)',
        }}>
          <BookOpen size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            No articles found
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {search ? `No results for "${search}"` : 'No articles in this category yet'}
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}>
          {entries.map((entry) => {
            const tags = getTags(entry)
            const excerpt = entry.content.slice(0, 150).trim()
            return (
              <div
                key={entry.id}
                style={{
                  backdropFilter: 'blur(20px)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12, padding: 20,
                  display: 'flex', flexDirection: 'column', gap: 12,
                  transition: 'border-color 0.2s, transform 0.2s',
                  cursor: 'pointer',
                }}
                onClick={() => router.push(`/knowledge/${entry.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', margin: 0, lineHeight: 1.4, flex: 1 }}>
                    {entry.title}
                  </h3>
                  <CategoryBadge category={entry.category} />
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6, flex: 1 }}>
                  {excerpt}{entry.content.length > 150 ? '…' : ''}
                </p>

                {tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {tags.slice(0, 4).map((tag) => (
                      <span key={tag} style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        padding: '2px 7px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        fontSize: 11, color: 'var(--text-muted)',
                      }}>
                        <Tag size={9} /> {tag}
                      </span>
                    ))}
                    {tags.length > 4 && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 4px' }}>
                        +{tags.length - 4}
                      </span>
                    )}
                  </div>
                )}

                <button
                  style={{
                    alignSelf: 'flex-start',
                    padding: '5px 14px', borderRadius: 7,
                    background: 'rgba(139,92,246,0.1)',
                    border: '1px solid rgba(139,92,246,0.25)',
                    color: '#8B5CF6', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={(e) => { e.stopPropagation(); router.push(`/knowledge/${entry.id}`) }}
                >
                  Read More
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 36 }}>
          <button
            onClick={() => handlePage(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="btn-icon"
            style={{ opacity: pagination.page <= 1 ? 0.4 : 1 }}
          >
            <ChevronLeft size={15} />
          </button>

          {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
            const p = i + 1
            const active = p === pagination.page
            return (
              <button
                key={p}
                onClick={() => handlePage(p)}
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: active ? 'rgba(139,92,246,0.15)' : 'transparent',
                  border: active ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
                  color: active ? '#8B5CF6' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer',
                }}
              >
                {p}
              </button>
            )
          })}

          <button
            onClick={() => handlePage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="btn-icon"
            style={{ opacity: pagination.page >= pagination.totalPages ? 0.4 : 1 }}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </>
  )
}
