'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, ArrowLeft, Save, Globe, Archive, RotateCcw,
  Plus, Pencil, Trash2, Search, RefreshCw, Download,
  BookOpen, GitBranch, AlertCircle, CheckCircle2, ChevronDown,
  X, Link2, Clock,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VersionSnapshot {
  version: string
  publishedAt: string
  snapshot: string
}

interface FrameworkMeta {
  versions?: VersionSnapshot[]
  status?: string
  [key: string]: unknown
}

interface Framework {
  id: string
  name: string
  shortName: string | null
  version: string | null
  description: string | null
  category: string | null
  regulatoryBody: string | null
  isBuiltIn: boolean
  isActive: boolean
  metadata: FrameworkMeta | null
  updatedAt: string
  controlCount?: number
}

interface Control {
  id: string
  frameworkId: string
  controlId: string | null
  title: string
  description: string | null
  category: string | null
  subcategory: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

interface ControlMapping {
  id: string
  sourceControlId: string
  targetControlId: string
  mappingRationale: string | null
  confidence: number | null
  mappedByAi: boolean | null
  mappingType: string | null
  source: string | null
  canonicalNistId: string | null
}

type Tab = 'overview' | 'controls' | 'mappings' | 'export'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatus(fw: Framework): 'published' | 'draft' | 'archived' {
  if (!fw.isActive) return 'archived'
  if (fw.isBuiltIn) return 'published'
  const meta = fw.metadata
  if (meta?.status === 'published') return 'published'
  if (meta?.status === 'archived') return 'archived'
  return 'draft'
}

const STATUS_STYLES = {
  published: { label: 'Published', bg: 'rgba(16,185,129,0.12)', color: '#10B981', border: 'rgba(16,185,129,0.25)' },
  draft: { label: 'Draft', bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.25)' },
  archived: { label: 'Archived', bg: 'rgba(100,116,139,0.12)', color: '#94A3B8', border: 'rgba(100,116,139,0.25)' },
}

// ─── Control Edit Modal ────────────────────────────────────────────────────────

interface ControlModalProps {
  frameworkId: string
  control?: Control
  onClose: () => void
  onSaved: () => void
}

function ControlModal({ frameworkId, control, onClose, onSaved }: ControlModalProps) {
  const [controlId, setControlId] = useState(control?.controlId ?? '')
  const [title, setTitle] = useState(control?.title ?? '')
  const [description, setDescription] = useState(control?.description ?? '')
  const [category, setCategory] = useState(control?.category ?? '')
  const [subcategory, setSubcategory] = useState(control?.subcategory ?? '')
  const [notes, setNotes] = useState((control?.metadata?.notes as string) ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    setLoading(true)
    setError('')
    try {
      const url = control
        ? `/api/frameworks/${frameworkId}/controls/${control.id}`
        : `/api/frameworks/${frameworkId}/controls`
      const res = await fetch(url, {
        method: control ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ controlId: controlId || undefined, title, description, category, subcategory, notes }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save'); return }
      onSaved()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        className="glass-card animate-fade-in"
        style={{ width: 520, padding: 28, margin: 16, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              {control ? 'Edit Control' : 'Add Control'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {control ? `Editing ${control.controlId ?? control.id}` : 'Add a new control to this framework'}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, marginBottom: 14, fontSize: 12.5, color: '#EF4444', display: 'flex', gap: 6, alignItems: 'center' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Control ID</label>
              <input className="input" value={controlId} onChange={(e) => setControlId(e.target.value)} placeholder="e.g., CC6.1" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Title *</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Control title" style={{ width: '100%' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Description</label>
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Control description..." rows={3} style={{ width: '100%', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Category</label>
              <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Access Control" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Family</label>
              <input className="input" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="e.g., Identity" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Notes</label>
            <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} style={{ width: '100%', resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={loading} style={{ fontSize: 13 }}>
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            {control ? 'Save Changes' : 'Add Control'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Version Picker Modal ─────────────────────────────────────────────────────

function VersionPickerModal({
  versions,
  onClose,
  onSelect,
}: {
  versions: VersionSnapshot[]
  onClose: () => void
  onSelect: (v: string) => void
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div className="glass-card animate-fade-in" style={{ width: 440, padding: 24, margin: 16 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Select Version to Restore
        </div>
        {versions.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No published versions yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...versions].reverse().map((v) => (
              <button
                key={v.version}
                onClick={() => onSelect(v.version)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                  cursor: 'pointer', transition: 'border-color 0.15s',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Version {v.version}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Published {new Date(v.publishedAt).toLocaleDateString()}
                  </div>
                </div>
                <RotateCcw size={14} style={{ color: 'var(--violet)' }} />
              </button>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FrameworkEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [fw, setFw] = useState<Framework | null>(null)
  const [controls, setControls] = useState<Control[]>([])
  const [mappings, setMappings] = useState<ControlMapping[]>([])
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [controlSearch, setControlSearch] = useState('')
  const [showControlModal, setShowControlModal] = useState(false)
  const [editingControl, setEditingControl] = useState<Control | undefined>()
  const [showVersionPicker, setShowVersionPicker] = useState(false)

  // Overview edit state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editVersion, setEditVersion] = useState('')
  const [editCategory, setEditCategory] = useState('')

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const loadFramework = useCallback(async () => {
    try {
      const res = await fetch(`/api/frameworks/${id}`)
      if (!res.ok) { router.push('/frameworks'); return }
      const data = await res.json()
      setFw(data.framework)
      setEditName(data.framework.name || '')
      setEditDescription(data.framework.description || '')
      setEditVersion(data.framework.version || '')
      setEditCategory(data.framework.category || '')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  const loadControls = useCallback(async (q?: string) => {
    const url = q ? `/api/frameworks/${id}/controls?search=${encodeURIComponent(q)}` : `/api/frameworks/${id}/controls`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setControls(data.controls || [])
    }
  }, [id])

  useEffect(() => { loadFramework() }, [loadFramework])
  useEffect(() => { if (tab === 'controls') loadControls() }, [tab, loadControls])

  const saveOverview = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/frameworks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDescription, version: editVersion, category: editCategory }),
      })
      if (res.ok) {
        const data = await res.json()
        setFw(data.framework)
        showToast('success', 'Framework saved')
      } else {
        const data = await res.json()
        showToast('error', data.error || 'Save failed')
      }
    } catch {
      showToast('error', 'Network error')
    } finally {
      setSaving(false)
    }
  }

  const publishFramework = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/frameworks/${id}/publish`, { method: 'POST' })
      if (res.ok) {
        showToast('success', 'Framework published')
        loadFramework()
      } else {
        const data = await res.json()
        showToast('error', data.error || 'Publish failed')
      }
    } finally {
      setSaving(false)
    }
  }

  const archiveFramework = async () => {
    if (!confirm('Archive this framework? It will be hidden from the main list.')) return
    try {
      const res = await fetch(`/api/frameworks/${id}`, { method: 'DELETE' })
      if (res.ok) { router.push('/frameworks') }
      else showToast('error', 'Archive failed')
    } catch {
      showToast('error', 'Network error')
    }
  }

  const rollbackToVersion = async (version: string) => {
    setShowVersionPicker(false)
    try {
      const res = await fetch(`/api/frameworks/${id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      })
      if (res.ok) {
        showToast('success', `Rolled back to v${version}`)
        loadFramework()
      } else {
        const data = await res.json()
        showToast('error', data.error || 'Rollback failed')
      }
    } catch {
      showToast('error', 'Network error')
    }
  }

  const deleteControl = async (ctrl: Control) => {
    if (!confirm(`Delete control "${ctrl.title}"?`)) return
    try {
      const res = await fetch(`/api/frameworks/${id}/controls/${ctrl.id}`, { method: 'DELETE' })
      if (res.ok) { loadControls(); showToast('success', 'Control deleted') }
      else showToast('error', 'Delete failed')
    } catch {
      showToast('error', 'Network error')
    }
  }

  const exportJSON = () => {
    const data = { framework: fw, controls }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${fw?.name ?? 'framework'}-export.json`
    a.click(); URL.revokeObjectURL(url)
  }

  const exportCSV = () => {
    const rows = [
      ['Control ID', 'Title', 'Description', 'Category', 'Family'],
      ...controls.map((c) => [c.controlId ?? '', c.title, c.description ?? '', c.category ?? '', c.subcategory ?? '']),
    ]
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${fw?.name ?? 'framework'}-controls.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <RefreshCw size={20} style={{ color: 'var(--violet)', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (!fw) return null

  const status = getStatus(fw)
  const statusStyle = STATUS_STYLES[status]
  const versions: VersionSnapshot[] = fw.metadata?.versions ?? []

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Shield size={13} /> },
    { key: 'controls', label: `Controls${controls.length ? ` (${controls.length})` : ''}`, icon: <BookOpen size={13} /> },
    { key: 'mappings', label: 'Mappings', icon: <GitBranch size={13} /> },
    { key: 'export', label: 'Export', icon: <Download size={13} /> },
  ]

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 200,
          padding: '10px 16px', borderRadius: 10,
          background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
          color: toast.type === 'success' ? '#10B981' : '#EF4444',
          fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'fade-in 0.2s ease',
        }}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Back + header */}
      <div style={{ marginBottom: 20 }}>
        <button
          className="btn-ghost"
          onClick={() => router.push('/frameworks')}
          style={{ fontSize: 12.5, marginBottom: 14, padding: '6px 10px' }}
        >
          <ArrowLeft size={13} /> Back to Frameworks
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {fw.name}
              </h1>
              <span style={{
                fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 99,
                background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`,
              }}>
                {statusStyle.label}
              </span>
              {fw.version && (
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>v{fw.version}</span>
              )}
            </div>
            {fw.description && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>{fw.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {status === 'draft' && (
              <button className="btn-primary" onClick={publishFramework} disabled={saving} style={{ fontSize: 13 }}>
                <Globe size={13} /> Publish
              </button>
            )}
            {status !== 'archived' && !fw.isBuiltIn && (
              <button className="btn-ghost" onClick={archiveFramework} style={{ fontSize: 13 }}>
                <Archive size={13} /> Archive
              </button>
            )}
            {versions.length > 0 && (
              <button className="btn-ghost" onClick={() => setShowVersionPicker(true)} style={{ fontSize: 13 }}>
                <RotateCcw size={13} /> Rollback
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border-glass)', marginBottom: 24 }}>
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', fontSize: 13, fontWeight: 500,
              color: tab === key ? 'var(--violet)' : 'var(--text-muted)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${tab === key ? 'var(--violet)' : 'transparent'}`,
              marginBottom: -1, transition: 'color 0.15s',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ────────────────────────────────── */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 18 }}>Framework Details</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Name</label>
                <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%' }} disabled={fw.isBuiltIn} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Description</label>
                <textarea className="input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} style={{ width: '100%', resize: 'vertical' }} disabled={fw.isBuiltIn} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Version</label>
                  <input className="input" value={editVersion} onChange={(e) => setEditVersion(e.target.value)} placeholder="1.0" disabled={fw.isBuiltIn} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Category</label>
                  <select className="input" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} disabled={fw.isBuiltIn} style={{ width: '100%' }}>
                    {['SOC2', 'ISO', 'HIPAA', 'NIST', 'PCI', 'Custom', ''].map((c) => (
                      <option key={c} value={c}>{c || '—'}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {!fw.isBuiltIn && (
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-primary" onClick={saveOverview} disabled={saving} style={{ fontSize: 13 }}>
                  {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  Save Changes
                </button>
              </div>
            )}
          </div>

          {/* Right: Version history */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Clock size={13} style={{ color: 'var(--violet)' }} /> Version History
            </div>
            {versions.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                No published versions yet.<br />
                <span style={{ fontSize: 12 }}>Publish to create a snapshot.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...versions].reverse().map((v, i) => (
                  <div key={v.version} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>v{v.version}</span>
                      {i === 0 && (
                        <span style={{ fontSize: 10, color: '#10B981', background: 'rgba(16,185,129,0.10)', padding: '1px 6px', borderRadius: 4 }}>Latest</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {new Date(v.publishedAt).toLocaleDateString()} {new Date(v.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Controls tab ────────────────────────────────── */}
      {tab === 'controls' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                className="input"
                value={controlSearch}
                onChange={(e) => {
                  setControlSearch(e.target.value)
                  loadControls(e.target.value)
                }}
                placeholder="Search controls..."
                style={{ paddingLeft: 30, width: '100%' }}
              />
            </div>
            <a href="/frameworks/upload" className="btn-ghost" style={{ fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Link2 size={13} /> Bulk Import
            </a>
            <button className="btn-primary" onClick={() => { setEditingControl(undefined); setShowControlModal(true) }} style={{ fontSize: 13 }}>
              <Plus size={13} /> Add Control
            </button>
          </div>

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            {controls.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <BookOpen size={24} style={{ color: 'var(--violet)', marginBottom: 12, opacity: 0.5 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No controls yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Add controls manually or import from XLSX</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Control ID', 'Title', 'Category', 'Family', 'Actions'].map((h) => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {controls.map((ctrl) => (
                      <tr key={ctrl.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        <td style={{ padding: '9px 14px' }}>
                          {ctrl.controlId ? (
                            <code style={{ fontSize: 11.5, color: 'var(--cyan)', background: 'rgba(6,182,212,0.10)', padding: '1px 6px', borderRadius: 3 }}>{ctrl.controlId}</code>
                          ) : (
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '9px 14px', fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 300 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctrl.title}</div>
                          {ctrl.description && (
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{ctrl.description}</div>
                          )}
                        </td>
                        <td style={{ padding: '9px 14px', fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ctrl.category || '—'}</td>
                        <td style={{ padding: '9px 14px', fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ctrl.subcategory || '—'}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="btn-icon"
                              style={{ width: 28, height: 28 }}
                              onClick={() => { setEditingControl(ctrl); setShowControlModal(true) }}
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              className="btn-icon"
                              style={{ width: 28, height: 28 }}
                              onClick={() => deleteControl(ctrl)}
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Mappings tab ────────────────────────────────── */}
      {tab === 'mappings' && (
        <div>
          <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>NIST 800-53 Crosswalk</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Cross-reference between this framework&apos;s controls and their NIST 800-53 canonical anchors.
              Mappings are generated by the AI mapping engine and can be manually overridden.
            </div>
          </div>

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            {controls.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <GitBranch size={24} style={{ color: 'var(--violet)', marginBottom: 12, opacity: 0.5 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No controls to map</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Add controls first, then view their NIST mappings here</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Control ID', 'Title', 'Mapped NIST IDs', 'Source', 'Confidence'].map((h) => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {controls.map((ctrl) => {
                      const ctrlMappings = mappings.filter((m) => m.sourceControlId === ctrl.id)
                      return (
                        <tr key={ctrl.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                          <td style={{ padding: '9px 14px' }}>
                            <code style={{ fontSize: 11.5, color: 'var(--cyan)', background: 'rgba(6,182,212,0.10)', padding: '1px 6px', borderRadius: 3 }}>
                              {ctrl.controlId || '—'}
                            </code>
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 220 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctrl.title}</div>
                          </td>
                          <td style={{ padding: '9px 14px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {ctrlMappings.length > 0 ? ctrlMappings.map((m) => (
                                <span key={m.id} style={{ fontSize: 11, fontWeight: 600, color: 'var(--violet)', background: 'var(--violet-dim)', padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(139,92,246,0.20)' }}>
                                  {m.canonicalNistId || 'N/A'}
                                </span>
                              )) : (
                                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.20)' }}>Not mapped</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: 11.5, color: 'var(--text-muted)' }}>
                            {ctrlMappings[0]?.source ? (
                              <span style={{ textTransform: 'capitalize' }}>{ctrlMappings[0].source.replace('_', ' ')}</span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '9px 14px' }}>
                            {ctrlMappings[0]?.confidence != null ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 50, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                                  <div style={{ width: `${ctrlMappings[0].confidence}%`, height: '100%', background: ctrlMappings[0].confidence >= 80 ? '#10B981' : ctrlMappings[0].confidence >= 50 ? '#F59E0B' : '#EF4444', borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{ctrlMappings[0].confidence}%</span>
                              </div>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Export tab ──────────────────────────────────── */}
      {tab === 'export' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              {
                title: 'Export as JSON',
                desc: 'Framework metadata + all controls with NIST mapping data. Useful for integration with other tools.',
                icon: <Download size={20} style={{ color: 'var(--violet)' }} />,
                badge: 'JSON',
                badgeColor: 'var(--violet)',
                onClick: exportJSON,
              },
              {
                title: 'Export as CSV',
                desc: 'Controls table as CSV spreadsheet. Includes Control ID, Title, Description, Category, Family.',
                icon: <Download size={20} style={{ color: 'var(--cyan)' }} />,
                badge: 'CSV',
                badgeColor: 'var(--cyan)',
                onClick: exportCSV,
              },
            ].map(({ title, desc, icon, badge, badgeColor, onClick }) => (
              <div key={title} className="glass-card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: badgeColor, background: `${badgeColor}15`, padding: '1px 7px', borderRadius: 4 }}>{badge}</span>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 18 }}>{desc}</p>
                <button className="btn-primary" onClick={onClick} style={{ fontSize: 13, width: '100%', justifyContent: 'center' }}>
                  <Download size={13} /> Download {badge}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showControlModal && (
        <ControlModal
          frameworkId={id}
          control={editingControl}
          onClose={() => { setShowControlModal(false); setEditingControl(undefined) }}
          onSaved={() => { setShowControlModal(false); setEditingControl(undefined); loadControls() }}
        />
      )}

      {showVersionPicker && (
        <VersionPickerModal
          versions={versions}
          onClose={() => setShowVersionPicker(false)}
          onSelect={rollbackToVersion}
        />
      )}
    </div>
  )
}
