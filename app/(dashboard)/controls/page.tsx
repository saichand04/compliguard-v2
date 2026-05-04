'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckSquare, Search, ChevronRight, Link2, Shield,
  BookOpen, ExternalLink, Filter, Tag, Zap, GitBranch, RefreshCw,
  AlertTriangle, Clock, CheckCircle2, XCircle, Circle,
} from 'lucide-react'
import { CommentsPanel } from '@/components/comments/comments-panel'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Framework {
  id: string
  name: string
  shortName: string | null
  slug: string | null
}

interface Control {
  id: string
  controlId: string | null
  title: string
  description: string | null
  category: string | null
  frameworkId: string
  assignment?: {
    status: string
    assignedTo: string | null
  } | null
  mappingCount?: number
}

interface MappingTarget {
  id: string
  controlId: string | null
  title: string
  frameworkId: string
  frameworkName: string
  frameworkShortName: string | null
  mappingType: string | null
  confidence: number | null
}

type StatusFilter = 'all' | 'implemented' | 'in_progress' | 'not_started' | 'needs_review'

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  implemented:  { label: 'Implemented',  color: 'var(--emerald)', Icon: CheckCircle2 },
  in_progress:  { label: 'In Progress',  color: 'var(--amber)',   Icon: Clock },
  not_started:  { label: 'Not Started',  color: 'var(--text-muted)', Icon: Circle },
  needs_review: { label: 'Needs Review', color: 'var(--rose)',    Icon: AlertTriangle },
  not_applicable: { label: 'N/A',        color: 'var(--text-muted)', Icon: XCircle },
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.not_started
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
      color: meta.color, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <meta.Icon size={10} />
      {meta.label}
    </span>
  )
}

// ── Confidence bar ─────────────────────────────────────────────────────────────

function ConfBar({ value }: { value: number }) {
  const color = value >= 80 ? 'var(--emerald)' : value >= 60 ? 'var(--amber)' : 'var(--rose)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600, minWidth: 28 }}>{value}%</span>
    </div>
  )
}

