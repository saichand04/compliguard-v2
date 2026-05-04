'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  GitBranch, Info, Download, Zap, Brain, CheckCircle2,
  XCircle, Loader2, Settings, ArrowRight, RefreshCw, AlertCircle,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MappingCell {
  confidence: number | null
  mappingType: 'direct' | 'partial' | 'related' | 'inferred' | null
  targetRef: string | null
  mappingId?: string
}

interface CrosswalkRow {
  sourceControlId: string
  sourceRef: string
  sourceTitle: string
  category: string
  cells: Record<string, MappingCell>
}

interface FrameworkMeta {
  id: string
  name: string
  shortName: string
  slug: string
}

interface AiSuggestion {
  id: string
  sourceControlId: string
  targetControlId: string
  targetControlRef: string | null
  targetTitle: string
  targetFramework: string
  targetFrameworkShort: string
  confidence: number
  rationale: string | null
  suggestedBy: string
  status: string
}

// ── Cell color helpers ────────────────────────────────────────────────────────

function cellColor(cell: MappingCell): string {
  if (!cell.confidence) return 'transparent'
  if (cell.confidence >= 80) return 'rgba(16,185,129,0.18)'
  if (cell.confidence >= 50) return 'rgba(251,191,36,0.18)'
  return 'rgba(249,115,22,0.18)'
}
function cellTextColor(cell: MappingCell): string {
  if (!cell.confidence) return 'var(--text-muted)'
  if (cell.confidence >= 80) return '#6EE7B7'
  if (cell.confidence >= 50) return '#FCD34D'
  return '#FDBA74'
}
function cellBorderColor(cell: MappingCell): string {
  if (!cell.confidence) return 'var(--border-glass)'
  if (cell.confidence >= 80) return 'rgba(16,185,129,0.30)'
  if (cell.confidence >= 50) return 'rgba(251,191,36,0.30)'
  return 'rgba(249,115,22,0.30)'
}

// ── AI Suggestions Panel ──────────────────────────────────────────────────────

