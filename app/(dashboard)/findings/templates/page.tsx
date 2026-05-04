'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Shield, Plus, Search, BookOpen, Zap, RefreshCw,
  AlertTriangle, CheckCircle2, Loader2, X, AlertCircle,
} from 'lucide-react'
import { FindingModal } from '@/components/findings/finding-modal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FindingTemplate {
  id: string
  title: string
  description: string | null
  severity: string
  source: string
  remediationGuidance: string | null
  isBuiltIn: boolean
  organizationId: string | null
  createdAt?: string
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const SEVERITY_META: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#EF4444' },
  high:     { label: 'High',     color: '#F97316' },
  medium:   { label: 'Medium',   color: '#EAB308' },
  low:      { label: 'Low',      color: '#3B82F6' },
  info:     { label: 'Info',     color: '#94A3B8' },
}

const SOURCE_META: Record<string, { label: string; color: string }> = {
  aws:         { label: 'AWS',         color: '#F97316' },
  azure:       { label: 'Azure',       color: '#3B82F6' },
  gcp:         { label: 'GCP',         color: '#10B981' },
  github:      { label: 'GitHub',      color: '#94A3B8' },
  pentest:     { label: 'Pentest',     color: '#EF4444' },
  manual:      { label: 'Manual',      color: '#8B5CF6' },
  nl_test:     { label: 'NL Test',     color: '#06B6D4' },
  integration: { label: 'Integration', color: '#EAB308' },
}

function SeverityBadge({ severity }: { severity: string }) {
  const meta = SEVERITY_META[severity] ?? { label: severity, color: '#94A3B8' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20,
      background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
      color: meta.color, fontSize: 11, fontWeight: 700,
    }}>
      {meta.label}
    </span>
  )
}

// ── Create Template Modal ─────────────────────────────────────────────────────

interface CreateTemplateModalProps {
  onClose: () => void
  onSuccess: () => void
}

