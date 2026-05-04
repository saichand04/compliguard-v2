'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  BookOpen, Printer, ChevronDown, Check, Minus,
  X, Filter, RefreshCw, CheckSquare, Square,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Framework {
  id: string
  name: string
  shortName: string | null
}

interface SoaEntry {
  id: string | null
  controlId: string
  controlRef: string
  controlTitle: string
  category: string | null
  status: 'included' | 'excluded' | 'partial'
  justification: string | null
  implementationStatus: string | null
  reviewedBy: string | null
  reviewedAt: string | null
}

const STATUS_OPTIONS: Array<{ value: SoaEntry['status']; label: string; color: string; dotColor: string }> = [
  { value: 'included', label: 'Included',  color: 'var(--emerald)', dotColor: '#10B981' },
  { value: 'partial',  label: 'Partial',   color: 'var(--amber)',   dotColor: '#F59E0B' },
  { value: 'excluded', label: 'Excluded',  color: 'var(--text-muted)', dotColor: '#64748B' },
]

// ── Status badge ──────────────────────────────────────────────────────────────

function ApplicabilityBadge({ status }: { status: SoaEntry['status'] }) {
  const opt = STATUS_OPTIONS.find((o) => o.value === status)!
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 500,
        color: opt.color,
        padding: '2px 8px',
        borderRadius: 20,
        background: `color-mix(in srgb, ${opt.dotColor} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${opt.dotColor} 25%, transparent)`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: opt.dotColor,
          flexShrink: 0,
        }}
      />
      {opt.label}
    </span>
  )
}

// ── Inline select ─────────────────────────────────────────────────────────────

