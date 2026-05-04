'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, Search, Filter, Plus, RefreshCw,
  Shield, Clock, CheckCircle2, XCircle, ShieldAlert,
  ShieldCheck, ArrowUpRight, Eye,
} from 'lucide-react'
import { FindingModal } from '@/components/findings/finding-modal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Finding {
  id: string
  title: string
  description: string | null
  severity: string
  status: string
  source: string
  cveId: string | null
  affectedAsset: string | null
  remediationGuidance: string | null
  remediationSteps: string | null
  assignedTo: string | null
  dueDate: string | null
  acceptanceRationale: string | null
  createdAt: string
  updatedAt: string
}

interface FindingStats {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

// ── Badge configs ──────────────────────────────────────────────────────────────

const SEVERITY_META: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#EF4444' },
  high:     { label: 'High',     color: '#F97316' },
  medium:   { label: 'Medium',   color: '#EAB308' },
  low:      { label: 'Low',      color: '#3B82F6' },
  info:     { label: 'Info',     color: '#94A3B8' },
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  open:           { label: 'Open',           color: '#EF4444' },
  in_remediation: { label: 'In Remediation', color: '#EAB308' },
  resolved:       { label: 'Resolved',       color: '#10B981' },
  accepted:       { label: 'Accepted',       color: '#8B5CF6' },
  false_positive: { label: 'False Positive', color: '#94A3B8' },
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
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
      color: meta.color, fontSize: 11, fontWeight: 700,
    }}>
      {meta.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: '#94A3B8' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
      color: meta.color, fontSize: 11, fontWeight: 600,
    }}>
      {meta.label}
    </span>
  )
}

function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE_META[source] ?? { label: source, color: '#94A3B8' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 6,
      background: `${meta.color}14`, border: `1px solid ${meta.color}35`,
      color: meta.color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {meta.label}
    </span>
  )
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FindingsPage() {
  const [findings, setFindings] = useState<Finding[]>([])
  const [stats, setStats] = useState<FindingStats>({ critical: 0, high: 0, medium: 0, low: 0, info: 0 })
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editFinding, setEditFinding] = useState<Finding | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const loadFindings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (severityFilter) params.set('severity', severityFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (sourceFilter) params.set('source', sourceFilter)

      const res = await fetch(`/api/findings?${params.toString()}`)
      if (!res.ok) return
      const data = await res.json()
      setFindings(Array.isArray(data.findings) ? data.findings : [])
      if (data.stats) setStats(data.stats)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, severityFilter, statusFilter, sourceFilter])

  useEffect(() => {
    loadFindings()
  }, [loadFindings])

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const statCards = [
    { label: 'Critical', value: stats.critical, color: '#EF4444' },
    { label: 'High',     value: stats.high,     color: '#F97316' },
    { label: 'Medium',   value: stats.medium,   color: '#EAB308' },
    { label: 'Low',      value: stats.low,      color: '#3B82F6' },
    { label: 'Info',     value: stats.info,     color: '#94A3B8' },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
            Findings
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
            Track and remediate security findings across all sources
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href="/findings/templates"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#CBD5E1', cursor: 'pointer', textDecoration: 'none',
            }}
          >
            <Shield size={14} /> Templates
          </a>
          <button
            onClick={() => { setEditFinding(null); setShowModal(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
              border: 'none', color: '#fff', cursor: 'pointer',
            }}
          >
            <Plus size={14} /> New Finding
          </button>
        </div>
      </div>

      {/* Severity stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {statCards.map((s) => (
          <div
            key={s.label}
            onClick={() => setSeverityFilter(severityFilter === s.label.toLowerCase() ? '' : s.label.toLowerCase())}
            style={{
              background: severityFilter === s.label.toLowerCase() ? `${s.color}15` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${severityFilter === s.label.toLowerCase() ? s.color + '50' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10, padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: 4,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: '12px 16px', backdropFilter: 'blur(20px)',
        display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 200px', minWidth: 180 }}>
          <Search size={14} color="rgba(255,255,255,0.3)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search findings..."
            style={{ background: 'none', border: 'none', outline: 'none', flex: 1, color: '#F1F5F9', fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} color="rgba(255,255,255,0.3)" />
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={selectStyle}>
            <option value="">All Severities</option>
            {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={selectStyle}>
            <option value="">All Sources</option>
            {Object.entries(SOURCE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button onClick={loadFindings} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Findings Table */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, backdropFilter: 'blur(20px)', overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 90px 110px 90px 100px 90px 80px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 10 }}>
          {['Finding', 'Severity', 'Status', 'Source', 'Assigned', 'Due Date', 'Actions'].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: 8 }} />
            <div>Loading findings...</div>
          </div>
        ) : findings.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <ShieldAlert size={22} color="#8B5CF6" />
            </div>
            <div style={{ color: '#F1F5F9', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No findings found</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 }}>Create your first finding or import from a connected integration</div>
            <button
              onClick={() => { setEditFinding(null); setShowModal(true) }}
              style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Create Finding
            </button>
          </div>
        ) : (
          findings.map((f, i) => (
            <div
              key={f.id}
              onClick={() => { setEditFinding(f); setShowModal(true) }}
              style={{
                display: 'grid', gridTemplateColumns: '2.5fr 90px 110px 90px 100px 90px 80px',
                padding: '12px 16px', gap: 10, alignItems: 'center',
                borderBottom: i < findings.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Title */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#F1F5F9', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {f.title}
                  {f.cveId && (
                    <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, padding: '1px 5px', color: '#FCA5A5', fontWeight: 600 }}>
                      {f.cveId}
                    </span>
                  )}
                </div>
                {f.affectedAsset && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{f.affectedAsset}</div>
                )}
              </div>

              <div><SeverityBadge severity={f.severity} /></div>
              <div><StatusBadge status={f.status} /></div>
              <div><SourceBadge source={f.source} /></div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{f.assignedTo ? f.assignedTo.slice(0, 8) + '...' : 'Unassigned'}</div>
              <div style={{ fontSize: 11, color: f.dueDate && new Date(f.dueDate) < new Date() ? '#F97316' : 'rgba(255,255,255,0.4)' }}>{formatDate(f.dueDate)}</div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { setEditFinding(f); setShowModal(true) }}
                  title="View / Edit"
                  style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex' }}
                >
                  <Eye size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <FindingModal
          finding={editFinding}
          onClose={() => { setShowModal(false); setEditFinding(null) }}
          onSuccess={() => { setShowModal(false); setEditFinding(null); loadFindings(); showToast('Finding saved') }}
          onDelete={() => { setShowModal(false); setEditFinding(null); loadFindings(); showToast('Finding deleted') }}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: '#1A1F35', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '12px 16px', fontSize: 13,
          color: '#F1F5F9', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.2s ease',
        }}>
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

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#CBD5E1', cursor: 'pointer',
}