function AiSuggestionsPanel({ controlId, controlRef }: { controlId: string | null; controlRef: string | null }) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [configRequired, setConfigRequired] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const prevControlId = useRef<string | null>(null)

  // Reset when control changes
  useEffect(() => {
    if (controlId !== prevControlId.current) {
      prevControlId.current = controlId
      setSuggestions([])
      setLoaded(false)
      setConfigRequired(false)
    }
  }, [controlId])

  const loadSuggestions = useCallback(async () => {
    if (!controlId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/mappings/suggestions?controlId=${controlId}&status=pending`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions ?? [])
      }
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [controlId])

  const handleOpen = () => {
    setOpen((o) => {
      if (!o && !loaded && controlId) loadSuggestions()
      return !o
    })
  }

  const generateSuggestions = async () => {
    if (!controlId) return
    setGenerating(true)
    try {
      const res = await fetch('/api/mappings/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ controlId }),
      })
      const data = await res.json()
      if (data.configRequired) {
        setConfigRequired(true)
      } else {
        setSuggestions(data.suggestions ?? [])
        setLoaded(true)
        setConfigRequired(false)
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleAction = async (suggestionId: string, action: 'accepted' | 'rejected') => {
    setActionLoading(suggestionId)
    try {
      await fetch(`/api/mappings/suggestions/${suggestionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      })
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="glass-card" style={{ flexShrink: 0, marginTop: 10 }}>
      <button
        onClick={handleOpen}
        style={{
          width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)',
        }}
      >
        <Brain size={15} style={{ color: 'var(--violet)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>AI Mapping Suggestions</span>
        {controlRef && (
          <span style={{ fontSize: 11, color: 'var(--violet)', background: 'var(--violet-dim)', padding: '2px 8px', borderRadius: 20 }}>
            {controlRef}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          {open ? '▲ Collapse' : '▼ Expand'}
        </span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border-glass)', padding: 16 }}>
          {!controlId ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Click a row in the crosswalk table to select a control, then generate AI suggestions.</p>
          ) : configRequired ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 8 }}>
              <AlertCircle size={14} style={{ color: 'var(--violet)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>AI provider not configured.</span>
              <Link href="/settings/ai" style={{ fontSize: 12, color: 'var(--violet)', marginLeft: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Settings size={11} /> Configure AI
              </Link>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  onClick={generateSuggestions}
                  disabled={generating}
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
                    background: 'var(--violet-dim)', border: '1px solid rgba(139,92,246,0.35)', color: 'var(--violet)',
                    display: 'flex', alignItems: 'center', gap: 6, opacity: generating ? 0.7 : 1,
                  }}
                >
                  {generating ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                  {generating ? 'Generating…' : 'Generate AI Suggestions'}
                </button>
                {loaded && (
                  <button
                    onClick={loadSuggestions}
                    disabled={loading}
                    style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12, background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <RefreshCw size={12} />
                  </button>
                )}
              </div>

              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                  <Loader2 size={13} className="animate-spin" /> Loading suggestions…
                </div>
              ) : suggestions.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                  {loaded ? 'No pending suggestions — click Generate to create new ones.' : 'Click Generate AI Suggestions to get started.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {suggestions.map((s) => (
                    <div key={s.id} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', background: 'rgba(6,182,212,0.12)', padding: '1px 6px', borderRadius: 4 }}>
                          {controlRef}
                        </span>
                        <ArrowRight size={11} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet)', background: 'var(--violet-dim)', padding: '1px 6px', borderRadius: 4 }}>
                          {s.targetControlRef ?? '—'}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.targetFrameworkShort}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: s.confidence >= 80 ? '#6EE7B7' : s.confidence >= 60 ? '#FCD34D' : '#FDBA74' }}>
                          {s.confidence}%
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>{s.targetTitle}</div>
                      {/* Confidence bar */}
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ height: '100%', width: `${s.confidence}%`, background: s.confidence >= 80 ? 'var(--emerald)' : s.confidence >= 60 ? 'var(--amber)' : 'var(--rose)', borderRadius: 2 }} />
                      </div>
                      {s.rationale && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5, fontStyle: 'italic' }}>{s.rationale}</p>
                      )}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handleAction(s.id, 'accepted')}
                          disabled={!!actionLoading}
                          style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#6EE7B7', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          {actionLoading === s.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                          Accept
                        </button>
                        <button
                          onClick={() => handleAction(s.id, 'rejected')}
                          disabled={!!actionLoading}
                          style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <XCircle size={10} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MappingsPage() {
  const [frameworks, setFrameworks]         = useState<FrameworkMeta[]>([])
  const [sourceFrameworkId, setSourceFwId]  = useState<string | null>(null)
  const [crosswalkRows, setCrosswalkRows]   = useState<CrosswalkRow[]>([])
  const [targetFrameworks, setTargetFrameworks] = useState<FrameworkMeta[]>([])
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [hoveredCell, setHoveredCell]       = useState<{ row: number; col: string } | null>(null)
  const [selectedRow, setSelectedRow]       = useState<{ controlId: string; ref: string } | null>(null)
  const [loading, setLoading]               = useState(true)
  const [buildingTable, setBuildingTable]   = useState(false)

  // ── Load frameworks ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/frameworks')
      .then((r) => r.json())
      .then((data) => {
        const list: FrameworkMeta[] = Array.isArray(data.frameworks) ? data.frameworks.map((f: { id: string; name: string; shortName?: string | null; slug?: string | null }) => ({
          id: f.id, name: f.name, shortName: f.shortName ?? f.name, slug: f.slug ?? '',
        })) : []
        setFrameworks(list)
        // Default: first framework as source
        if (list.length > 0) setSourceFwId(list[0].id)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ── Build crosswalk when source framework changes ──────────────────────────
  useEffect(() => {
    if (!sourceFrameworkId || frameworks.length === 0) return
    setBuildingTable(true)
    setCrosswalkRows([])

    const otherFrameworks = frameworks.filter((f) => f.id !== sourceFrameworkId)
    setTargetFrameworks(otherFrameworks)

    // Fetch source controls
    fetch(`/api/controls?frameworkId=${sourceFrameworkId}`)
      .then((r) => r.json())
      .then(async (ctrlData) => {
        const sourceControls: Array<{ id: string; controlId: string | null; title: string; category: string | null }> =
          Array.isArray(ctrlData.controls) ? ctrlData.controls : []

        if (sourceControls.length === 0) {
          setCrosswalkRows([])
          return
        }

        // Limit to 50 for UI performance — paginate later
        const slice = sourceControls.slice(0, 50)

        // Fetch all mappings for this framework
        const mappingsRes = await fetch(`/api/mappings?frameworkId=${sourceFrameworkId}`)
        const mappingsData = await mappingsRes.json()
        const allMappings: Array<{
          id: string
          sourceControlId: string
          targetControlId: string
          mappingType: string | null
          confidence: number | null
          targetControl?: { id: string; controlId: string | null; title: string; frameworkId: string }
          targetFramework?: { id: string; name: string; shortName: string | null }
        }> = Array.isArray(mappingsData.mappings) ? mappingsData.mappings : []

        // Build mapping index: sourceControlId → targetFrameworkId → cell
        const mappingIndex: Record<string, Record<string, MappingCell>> = {}
        for (const m of allMappings) {
          if (!mappingIndex[m.sourceControlId]) mappingIndex[m.sourceControlId] = {}
          const fwId = m.targetFramework?.id ?? m.targetControl?.frameworkId ?? ''
          if (fwId) {
            mappingIndex[m.sourceControlId][fwId] = {
              confidence: m.confidence,
              mappingType: (m.mappingType as MappingCell['mappingType']) ?? null,
              targetRef: m.targetControl?.controlId ?? null,
              mappingId: m.id,
            }
          }
        }

        const rows: CrosswalkRow[] = slice.map((ctrl) => {
          const cells: Record<string, MappingCell> = {}
          for (const fw of otherFrameworks) {
            cells[fw.id] = mappingIndex[ctrl.id]?.[fw.id] ?? { confidence: null, mappingType: null, targetRef: null }
          }
          return {
            sourceControlId: ctrl.id,
            sourceRef: ctrl.controlId ?? ctrl.id.slice(0, 8),
            sourceTitle: ctrl.title,
            category: ctrl.category ?? 'General',
            cells,
          }
        })

        setCrosswalkRows(rows)
      })
      .catch(console.error)
      .finally(() => setBuildingTable(false))
  }, [sourceFrameworkId, frameworks])

  // ── Derived ────────────────────────────────────────────────────────────────
  const categories = ['all', ...Array.from(new Set(crosswalkRows.map((r) => r.category)))]
  const filteredRows = filterCategory === 'all' ? crosswalkRows : crosswalkRows.filter((r) => r.category === filterCategory)

  const mappedCells   = filteredRows.flatMap((r) => Object.values(r.cells)).filter((c) => c.confidence !== null).length
  const directCells   = filteredRows.flatMap((r) => Object.values(r.cells)).filter((c) => c.mappingType === 'direct').length
  const totalCells    = filteredRows.length * targetFrameworks.length

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportCsv = () => {
    const headers = ['Source Ref', 'Title', 'Category', ...targetFrameworks.map((f) => `${f.shortName} Ref`), ...targetFrameworks.map((f) => `${f.shortName} Confidence`)]
    const rows = filteredRows.map((r) => [
      r.sourceRef, r.sourceTitle, r.category,
      ...targetFrameworks.map((f) => r.cells[f.id]?.targetRef ?? ''),
      ...targetFrameworks.map((f) => r.cells[f.id]?.confidence?.toString() ?? ''),
    ])
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'crosswalk-export.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 24px', gap: 14, overflow: 'hidden' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GitBranch size={15} style={{ color: 'var(--cyan)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Mapping Explorer</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Cross-framework control equivalence via NIST 800-53 canonical anchor</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {/* Source framework selector */}
          <select
            value={sourceFrameworkId ?? ''}
            onChange={(e) => setSourceFwId(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', outline: 'none' }}
          >
            {loading ? <option>Loading…</option> : frameworks.map((fw) => (
              <option key={fw.id} value={fw.id}>{fw.shortName}</option>
            ))}
          </select>
          <button onClick={exportCsv} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* Stats + legend row */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Stats */}
        {!buildingTable && crosswalkRows.length > 0 && (
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { label: 'Total Mappings', value: mappedCells, color: 'var(--text-primary)' },
              { label: 'Direct Match',   value: directCells, color: 'var(--emerald)' },
              { label: 'Partial Match',  value: filteredRows.flatMap((r) => Object.values(r.cells)).filter((c) => c.mappingType === 'partial').length, color: '#FBBF24' },
              { label: 'No Mapping',     value: totalCells - mappedCells, color: 'var(--text-muted)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass-card" style={{ padding: '10px 14px', flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Legend + category filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Legend:</span>
            {[
              { color: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.3)', text: '#6EE7B7', label: '≥80% Direct' },
              { color: 'rgba(251,191,36,0.18)', border: 'rgba(251,191,36,0.3)',  text: '#FCD34D', label: '50–79% Partial' },
              { color: 'rgba(249,115,22,0.18)', border: 'rgba(249,115,22,0.3)',  text: '#FDBA74', label: '20–49% Related' },
              { color: 'transparent', border: 'var(--border-glass)', text: 'var(--text-muted)', label: 'No mapping' },
            ].map(({ color, border, text, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 14, height: 14, background: color, border: `1px solid ${border}`, borderRadius: 3 }} />
                <span style={{ fontSize: 11, color: text }}>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                style={{
                  background: filterCategory === cat ? 'var(--violet-dim)' : 'transparent',
                  border: `1px solid ${filterCategory === cat ? 'rgba(139,92,246,0.4)' : 'var(--border-glass)'}`,
                  color: filterCategory === cat ? 'var(--violet)' : 'var(--text-muted)',
                  padding: '4px 10px', borderRadius: 99, fontSize: 11.5, cursor: 'pointer',
                  transition: 'all 0.15s ease', fontFamily: 'Inter, sans-serif',
                }}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Crosswalk table */}
      <div className="glass-card" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {loading || buildingTable ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48, color: 'var(--text-muted)' }}>
            <Loader2 size={28} className="animate-spin" style={{ opacity: 0.5 }} />
            <p style={{ fontSize: 13, margin: 0 }}>{loading ? 'Loading frameworks…' : 'Building crosswalk table…'}</p>
          </div>
        ) : crosswalkRows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48, color: 'var(--text-muted)' }}>
            <GitBranch size={32} style={{ opacity: 0.25 }} />
            <p style={{ fontSize: 13, margin: 0 }}>No controls in this framework yet — upload a framework to populate the crosswalk.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={{
                  padding: '10px 14px', textAlign: 'left', background: 'rgba(8,11,24,0.95)',
                  borderBottom: '1px solid var(--border-glass)', backdropFilter: 'blur(12px)',
                  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: 280,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GitBranch size={12} />
                    {frameworks.find((f) => f.id === sourceFrameworkId)?.name ?? 'Source Framework'}
                  </div>
                </th>
                {targetFrameworks.map((fw) => (
                  <th key={fw.id} style={{
                    padding: '10px 12px', textAlign: 'center', background: 'rgba(8,11,24,0.95)',
                    borderBottom: '1px solid var(--border-glass)', backdropFilter: 'blur(12px)',
                    fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', whiteSpace: 'nowrap', minWidth: 120,
                  }}>
                    {fw.shortName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, rowIdx) => (
                <tr
                  key={row.sourceControlId}
                  onClick={() => setSelectedRow(selectedRow?.controlId === row.sourceControlId ? null : { controlId: row.sourceControlId, ref: row.sourceRef })}
                  style={{
                    background: selectedRow?.controlId === row.sourceControlId
                      ? 'rgba(139,92,246,0.08)'
                      : rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    cursor: 'pointer', transition: 'background 0.12s ease',
                    outline: selectedRow?.controlId === row.sourceControlId ? '1px solid rgba(139,92,246,0.3)' : 'none',
                  }}
                >
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{ fontSize: 11, fontWeight: 600, color: 'var(--cyan)', background: 'rgba(6,182,212,0.12)', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
                        {row.sourceRef}
                      </code>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                        {row.sourceTitle}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: 3, flexShrink: 0 }}>
                        {row.category}
                      </span>
                    </div>
                  </td>
                  {targetFrameworks.map((fw) => {
                    const cell = row.cells[fw.id]
                    const isHovered = hoveredCell?.row === rowIdx && hoveredCell?.col === fw.id
                    return (
                      <td
                        key={fw.id}
                        style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-glass)', textAlign: 'center', position: 'relative' }}
                        onMouseEnter={() => setHoveredCell({ row: rowIdx, col: fw.id })}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {cell.confidence !== null ? (
                          <div style={{
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                            padding: '5px 8px', background: cellColor(cell), border: `1px solid ${cellBorderColor(cell)}`,
                            borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s ease', minWidth: 72,
                            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                            boxShadow: isHovered ? `0 4px 12px ${cellBorderColor(cell)}` : 'none',
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: cellTextColor(cell) }}>{cell.confidence}%</span>
                            <code style={{ fontSize: 9, color: cellTextColor(cell), opacity: 0.8 }}>{cell.targetRef}</code>
                          </div>
                        ) : (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 72, height: 36, background: 'transparent',
                            border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 6,
                          }}>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>—</span>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* AI Suggestions panel */}
      <AiSuggestionsPanel
        controlId={selectedRow?.controlId ?? null}
        controlRef={selectedRow?.ref ?? null}
      />

      {/* Footer */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Info size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          All cross-framework equivalences route through the NIST 800-53 canonical anchor — direct string comparison is never used.
          {crosswalkRows.length > 0 && ` Showing ${filteredRows.length} of ${crosswalkRows.length} controls.`}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Zap size={11} style={{ color: 'var(--violet)' }} />
          <span style={{ fontSize: 11, color: 'var(--violet)' }}>SCF Crosswalk Active</span>
        </div>
      </div>
    </div>
  )
}