const MAPPING_TYPE_COLORS: Record<string, string> = {
  direct: 'var(--emerald)', partial: 'var(--amber)', related: 'var(--cyan)', inferred: 'var(--violet)',
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ControlsPage() {
  const [frameworks, setFrameworks]             = useState<Framework[]>([])
  const [selectedFwId, setSelectedFwId]         = useState<string | null>(null)
  const [controls, setControls]                 = useState<Control[]>([])
  const [selectedControl, setSelectedControl]   = useState<Control | null>(null)
  const [mappings, setMappings]                 = useState<MappingTarget[]>([])
  const [search, setSearch]                     = useState('')
  const [statusFilter, setStatusFilter]         = useState<StatusFilter>('all')
  const [loadingFw, setLoadingFw]               = useState(true)
  const [loadingCtrl, setLoadingCtrl]           = useState(false)
  const [loadingMap, setLoadingMap]             = useState(false)
  const [updating, setUpdating]                 = useState(false)

  // ── Load frameworks on mount ───────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/frameworks')
      .then((r) => r.json())
      .then((data) => {
        const list: Framework[] = Array.isArray(data.frameworks) ? data.frameworks : []
        setFrameworks(list)
        if (list.length > 0) setSelectedFwId(list[0].id)
      })
      .catch(console.error)
      .finally(() => setLoadingFw(false))
  }, [])

  // ── Load controls when framework changes ──────────────────────────────────

  useEffect(() => {
    if (!selectedFwId) return
    setLoadingCtrl(true)
    setSelectedControl(null)
    setMappings([])

    fetch(`/api/controls?frameworkId=${selectedFwId}`)
      .then((r) => r.json())
      .then((data) => {
        const list: Control[] = Array.isArray(data.controls) ? data.controls : []
        setControls(list)
      })
      .catch(console.error)
      .finally(() => setLoadingCtrl(false))
  }, [selectedFwId])

  // ── Load mappings when control is selected ────────────────────────────────

  const loadMappings = useCallback((controlId: string) => {
    setLoadingMap(true)
    fetch(`/api/mappings?controlId=${controlId}`)
      .then((r) => r.json())
      .then((data) => {
        const list: MappingTarget[] = Array.isArray(data.mappings) ? data.mappings : []
        setMappings(list)
      })
      .catch(console.error)
      .finally(() => setLoadingMap(false))
  }, [])

  const handleSelectControl = (ctrl: Control) => {
    setSelectedControl(ctrl)
    loadMappings(ctrl.id)
  }

  // ── Update status ──────────────────────────────────────────────────────────

  const updateStatus = async (controlId: string, newStatus: string) => {
    setUpdating(true)
    try {
      await fetch(`/api/controls/${controlId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      // Refresh controls list
      const data = await fetch(`/api/controls?frameworkId=${selectedFwId}`).then((r) => r.json())
      const list: Control[] = Array.isArray(data.controls) ? data.controls : []
      setControls(list)
      // Update selected control in state
      const updated = list.find((c) => c.id === controlId)
      if (updated) setSelectedControl(updated)
    } catch (e) {
      console.error(e)
    } finally {
      setUpdating(false)
    }
  }

  // ── Filtered controls ──────────────────────────────────────────────────────

  const filtered = controls.filter((c) => {
    const q = search.toLowerCase()
    if (q && !c.title.toLowerCase().includes(q) && !(c.controlId ?? '').toLowerCase().includes(q) && !(c.category ?? '').toLowerCase().includes(q)) return false
    if (statusFilter !== 'all' && c.assignment?.status !== statusFilter) return false
    return true
  })

  // ── Summary stats ──────────────────────────────────────────────────────────

  const stats = {
    total:       controls.length,
    implemented: controls.filter((c) => c.assignment?.status === 'implemented').length,
    inProgress:  controls.filter((c) => c.assignment?.status === 'in_progress').length,
    notStarted:  controls.filter((c) => c.assignment?.status === 'not_started').length,
    needsReview: controls.filter((c) => c.assignment?.status === 'needs_review').length,
  }
  const pct = stats.total > 0 ? Math.round((stats.implemented / stats.total) * 100) : 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--violet-dim)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckSquare size={15} style={{ color: 'var(--violet)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Controls Library</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Browse, track, and manage compliance controls</p>
          </div>
        </div>
      </div>

      {/* Body — 3-column layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>

        {/* ── Column 1: Framework selector ─────────────────────────────── */}
        <div style={{ width: 200, borderRight: '1px solid var(--border-glass)', overflowY: 'auto', flexShrink: 0, padding: '12px 8px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 8px 8px' }}>Frameworks</div>
          {loadingFw ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.04)', margin: '4px 0', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))
          ) : frameworks.length === 0 ? (
            <div style={{ padding: '12px 8px', fontSize: 12, color: 'var(--text-muted)' }}>No frameworks — upload one first</div>
          ) : (
            frameworks.map((fw) => (
              <button
                key={fw.id}
                onClick={() => setSelectedFwId(fw.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: selectedFwId === fw.id ? 'var(--violet-dim)' : 'transparent',
                  color: selectedFwId === fw.id ? 'var(--violet)' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: selectedFwId === fw.id ? 600 : 400,
                  marginBottom: 2, transition: 'background 0.15s, color 0.15s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Shield size={12} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fw.shortName ?? fw.name}</span>
              </button>
            ))
          )}
        </div>

        {/* ── Column 2: Controls list ───────────────────────────────────── */}
        <div style={{ flex: 1, borderRight: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Stats bar */}
          {!loadingCtrl && controls.length > 0 && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-glass)', display: 'flex', gap: 20, flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.total}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--emerald)' }}>{stats.implemented}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Done</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--amber)' }}>{stats.inProgress}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>WIP</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--violet)' }}>{pct}%</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Complete</span>
              </div>
            </div>
          )}

          {/* Search + filter */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-glass)', display: 'flex', gap: 8, flexShrink: 0 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search controls…"
                style={{
                  width: '100%', padding: '6px 10px 6px 28px', borderRadius: 8, fontSize: 12,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)',
                color: 'var(--text-secondary)', outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="all">All Status</option>
              <option value="implemented">Implemented</option>
              <option value="in_progress">In Progress</option>
              <option value="not_started">Not Started</option>
              <option value="needs_review">Needs Review</option>
            </select>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {loadingCtrl ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ margin: '4px 12px', height: 52, borderRadius: 8, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {controls.length === 0 ? 'No controls found — select a framework or upload one.' : 'No controls match your filters.'}
              </div>
            ) : (
              filtered.map((ctrl) => {
                const isActive = selectedControl?.id === ctrl.id
                const status = ctrl.assignment?.status ?? 'not_started'
                const meta = STATUS_META[status] ?? STATUS_META.not_started
                return (
                  <button
                    key={ctrl.id}
                    onClick={() => handleSelectControl(ctrl)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', cursor: 'pointer',
                      background: isActive ? 'rgba(139,92,246,0.10)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--violet)' : '2px solid transparent',
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
                      transition: 'background 0.12s',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        {ctrl.controlId && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--violet)', background: 'var(--violet-dim)', padding: '1px 6px', borderRadius: 4 }}>
                            {ctrl.controlId}
                          </span>
                        )}
                        {ctrl.category && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctrl.category}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {ctrl.title}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <meta.Icon size={12} style={{ color: meta.color }} />
                      <ChevronRight size={12} style={{ color: 'var(--text-muted)', opacity: isActive ? 1 : 0 }} />
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Column 3: Detail panel ────────────────────────────────────── */}
        <div style={{ width: 380, overflowY: 'auto', flexShrink: 0, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!selectedControl ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, color: 'var(--text-muted)' }}>
              <BookOpen size={32} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: 13, textAlign: 'center', margin: 0 }}>Select a control to view details, mappings, and comments</p>
            </div>
          ) : (
            <>
              {/* Title block */}
              <div className="glass-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    {selectedControl.controlId && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet)', marginBottom: 4 }}>{selectedControl.controlId}</div>
                    )}
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{selectedControl.title}</h2>
                  </div>
                </div>
                {selectedControl.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 10px' }}>{selectedControl.description}</p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedControl.category && (
                    <span style={{ fontSize: 11, color: 'var(--cyan)', background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)', padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Tag size={9} /> {selectedControl.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="glass-card" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Implementation Status</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(['not_started', 'in_progress', 'implemented', 'needs_review', 'not_applicable'] as const).map((s) => {
                    const m = STATUS_META[s]
                    const current = (selectedControl.assignment?.status ?? 'not_started') === s
                    return (
                      <button
                        key={s}
                        onClick={() => updateStatus(selectedControl.id, s)}
                        disabled={updating}
                        style={{
                          padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: updating ? 'not-allowed' : 'pointer',
                          background: current ? `${m.color}20` : 'transparent',
                          border: `1px solid ${current ? m.color : 'var(--border-glass)'}`,
                          color: current ? m.color : 'var(--text-muted)',
                          transition: 'all 0.15s', opacity: updating ? 0.6 : 1,
                        }}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mappings */}
              <div className="glass-card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Link2 size={11} /> Cross-Framework Mappings
                  </div>
                  <button onClick={() => loadMappings(selectedControl.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                    <RefreshCw size={11} />
                  </button>
                </div>
                {loadingMap ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ height: 32, borderRadius: 6, background: 'rgba(255,255,255,0.04)', marginBottom: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  ))
                ) : mappings.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                    No mappings yet — use the Mapping Explorer or AI Suggest
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {mappings.map((m) => (
                      <div key={m.id} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--violet)' }}>{m.controlId ?? '—'}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.frameworkShortName ?? m.frameworkName}</span>
                          </div>
                          {m.mappingType && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: MAPPING_TYPE_COLORS[m.mappingType] ?? 'var(--text-muted)', background: `${MAPPING_TYPE_COLORS[m.mappingType] ?? 'var(--text-muted)'}18`, padding: '1px 6px', borderRadius: 4 }}>
                              {m.mappingType}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{m.title}</div>
                        {m.confidence !== null && <ConfBar value={m.confidence} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments */}
              <CommentsPanel entityType="control" entityId={selectedControl.id} compact />

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={`/mappings?controlId=${selectedControl.id}`}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'var(--violet-dim)', border: '1px solid rgba(139,92,246,0.3)',
                    color: 'var(--violet)', textDecoration: 'none', textAlign: 'center',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <GitBranch size={12} /> Mapping Explorer
                </a>
                <a
                  href={`/soa?controlId=${selectedControl.id}`}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'rgba(6,182,212,0.10)', border: '1px solid rgba(6,182,212,0.25)',
                    color: 'var(--cyan)', textDecoration: 'none', textAlign: 'center',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <ExternalLink size={12} /> View in SOA
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
