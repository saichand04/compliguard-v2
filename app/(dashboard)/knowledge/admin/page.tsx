'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings, ArrowLeft, Plus, Trash2, Edit2, ExternalLink,
  Cpu, CheckCircle2, XCircle, RefreshCw, Loader2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface KBEntry {
  id: string
  title: string
  category: string | null
  embedding: unknown
  isPublic: boolean
  isBuiltIn: boolean
  createdAt: string
}

interface EmbedResult {
  processed: number
  failed: number
  total: number
}

// ── Category badge ────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  frameworks:  { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)', text: '#8B5CF6' },
  controls:    { bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.3)',  text: '#06B6D4' },
  compliance:  { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)',  text: '#22C55E' },
  security:    { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', text: '#F97316' },
  operations:  { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)',  text: '#EAB308' },
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
  const c = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.frameworks
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      textTransform: 'capitalize',
    }}>
      {category}
    </span>
  )
}

// ── Edit Entry Modal ──────────────────────────────────────────────────────────

interface EditModalProps {
  entry: KBEntry & { title: string; content?: string; tags?: unknown }
  onClose: () => void
  onUpdated: (entry: KBEntry) => void
}

function EditModal({ entry, onClose, onUpdated }: EditModalProps) {
  const [form, setForm] = useState({
    title: entry.title,
    category: entry.category ?? 'frameworks',
    isPublic: entry.isPublic,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/knowledge/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to update')
        return
      }
      const { entry: updated } = await res.json()
      onUpdated(updated)
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
        width: '100%', maxWidth: 480, margin: '0 16px',
        background: '#0E1120', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: 28,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginBottom: 20 }}>Edit Article</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ color: '#EF4444', fontSize: 13 }}>{error}</div>}
          <input className="input-glass" style={{ width: '100%' }} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <select className="input-glass" style={{ width: '100%' }} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {['frameworks', 'controls', 'compliance', 'security', 'operations'].map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />
            <span style={{ color: 'var(--text-muted)' }}>Public</span>
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} style={{
              padding: '7px 18px', borderRadius: 8, background: '#7C3AED', border: 'none',
              color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Admin Page ───────────────────────────────────────────────────────────

export default function KnowledgeAdminPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<(KBEntry & { content: string; tags: unknown })[]>([])
  const [loading, setLoading] = useState(true)
  const [embedLoading, setEmbedLoading] = useState(false)
  const [embedResult, setEmbedResult] = useState<EmbedResult | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editEntry, setEditEntry] = useState<(KBEntry & { content: string; tags: unknown }) | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/knowledge?limit=100')
      if (!res.ok) return
      const data = await res.json()
      setEntries(data.entries)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const handleGenerateAllEmbeddings = async () => {
    setEmbedLoading(true)
    setEmbedResult(null)
    try {
      const res = await fetch('/api/knowledge/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      const data = await res.json()
      setEmbedResult(data)
    } catch {
      setEmbedResult({ processed: 0, failed: -1, total: 0 })
    } finally {
      setEmbedLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
      setEntries((prev) => prev.filter((e) => e.id !== id))
      setDeleteId(null)
    } catch {
      // ignore
    }
  }

  const hasEmbedding = (entry: KBEntry): boolean => {
    if (!entry.embedding) return false
    if (Array.isArray(entry.embedding)) return (entry.embedding as unknown[]).length > 0
    return false
  }

  const withoutEmbedding = entries.filter((e) => !hasEmbedding(e)).length

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Edit modal */}
      {editEntry && (
        <EditModal
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onUpdated={(updated) => {
            setEntries((prev) => prev.map((e) => e.id === updated.id ? { ...e, ...updated } : e))
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#0E1120', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: 28, maxWidth: 360, width: '100%', margin: '0 16px',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginBottom: 10 }}>Delete Article?</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={() => handleDelete(deleteId)}
                style={{
                  padding: '7px 18px', borderRadius: 8, background: '#DC2626',
                  border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => router.push('/knowledge')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--text-muted)', fontSize: 13, background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} /> Back to Knowledge Base
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36,
            background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Settings size={17} style={{ color: '#8B5CF6' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
              Knowledge Base Admin
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Manage all articles and generate AI embeddings
            </p>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        backdropFilter: 'blur(20px)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        marginBottom: 24,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>
            {entries.length} total articles
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {entries.filter(hasEmbedding).length} with embeddings ·{' '}
            <span style={{ color: withoutEmbedding > 0 ? '#EAB308' : '#22C55E' }}>
              {withoutEmbedding} missing embeddings
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleGenerateAllEmbeddings}
            disabled={embedLoading || withoutEmbedding === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              background: embedLoading ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.35)',
              color: '#8B5CF6', fontSize: 13, fontWeight: 600, cursor: embedLoading || withoutEmbedding === 0 ? 'not-allowed' : 'pointer',
              opacity: withoutEmbedding === 0 ? 0.5 : 1,
            }}
          >
            {embedLoading ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
            Generate All Embeddings
          </button>

          <button
            onClick={() => router.push('/knowledge')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Add Article
          </button>
        </div>

        {embedResult && (
          <div style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            background: embedResult.failed === -1
              ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.08)',
            border: `1px solid ${embedResult.failed === -1 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.2)'}`,
            fontSize: 13,
            color: embedResult.failed === -1 ? '#EF4444' : '#22C55E',
          }}>
            {embedResult.failed === -1
              ? 'Failed to generate embeddings — check AI configuration'
              : `Processed ${embedResult.processed} · Failed ${embedResult.failed} · Total ${embedResult.total}`}
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{
        backdropFilter: 'blur(20px)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Title', 'Category', 'Embedding', 'Public', 'Built-in', 'Created', 'Actions'].map((h) => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center' }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No articles found
                </td>
              </tr>
            ) : (
              entries.map((entry, i) => (
                <tr
                  key={entry.id}
                  style={{
                    borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                >
                  <td style={{ padding: '12px 16px', maxWidth: 340 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.title}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <CategoryBadge category={entry.category} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {hasEmbedding(entry) ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22C55E', fontSize: 12 }}>
                        <CheckCircle2 size={13} /> Yes
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12 }}>
                        <XCircle size={13} /> No
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 12, color: entry.isPublic ? '#22C55E' : 'var(--text-muted)' }}>
                      {entry.isPublic ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 12, color: entry.isBuiltIn ? '#06B6D4' : 'var(--text-muted)' }}>
                      {entry.isBuiltIn ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => router.push(`/knowledge/${entry.id}`)}
                        className="btn-icon"
                        title="View"
                      >
                        <ExternalLink size={13} />
                      </button>
                      <button
                        onClick={() => setEditEntry(entry)}
                        className="btn-icon"
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      {!entry.isBuiltIn && (
                        <button
                          onClick={() => setDeleteId(entry.id)}
                          className="btn-icon"
                          title="Delete"
                          style={{ color: '#EF4444' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          await fetch('/api/knowledge/embed', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: entry.id }),
                          })
                          fetchEntries()
                        }}
                        className="btn-icon"
                        title="Generate Embedding"
                      >
                        <RefreshCw size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
