'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Map, Plus, List, BarChart2, ChevronDown, ChevronUp, ChevronRight,
  Pencil, Trash2, X, Save, RefreshCw, AlertCircle, CheckCircle2,
  Calendar, Clock, Layers, BookOpen,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'overdue'

interface Phase {
  id: string
  timelineId: string
  title: string
  description: string | null
  startDate: string | null
  endDate: string | null
  status: PhaseStatus
  orderIndex: number | null
}

interface Timeline {
  id: string
  title: string
  description: string | null
  frameworkId: string | null
  isTemplate: boolean
  createdAt: string
  updatedAt: string
  phases: Phase[]
}

interface BuiltInTemplate {
  id: string
  title: string
  description: string
  frameworkSlug: string
  isBuiltIn: true
  phases: {
    title: string
    description: string
    durationMonths: number
    status: PhaseStatus
    orderIndex: number
  }[]
}

type ViewMode = 'gantt' | 'list'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PHASE_STATUS_STYLES: Record<PhaseStatus, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: 'Pending', color: '#94A3B8', bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)' },
  in_progress: { label: 'In Progress', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)' },
  completed: { label: 'Completed', color: '#10B981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
  overdue: { label: 'Overdue', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' },
}

const PHASE_BAR_COLORS: Record<PhaseStatus, string> = {
  pending: 'rgba(100,116,139,0.45)',
  in_progress: 'rgba(139,92,246,0.60)',
  completed: 'rgba(16,185,129,0.55)',
  overdue: 'rgba(239,68,68,0.55)',
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Gantt Chart ──────────────────────────────────────────────────────────────

function GanttChart({ timelines }: { timelines: Timeline[] }) {
  const today = new Date()

  // Determine overall date range across all timelines
  let minDate = today
  let maxDate = addMonths(today, 12)

  timelines.forEach((tl) => {
    tl.phases.forEach((p) => {
      if (p.startDate) {
        const d = new Date(p.startDate)
        if (d < minDate) minDate = d
      }
      if (p.endDate) {
        const d = new Date(p.endDate)
        if (d > maxDate) maxDate = d
      }
    })
  })

  // Snap to month boundaries
  minDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
  maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0)

  const totalMs = maxDate.getTime() - minDate.getTime()

  // Build month columns
  const months: { label: string; left: number; width: number }[] = []
  let cursor = new Date(minDate)
  while (cursor <= maxDate) {
    const start = cursor.getTime()
    const end = addMonths(cursor, 1).getTime()
    months.push({
      label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      left: ((start - minDate.getTime()) / totalMs) * 100,
      width: ((end - start) / totalMs) * 100,
    })
    cursor = addMonths(cursor, 1)
  }

  // Today marker
  const todayLeft = Math.max(0, Math.min(100, ((today.getTime() - minDate.getTime()) / totalMs) * 100))

  if (timelines.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No timelines to display. Create one to see the Gantt chart.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 700 }}>
        {/* Month headers */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', position: 'relative', height: 28, marginLeft: 180 }}>
          {months.map((m, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${m.left}%`,
                width: `${m.width}%`,
                height: '100%',
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center',
                fontSize: 10.5,
                color: 'var(--text-muted)',
                paddingLeft: 5,
                fontWeight: 500,
                letterSpacing: '0.04em',
                overflow: 'hidden',
              }}
            >
              {m.label}
            </div>
          ))}
        </div>

        {/* Rows */}
        {timelines.map((tl) => (
          <div key={tl.id}>
            {/* Timeline label row */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{
                width: 180, flexShrink: 0, padding: '8px 12px',
                fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {tl.title}
              </div>
              <div style={{ flex: 1, position: 'relative', height: 36 }}>
                {/* Grid lines */}
                {months.map((m, i) => (
                  <div key={i} style={{
                    position: 'absolute',
                    left: `${m.left}%`,
                    top: 0, bottom: 0,
                    borderLeft: '1px solid rgba(255,255,255,0.04)',
                    pointerEvents: 'none',
                  }} />
                ))}

                {/* Today marker */}
                <div style={{
                  position: 'absolute',
                  left: `${todayLeft}%`,
                  top: 0, bottom: 0,
                  width: 1,
                  background: 'rgba(239,68,68,0.5)',
                  zIndex: 2,
                }} />

                {/* Phase bars */}
                {tl.phases.filter((p) => p.startDate && p.endDate).map((p) => {
                  const s = new Date(p.startDate!).getTime()
                  const e = new Date(p.endDate!).getTime()
                  const left = Math.max(0, ((s - minDate.getTime()) / totalMs) * 100)
                  const width = Math.max(0.5, ((e - s) / totalMs) * 100)
                  const barColor = PHASE_BAR_COLORS[p.status as PhaseStatus] || PHASE_BAR_COLORS.pending
                  return (
                    <div
                      key={p.id}
                      title={`${p.title} — ${formatDate(p.startDate)} to ${formatDate(p.endDate)}`}
                      style={{
                        position: 'absolute',
                        left: `${left}%`,
                        width: `${width}%`,
                        top: 6, height: 24,
                        background: barColor,
                        borderRadius: 4,
                        border: `1px solid ${PHASE_BAR_COLORS[p.status as PhaseStatus].replace('0.60', '0.85').replace('0.55', '0.80').replace('0.45', '0.65')}`,
                        overflow: 'hidden',
                        display: 'flex', alignItems: 'center',
                        paddingLeft: 6,
                        cursor: 'default',
                        zIndex: 1,
                      }}
                    >
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.9 }}>
                        {p.title}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Today label */}
        <div style={{ position: 'relative', height: 18, marginLeft: 180, marginTop: 4 }}>
          <div style={{
            position: 'absolute',
            left: `${todayLeft}%`,
            transform: 'translateX(-50%)',
            fontSize: 10,
            color: 'rgba(239,68,68,0.7)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            Today
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Phase Form ───────────────────────────────────────────────────────────────

function PhaseModal({
  timelineId,
  phase,
  onClose,
  onSaved,
}: {
  timelineId: string
  phase?: Phase
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(phase?.title ?? '')
  const [description, setDescription] = useState(phase?.description ?? '')
  const [startDate, setStartDate] = useState(phase?.startDate ? phase.startDate.slice(0, 10) : '')
  const [endDate, setEndDate] = useState(phase?.endDate ? phase.endDate.slice(0, 10) : '')
  const [status, setStatus] = useState<PhaseStatus>(phase?.status ?? 'pending')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    setLoading(true)
    setError('')
    try {
      const url = phase
        ? `/api/timelines/${timelineId}/phases/${phase.id}`
        : `/api/timelines/${timelineId}/phases`
      const res = await fetch(url, {
        method: phase ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, startDate: startDate || null, endDate: endDate || null, status }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); return }
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
      <div className="glass-card animate-fade-in" style={{ width: 480, padding: 26, margin: 16 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {phase ? 'Edit Phase' : 'Add Phase'}
          </div>
          <button className="btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        {error && (
          <div style={{ padding: '7px 12px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, marginBottom: 12, fontSize: 12.5, color: '#EF4444', display: 'flex', gap: 6, alignItems: 'center' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Phase Title *</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Gap Assessment" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ width: '100%', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Start Date</label>
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>End Date</label>
              <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as PhaseStatus)} style={{ width: '100%' }}>
              {(['pending', 'in_progress', 'completed', 'overdue'] as PhaseStatus[]).map((s) => (
                <option key={s} value={s}>{PHASE_STATUS_STYLES[s].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={loading} style={{ fontSize: 13 }}>
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            {phase ? 'Save' : 'Add Phase'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Timeline Create Modal ────────────────────────────────────────────────────

function CreateTimelineModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/timelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); return }
      onCreated()
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
      <div className="glass-card animate-fade-in" style={{ width: 440, padding: 26, margin: 16 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>New Timeline</div>

        {error && (
          <div style={{ padding: '7px 12px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, marginBottom: 12, fontSize: 12.5, color: '#EF4444', display: 'flex', gap: 6, alignItems: 'center' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Title *</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., SOC 2 Readiness 2025" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ width: '100%', resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={loading} style={{ fontSize: 13 }}>
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
            Create Timeline
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Timeline Detail ──────────────────────────────────────────────────────────

function TimelineDetail({
  timeline,
  onUpdated,
  onDeleted,
}: {
  timeline: Timeline
  onUpdated: () => void
  onDeleted: () => void
}) {
  const [editTitle, setEditTitle] = useState(timeline.title)
  const [editDescription, setEditDescription] = useState(timeline.description ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPhaseModal, setShowPhaseModal] = useState(false)
  const [editingPhase, setEditingPhase] = useState<Phase | undefined>()

  const saveTimeline = async () => {
    setSaving(true)
    try {
      await fetch(`/api/timelines/${timeline.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, description: editDescription }),
      })
      setEditing(false)
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  const deletePhase = async (phase: Phase) => {
    if (!confirm(`Delete phase "${phase.title}"?`)) return
    await fetch(`/api/timelines/${timeline.id}/phases/${phase.id}`, { method: 'DELETE' })
    onUpdated()
  }

  const deleteTimeline = async () => {
    if (!confirm(`Delete timeline "${timeline.title}"?`)) return
    await fetch(`/api/timelines/${timeline.id}`, { method: 'DELETE' })
    onDeleted()
  }

  return (
    <div style={{ borderTop: '1px solid var(--border-glass)', padding: '16px 20px', background: 'rgba(255,255,255,0.02)' }}>
      {/* Edit header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {editing ? (
          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
            <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ flex: 1 }} />
            <input className="input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description..." style={{ flex: 2 }} />
            <button className="btn-primary" onClick={saveTimeline} disabled={saving} style={{ fontSize: 12, padding: '6px 12px' }}>
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />} Save
            </button>
            <button className="btn-ghost" onClick={() => setEditing(false)} style={{ fontSize: 12, padding: '6px 10px' }}><X size={12} /></button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-secondary)' }}>{timeline.description || 'No description'}</div>
            <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={() => setEditing(true)} title="Edit timeline"><Pencil size={12} /></button>
            <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={deleteTimeline} title="Delete timeline"><Trash2 size={12} /></button>
          </>
        )}
      </div>

      {/* Phases */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {timeline.phases.map((phase) => {
          const ss = PHASE_STATUS_STYLES[phase.status as PhaseStatus] || PHASE_STATUS_STYLES.pending
          return (
            <div key={phase.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ss.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{phase.title}</div>
                {phase.startDate && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatDate(phase.startDate)} → {formatDate(phase.endDate)}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, whiteSpace: 'nowrap' }}>
                {ss.label}
              </span>
              <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={() => { setEditingPhase(phase); setShowPhaseModal(true) }}><Pencil size={11} /></button>
              <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={() => deletePhase(phase)}><Trash2 size={11} /></button>
            </div>
          )
        })}
        <button
          onClick={() => { setEditingPhase(undefined); setShowPhaseModal(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'none', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12.5 }}
        >
          <Plus size={12} /> Add Phase
        </button>
      </div>

      {showPhaseModal && (
        <PhaseModal
          timelineId={timeline.id}
          phase={editingPhase}
          onClose={() => { setShowPhaseModal(false); setEditingPhase(undefined) }}
          onSaved={() => { setShowPhaseModal(false); setEditingPhase(undefined); onUpdated() }}
        />
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const [timelines, setTimelines] = useState<Timeline[]>([])
  const [templates, setTemplates] = useState<BuiltInTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('gantt')
  const [showCreate, setShowCreate] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [creatingFromTemplate, setCreatingFromTemplate] = useState<string | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    try {
      const [tlRes, tmplRes] = await Promise.all([
        fetch('/api/timelines'),
        fetch('/api/timelines/templates'),
      ])
      if (tlRes.ok) {
        const data = await tlRes.json()
        setTimelines(data.timelines || [])
      }
      if (tmplRes.ok) {
        const data = await tmplRes.json()
        setTemplates(data.builtIn || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const useTemplate = async (template: BuiltInTemplate) => {
    setCreatingFromTemplate(template.id)
    const today = new Date()
    const phases = template.phases.map((p) => {
      // Calculate cumulative offset
      const monthOffset = template.phases.slice(0, p.orderIndex).reduce((sum, prev) => sum + prev.durationMonths, 0)
      const start = addMonths(today, monthOffset)
      const end = addMonths(start, p.durationMonths)
      return {
        title: p.title,
        description: p.description,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        status: 'pending' as PhaseStatus,
        orderIndex: p.orderIndex,
      }
    })

    try {
      const res = await fetch('/api/timelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template.title,
          description: template.description,
          phases,
        }),
      })
      if (res.ok) {
        showToast('success', `Created "${template.title}" from template`)
        load()
      } else {
        showToast('error', 'Failed to create from template')
      }
    } catch {
      showToast('error', 'Network error')
    } finally {
      setCreatingFromTemplate(null)
    }
  }

  const TEMPLATE_ICONS: Record<string, string> = {
    'builtin-soc2': '#8B5CF6',
    'builtin-iso27001': '#06B6D4',
    'builtin-hipaa': '#10B981',
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>

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

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Compliance Roadmap
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            Plan and track compliance initiatives with Gantt timelines and milestones
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border-glass)', borderRadius: 8, overflow: 'hidden' }}>
            {[
              { mode: 'gantt' as ViewMode, icon: <BarChart2 size={13} />, label: 'Gantt' },
              { mode: 'list' as ViewMode, icon: <List size={13} />, label: 'List' },
            ].map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px', fontSize: 12.5,
                  background: viewMode === mode ? 'rgba(139,92,246,0.15)' : 'none',
                  color: viewMode === mode ? 'var(--violet)' : 'var(--text-muted)',
                  border: 'none', cursor: 'pointer',
                }}
              >
                {icon} {label}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ fontSize: 13 }}>
            <Plus size={14} /> New Timeline
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Timelines', value: timelines.length, color: 'var(--text-primary)', icon: <Map size={14} /> },
          {
            label: 'In Progress', icon: <Clock size={14} />,
            value: timelines.reduce((n, tl) => n + tl.phases.filter((p) => p.status === 'in_progress').length, 0),
            color: '#8B5CF6',
          },
          {
            label: 'Completed', icon: <CheckCircle2 size={14} />,
            value: timelines.reduce((n, tl) => n + tl.phases.filter((p) => p.status === 'completed').length, 0),
            color: '#10B981',
          },
          {
            label: 'Overdue', icon: <AlertCircle size={14} />,
            value: timelines.reduce((n, tl) => n + tl.phases.filter((p) => p.status === 'overdue').length, 0),
            color: '#EF4444',
          },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Gantt / List */}
      {loading ? (
        <div className="glass-card" style={{ height: 200, animation: 'pulse 1.5s infinite' }} />
      ) : viewMode === 'gantt' ? (
        <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
            <BarChart2 size={13} style={{ color: 'var(--violet)' }} /> Gantt Chart
          </div>
          <GanttChart timelines={timelines} />
        </div>
      ) : null}

      {/* List view */}
      <div style={{ marginBottom: 24 }}>
        {viewMode === 'list' && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
            <List size={13} style={{ color: 'var(--violet)' }} /> All Timelines
          </div>
        )}

        {!loading && timelines.length === 0 ? (
          <div className="glass-card" style={{ padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, background: 'var(--violet-dim)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Map size={20} style={{ color: 'var(--violet)' }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No timelines yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Create a timeline or start from a template below</div>
            <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ fontSize: 13 }}>
              <Plus size={13} /> New Timeline
            </button>
          </div>
        ) : (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            {timelines.map((tl, i) => {
              const expanded = expandedIds.has(tl.id)
              const phaseCount = tl.phases.length
              const completedCount = tl.phases.filter((p) => p.status === 'completed').length
              const inProgressCount = tl.phases.filter((p) => p.status === 'in_progress').length
              const overdueCount = tl.phases.filter((p) => p.status === 'overdue').length

              return (
                <div key={tl.id} style={{ borderBottom: i < timelines.length - 1 ? '1px solid var(--border-glass)' : 'none' }}>
                  <div
                    style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                    onClick={() => toggleExpand(tl.id)}
                  >
                    <div style={{ width: 36, height: 36, background: 'var(--violet-dim)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Layers size={15} style={{ color: 'var(--violet)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{tl.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {phaseCount} phase{phaseCount !== 1 ? 's' : ''}
                        </span>
                        {completedCount > 0 && (
                          <span style={{ fontSize: 11, color: '#10B981', background: 'rgba(16,185,129,0.10)', padding: '1px 7px', borderRadius: 4 }}>
                            {completedCount} done
                          </span>
                        )}
                        {inProgressCount > 0 && (
                          <span style={{ fontSize: 11, color: '#8B5CF6', background: 'rgba(139,92,246,0.10)', padding: '1px 7px', borderRadius: 4 }}>
                            {inProgressCount} active
                          </span>
                        )}
                        {overdueCount > 0 && (
                          <span style={{ fontSize: 11, color: '#EF4444', background: 'rgba(239,68,68,0.10)', padding: '1px 7px', borderRadius: 4 }}>
                            {overdueCount} overdue
                          </span>
                        )}
                        {phaseCount > 0 && (
                          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <div style={{ width: 60, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                              <div style={{ width: `${(completedCount / phaseCount) * 100}%`, height: '100%', background: '#10B981', borderRadius: 2, transition: 'width 0.3s' }} />
                            </div>
                            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{Math.round((completedCount / phaseCount) * 100)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {new Date(tl.createdAt).toLocaleDateString()}
                    </div>
                    {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                  </div>

                  {expanded && (
                    <TimelineDetail
                      timeline={tl}
                      onUpdated={load}
                      onDeleted={load}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Templates section */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 6 }}>
          Templates
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Start from a pre-built compliance journey template. Phases are offset from today.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {templates.map((tmpl) => {
            const accentColor = TEMPLATE_ICONS[tmpl.id] || '#8B5CF6'
            const totalMonths = tmpl.phases.reduce((s, p) => s + p.durationMonths, 0)
            return (
              <div key={tmpl.id} className="glass-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, background: `${accentColor}15`, border: `1px solid ${accentColor}30`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BookOpen size={16} style={{ color: accentColor }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{tmpl.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {tmpl.phases.length} phases · {totalMonths} months
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>{tmpl.description}</p>

                {/* Phase list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                  {tmpl.phases.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      <ChevronRight size={10} style={{ color: accentColor, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{p.title}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10.5, flexShrink: 0 }}>{p.durationMonths}mo</span>
                    </div>
                  ))}
                </div>

                <button
                  className="btn-primary"
                  onClick={() => useTemplate(tmpl)}
                  disabled={creatingFromTemplate === tmpl.id}
                  style={{ fontSize: 12.5, width: '100%', justifyContent: 'center' }}
                >
                  {creatingFromTemplate === tmpl.id ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Plus size={12} />
                  )}
                  Use Template
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateTimelineModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); showToast('success', 'Timeline created') }}
        />
      )}
    </div>
  )
}