function InlineApplicabilitySelect({
  value,
  onChange,
}: {
  value: SoaEntry['status']
  onChange: (v: SoaEntry['status']) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <ApplicabilityBadge status={value} />
        <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} />
      </button>
      {open && (
        <div
          className="glass-strong"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 50,
            marginTop: 4,
            borderRadius: 8,
            overflow: 'hidden',
            minWidth: 130,
            border: '1px solid var(--border-glass)',
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                width: '100%',
                background: value === opt.value ? 'rgba(255,255,255,0.06)' : 'none',
                border: 'none',
                cursor: 'pointer',
                color: opt.color,
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: opt.dotColor, flexShrink: 0 }} />
              {opt.label}
              {value === opt.value && <Check size={10} style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Inline justification input ────────────────────────────────────────────────

function InlineJustification({
  value,
  onSave,
}: {
  value: string | null
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commit() {
    setEditing(false)
    onSave(draft)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid var(--violet)',
          borderRadius: 6,
          padding: '4px 8px',
          color: 'var(--text-primary)',
          fontSize: 12,
          width: '100%',
          outline: 'none',
        }}
      />
    )
  }

  return (
    <button
      onClick={() => { setDraft(value ?? ''); setEditing(true) }}
      style={{
        background: 'none',
        border: '1px dashed transparent',
        borderRadius: 6,
        padding: '3px 6px',
        cursor: 'pointer',
        color: value ? 'var(--text-secondary)' : 'var(--text-muted)',
        fontSize: 12,
        textAlign: 'left',
        maxWidth: 220,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-glass)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent' }}
    >
      {value || <span style={{ opacity: 0.4 }}>Click to add…</span>}
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SoaPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string>('')
  const [entries, setEntries] = useState<SoaEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<SoaEntry['status']>('included')
  const [showBulkBar, setShowBulkBar] = useState(false)

  // Load frameworks
  useEffect(() => {
    fetch('/api/frameworks')
      .then((r) => r.json())
      .then((data) => {
        const fws: Framework[] = data.frameworks ?? data ?? []
        setFrameworks(fws)
        if (fws.length > 0) setSelectedFrameworkId(fws[0].id)
      })
      .catch(() => {
        // Use empty state gracefully
      })
  }, [])

  // Load SOA entries when framework changes
  useEffect(() => {
    if (!selectedFrameworkId) return
    setLoading(true)
    setEntries([])
    setSelectedIds(new Set())

    fetch(`/api/soa?frameworkId=${selectedFrameworkId}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries ?? [])
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [selectedFrameworkId])

  const updateEntry = useCallback(
    async (controlId: string, patch: Partial<SoaEntry>) => {
      setSaving((p) => ({ ...p, [controlId]: true }))

      // Optimistic update
      setEntries((prev) =>
        prev.map((e) => (e.controlId === controlId ? { ...e, ...patch } : e))
      )

      try {
        await fetch('/api/soa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            controlId,
            frameworkId: selectedFrameworkId,
            ...patch,
          }),
        })
      } catch {
        // Revert is complex — just leave the optimistic update
      } finally {
        setSaving((p) => ({ ...p, [controlId]: false }))
      }
    },
    [selectedFrameworkId]
  )

  const handleBulkApply = useCallback(async () => {
    for (const controlId of selectedIds) {
      await updateEntry(controlId, { status: bulkStatus })
    }
    setSelectedIds(new Set())
    setShowBulkBar(false)
  }, [selectedIds, bulkStatus, updateEntry])

  const toggleSelect = useCallback((controlId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(controlId)) next.delete(controlId)
      else next.add(controlId)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(entries.map((e) => e.controlId)))
    }
  }, [entries, selectedIds.size])

  // Summary counts
  const counts = entries.reduce(
    (acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const selectedFramework = frameworks.find((f) => f.id === selectedFrameworkId)

  const handleExportPdf = () => {
    window.open(
      `/api/soa/export?frameworkId=${selectedFrameworkId}`,
      '_blank'
    )
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: 5,
              }}
            >
              Statement of Applicability
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Define which controls apply to your organisation and why
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {/* Framework selector */}
            <div style={{ position: 'relative' }}>
              <select
                value={selectedFrameworkId}
                onChange={(e) => setSelectedFrameworkId(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 8,
                  padding: '7px 32px 7px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  cursor: 'pointer',
                  appearance: 'none',
                  outline: 'none',
                }}
              >
                {frameworks.length === 0 && (
                  <option value="">No frameworks</option>
                )}
                {frameworks.map((f) => (
                  <option key={f.id} value={f.id} style={{ background: '#0F1729' }}>
                    {f.shortName ?? f.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            <button
              className="btn-ghost"
              style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={handleExportPdf}
              disabled={!selectedFrameworkId}
            >
              <Printer size={13} />
              Export PDF
            </button>
          </div>
        </div>

        {/* Summary bar */}
        {entries.length > 0 && (
          <div
            className="glass-card"
            style={{
              marginTop: 14,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            {[
              { label: 'Included',  value: counts['included'] ?? 0,  color: 'var(--emerald)' },
              { label: 'Partial',   value: counts['partial'] ?? 0,   color: 'var(--amber)'   },
              { label: 'Excluded',  value: counts['excluded'] ?? 0,  color: 'var(--text-muted)' },
              { label: 'Total',     value: entries.length,            color: 'var(--text-secondary)' },
            ].map((stat) => (
              <div key={stat.label} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>
                  {stat.value}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stat.label}</span>
              </div>
            ))}

            {selectedIds.size > 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selectedIds.size} selected
                </span>
                <div style={{ position: 'relative' }}>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value as SoaEntry['status'])}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 6,
                      padding: '5px 28px 5px 10px',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      appearance: 'none',
                      outline: 'none',
                    }}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} style={{ background: '#0F1729' }}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                </div>
                <button
                  className="btn-primary"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                  onClick={handleBulkApply}
                >
                  Apply to all
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 12, padding: '5px 8px' }}
                  onClick={() => setSelectedIds(new Set())}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="glass-card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, color: 'var(--text-muted)', fontSize: 13 }}>
            <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
            Loading SOA entries…
          </div>
        ) : entries.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, color: 'var(--text-muted)' }}>
            <BookOpen size={32} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: 13 }}>
              {selectedFrameworkId
                ? 'No controls found for this framework'
                : 'Select a framework to begin'}
            </p>
          </div>
        ) : (
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', position: 'sticky', top: 0, background: 'rgba(8,11,24,0.85)', backdropFilter: 'blur(12px)', zIndex: 10 }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, width: 36 }}>
                    <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                      {selectedIds.size === entries.length ? (
                        <CheckSquare size={14} style={{ color: 'var(--violet)' }} />
                      ) : (
                        <Square size={14} />
                      )}
                    </button>
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>Control ID</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Title</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Category</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Applicability</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, minWidth: 180 }}>Justification</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Implementation</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>Last Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const isSelected = selectedIds.has(entry.controlId)
                  const isExcluded = entry.status === 'excluded'

                  return (
                    <tr
                      key={entry.controlId}
                      style={{
                        borderBottom: '1px solid var(--border-glass)',
                        background: isSelected
                          ? 'rgba(139,92,246,0.06)'
                          : idx % 2 === 0
                          ? 'transparent'
                          : 'rgba(255,255,255,0.01)',
                        opacity: isExcluded ? 0.55 : 1,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={() => toggleSelect(entry.controlId)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                        >
                          {isSelected ? (
                            <CheckSquare size={13} style={{ color: 'var(--violet)' }} />
                          ) : (
                            <Square size={13} />
                          )}
                        </button>
                      </td>

                      {/* Control ID */}
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {entry.controlRef || '—'}
                      </td>

                      {/* Title */}
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500, textDecoration: isExcluded ? 'line-through' : 'none', maxWidth: 220 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.controlTitle}
                        </span>
                      </td>

                      {/* Category */}
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {entry.category || '—'}
                      </td>

                      {/* Applicability — inline editable */}
                      <td style={{ padding: '10px 12px' }}>
                        <InlineApplicabilitySelect
                          value={entry.status}
                          onChange={(v) => updateEntry(entry.controlId, { status: v })}
                        />
                      </td>

                      {/* Justification — inline editable */}
                      <td style={{ padding: '10px 12px' }}>
                        <InlineJustification
                          value={entry.justification}
                          onSave={(v) => updateEntry(entry.controlId, { justification: v })}
                        />
                      </td>

                      {/* Implementation status */}
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                        <InlineJustification
                          value={entry.implementationStatus}
                          onSave={(v) => updateEntry(entry.controlId, { implementationStatus: v })}
                        />
                      </td>

                      {/* Last reviewed */}
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 11 }}>
                        {entry.reviewedAt
                          ? new Date(entry.reviewedAt).toLocaleDateString()
                          : '—'}
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
  )
}