function CreateTemplateModal({ onClose, onSuccess }: CreateTemplateModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [source, setSource] = useState('manual')
  const [remediationGuidance, setRemediationGuidance] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/findings/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, severity, source, remediationGuidance }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create template'); return }
      onSuccess()
      onClose()
    } catch {
      setError('Network error.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#0D1120', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={15} color="#8B5CF6" />
            </div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#F1F5F9' }}>Create Finding Template</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex' }}><X size={17} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Template name" style={inputStyle} disabled={submitting} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Finding description..." rows={2} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} disabled={submitting} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={inputStyle} disabled={submitting}>
                {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Source</label>
              <select value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle} disabled={submitting}>
                {Object.entries(SOURCE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Remediation Guidance</label>
            <textarea value={remediationGuidance} onChange={(e) => setRemediationGuidance(e.target.value)} placeholder="How to remediate this finding..." rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} disabled={submitting} />
          </div>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', fontSize: 13 }}>
              <AlertCircle size={13} />{error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {submitting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />}
              {submitting ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FindingTemplatesPage() {
  const [templates, setTemplates] = useState<FindingTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // For "Use Template" → pre-fill finding modal
  const [showFindingModal, setShowFindingModal] = useState(false)
  const [templatePrefill, setTemplatePrefill] = useState<Partial<{
    title: string
    description: string
    severity: string
    source: string
    remediationGuidance: string
  }> | null>(null)

  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/findings/templates')
      if (!res.ok) return
      const data = await res.json()
      setTemplates(Array.isArray(data.templates) ? data.templates : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  function useTemplate(t: FindingTemplate) {
    setTemplatePrefill({
      title: t.title,
      description: t.description ?? '',
      severity: t.severity,
      source: t.source,
      remediationGuidance: t.remediationGuidance ?? '',
    })
    setShowFindingModal(true)
  }

  const filtered = templates.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return t.title.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q) ?? false)
  })

  const builtIns = filtered.filter((t) => t.isBuiltIn)
  const custom = filtered.filter((t) => !t.isBuiltIn)

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <a href="/findings" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              ← Findings
            </a>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
            Finding Templates
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
            Built-in and custom templates for common security findings
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
            border: 'none', color: '#fff', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Create Template
        </button>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={15} color="#8B5CF6" />
          <span style={{ fontSize: 13, color: '#F1F5F9' }}><strong>{builtIns.length}</strong> <span style={{ color: 'rgba(255,255,255,0.4)' }}>built-in templates</span></span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={15} color="#06B6D4" />
          <span style={{ fontSize: 13, color: '#F1F5F9' }}><strong>{custom.length}</strong> <span style={{ color: 'rgba(255,255,255,0.4)' }}>custom templates</span></span>
        </div>
      </div>

      {/* Search */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Search size={14} color="rgba(255,255,255,0.3)" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          style={{ background: 'none', border: 'none', outline: 'none', flex: 1, color: '#F1F5F9', fontSize: 13 }}
        />
        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex' }}><X size={14} /></button>}
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: 8 }} />
          <div>Loading templates...</div>
        </div>
      ) : (
        <>
          {/* Built-in templates */}
          {builtIns.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Shield size={15} color="#8B5CF6" />
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#F1F5F9' }}>Built-in Templates</h2>
                <span style={{ fontSize: 11, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 10, padding: '1px 7px', color: '#A78BFA' }}>{builtIns.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {builtIns.map((t) => (
                  <TemplateCard key={t.id} template={t} onUse={() => useTemplate(t)} />
                ))}
              </div>
            </div>
          )}

          {/* Custom templates */}
          {custom.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <BookOpen size={15} color="#06B6D4" />
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#F1F5F9' }}>Custom Templates</h2>
                <span style={{ fontSize: 11, background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: 10, padding: '1px 7px', color: '#67E8F9' }}>{custom.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {custom.map((t) => (
                  <TemplateCard key={t.id} template={t} onUse={() => useTemplate(t)} />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <BookOpen size={22} color="#8B5CF6" />
              </div>
              <div style={{ color: '#F1F5F9', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No templates found</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                {search ? 'Try a different search term' : 'Create your first custom template'}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateTemplateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { loadTemplates(); showToast('Template created') }}
        />
      )}

      {showFindingModal && templatePrefill && (
        <FindingModal
          prefill={templatePrefill}
          onClose={() => { setShowFindingModal(false); setTemplatePrefill(null) }}
          onSuccess={() => { setShowFindingModal(false); setTemplatePrefill(null); showToast('Finding created from template') }}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: '#1A1F35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#F1F5F9', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'fadeIn 0.2s ease' }}>
          {toastMsg}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

function TemplateCard({ template, onUse }: { template: FindingTemplate; onUse: () => void }) {
  const meta = SEVERITY_META[template.severity] ?? { color: '#94A3B8' }
  const srcMeta = SOURCE_META[template.source] ?? { label: template.source, color: '#94A3B8' }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)`,
      borderRadius: 12, padding: 16, backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color 0.2s',
      borderLeft: `3px solid ${meta.color}60`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 4 }}>{template.title}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <SeverityBadge severity={template.severity} />
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: `${srcMeta.color}14`, border: `1px solid ${srcMeta.color}30`, color: srcMeta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{srcMeta.label}</span>
            {template.isBuiltIn && (
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#A78BFA', fontWeight: 600 }}>Built-in</span>
            )}
          </div>
        </div>
      </div>

      {template.description && (
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {template.description}
        </p>
      )}

      {template.remediationGuidance && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Remediation</div>
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {template.remediationGuidance}
          </p>
        </div>
      )}

      <button
        onClick={onUse}
        style={{
          marginTop: 4, padding: '8px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
          background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
          color: '#A78BFA', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)' }}
      >
        <Zap size={12} /> Use Template
      </button>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600,
  color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '8px 11px', fontSize: 13, color: '#F1F5F9',
  outline: 'none',
}
