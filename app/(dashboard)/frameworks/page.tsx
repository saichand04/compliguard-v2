'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, Plus, Upload, Search, ChevronRight,
  Clock, BookOpen, Archive, RefreshCw, AlertCircle,
} from 'lucide-react'

interface Framework {
  id: string
  name: string
  shortName: string | null
  version: string | null
  description: string | null
  category: string | null
  isBuiltIn: boolean
  isActive: boolean
  metadata: Record<string, unknown> | null
  updatedAt: string
  controlCount?: number
}

function getFrameworkStatus(fw: Framework): 'published' | 'draft' | 'archived' {
  if (!fw.isActive) return 'archived'
  const meta = fw.metadata as Record<string, unknown> | null
  if (meta?.status === 'published') return 'published'
  if (meta?.status === 'archived') return 'archived'
  if (fw.isBuiltIn) return 'published'
  return 'draft'
}

const STATUS_STYLES = {
  published: { label: 'Published', bg: 'rgba(16,185,129,0.12)', color: '#10B981', border: 'rgba(16,185,129,0.25)' },
  draft: { label: 'Draft', bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.25)' },
  archived: { label: 'Archived', bg: 'rgba(100,116,139,0.12)', color: '#94A3B8', border: 'rgba(100,116,139,0.25)' },
}

const CATEGORY_COLORS: Record<string, string> = {
  SOC2: '#8B5CF6', ISO: '#06B6D4', HIPAA: '#10B981',
  NIST: '#3B82F6', PCI: '#F59E0B', Custom: '#94A3B8',
}

function getCategoryColor(cat: string | null): string {
  if (!cat) return '#94A3B8'
  const key = Object.keys(CATEGORY_COLORS).find((k) => cat.toUpperCase().includes(k.toUpperCase()))
  return key ? CATEGORY_COLORS[key] : '#94A3B8'
}

function CreateFrameworkModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (fw: Framework) => void
}) {
  const [name, setName] = useState('')
  const [version, setVersion] = useState('1.0')
  const [category, setCategory] = useState('Custom')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/frameworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), version, category, description }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create'); return }
      onCreated(data.framework)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        className="glass-card animate-fade-in"
        style={{ width: 480, padding: 28, margin: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Create Framework
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            Create a new custom compliance framework
          </div>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, marginBottom: 14, fontSize: 12.5, color: '#EF4444', display: 'flex', gap: 6, alignItems: 'center' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Framework Name *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Security Framework"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Version</label>
              <input
                className="input"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0"
              />
            </div>
            <div>
              <label style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Category</label>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%' }}
              >
                {['SOC2', 'ISO', 'HIPAA', 'NIST', 'PCI', 'Custom'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Description</label>
            <textarea
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this framework for?"
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={loading} style={{ fontSize: 13 }}>
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
            Create Framework
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FrameworksPage() {
  const router = useRouter()
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/frameworks')
      if (res.ok) {
        const data = await res.json()
        setFrameworks(data.frameworks || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = frameworks.filter((fw) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      fw.name.toLowerCase().includes(q) ||
      fw.shortName?.toLowerCase().includes(q) ||
      fw.category?.toLowerCase().includes(q) ||
      fw.description?.toLowerCase().includes(q)
    )
  })

  const statusCounts = {
    published: frameworks.filter((fw) => getFrameworkStatus(fw) === 'published').length,
    draft: frameworks.filter((fw) => getFrameworkStatus(fw) === 'draft').length,
    archived: frameworks.filter((fw) => getFrameworkStatus(fw) === 'archived').length,
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Frameworks
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            Manage compliance frameworks, controls, and version history
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <a
            href="/frameworks/upload"
            className="btn-ghost"
            style={{ fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Upload size={14} /> Import XLSX
          </a>
          <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ fontSize: 13 }}>
            <Plus size={14} /> Create Framework
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Published', count: statusCounts.published, color: '#10B981' },
          { label: 'Draft', count: statusCounts.draft, color: '#F59E0B' },
          { label: 'Archived', count: statusCounts.archived, color: '#94A3B8' },
        ].map(({ label, count, color }) => (
          <div key={label} className="glass-card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search frameworks by name, category..."
          style={{ paddingLeft: 34, width: '100%', maxWidth: 400 }}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card" style={{ height: 160, background: 'rgba(255,255,255,0.02)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, background: 'var(--violet-dim)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Shield size={20} style={{ color: 'var(--violet)' }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            {search ? 'No frameworks found' : 'No frameworks yet'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            {search ? 'Try a different search term' : 'Create or import a framework to get started'}
          </div>
          {!search && (
            <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ fontSize: 13 }}>
              <Plus size={14} /> Create Framework
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {filtered.map((fw) => {
            const status = getFrameworkStatus(fw)
            const statusStyle = STATUS_STYLES[status]
            const catColor = getCategoryColor(fw.category)

            return (
              <div
                key={fw.id}
                className="glass-card"
                onClick={() => router.push(`/frameworks/${fw.id}`)}
                style={{
                  padding: '18px 20px',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, transform 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  el.style.borderColor = 'rgba(139,92,246,0.35)'
                  el.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  el.style.borderColor = 'rgba(255,255,255,0.08)'
                  el.style.transform = 'translateY(0)'
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: `${catColor}15`,
                    border: `1px solid ${catColor}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Shield size={16} style={{ color: catColor }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fw.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {fw.category && (
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: catColor, background: `${catColor}15`, padding: '1px 7px', borderRadius: 4, border: `1px solid ${catColor}25` }}>
                          {fw.category}
                        </span>
                      )}
                      {fw.version && (
                        <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>v{fw.version}</span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10.5, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 99,
                    background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`,
                    flexShrink: 0,
                  }}>
                    {statusStyle.label}
                  </span>
                </div>

                {/* Description */}
                {fw.description && (
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {fw.description}
                  </p>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-muted)' }}>
                    <BookOpen size={11} />
                    <span>{fw.controlCount ?? '—'} controls</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-muted)' }}>
                    <Clock size={11} />
                    <span>{new Date(fw.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {fw.isBuiltIn && (
                    <span style={{ fontSize: 10.5, color: 'var(--cyan)', background: 'rgba(6,182,212,0.10)', padding: '1px 7px', borderRadius: 4, border: '1px solid rgba(6,182,212,0.20)', marginLeft: 'auto' }}>
                      Built-in
                    </span>
                  )}
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)', marginLeft: fw.isBuiltIn ? 0 : 'auto' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateFrameworkModal
          onClose={() => setShowCreate(false)}
          onCreated={(fw) => {
            setShowCreate(false)
            router.push(`/frameworks/${fw.id}`)
          }}
        />
      )}
    </div>
  )
}
