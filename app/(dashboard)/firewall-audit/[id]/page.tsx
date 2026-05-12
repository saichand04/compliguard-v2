'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShieldOff, ArrowLeft, Plus, Search, Filter, RefreshCw,
  Calendar, Server, ChevronRight, AlertCircle, User,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FindingDrawer } from '@/components/firewall-audit/finding-drawer'
import { NewFindingDialog } from '@/components/firewall-audit/new-finding-dialog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FirewallAudit {
  id: string
  name: string
  device: string | null
  vendor: string | null
  auditType: string
  auditDate: string | null
  auditorName: string | null
  status: string
  scope: string | null
}

interface FirewallFinding {
  id: string
  title: string
  severity: string
  status: string
  ruleId: string | null
  affectedDevice: string | null
  affectedZone: string | null
  cvssScore: number | null
  assignedTo: string | null
  dueDate: string | null
  description: string | null
  riskDetails: string | null
  remediation: string | null
  createdAt: string
  updatedAt: string
}

interface FindingStats {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  open: number
  remediated: number
}

// ── Badge configs ─────────────────────────────────────────────────────────────

const SEVERITY_META: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#EF4444' },
  high:     { label: 'High',     color: '#F97316' },
  medium:   { label: 'Medium',   color: '#EAB308' },
  low:      { label: 'Low',      color: '#3B82F6' },
  info:     { label: 'Info',     color: '#94A3B8' },
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  open:         { label: 'Open',         color: '#EF4444' },
  in_progress:  { label: 'In Progress',  color: '#F59E0B' },
  remediated:   { label: 'Remediated',   color: '#10B981' },
  accepted:     { label: 'Accepted',     color: '#8B5CF6' },
  false_positive: { label: 'False Positive', color: '#94A3B8' },
}

const AUDIT_STATUS_META: Record<string, { label: string; color: string }> = {
  open:        { label: 'Open',        color: '#EF4444' },
  in_progress: { label: 'In Progress', color: '#F59E0B' },
  remediated:  { label: 'Remediated',  color: '#10B981' },
}

const AUDIT_TYPE_META: Record<string, { label: string; color: string }> = {
  perimeter: { label: 'Perimeter', color: '#3B82F6' },
  internal:  { label: 'Internal',  color: '#06B6D4' },
  cloud:     { label: 'Cloud',     color: '#8B5CF6' },
  waf:       { label: 'WAF',       color: '#F97316' },
  ngfw:      { label: 'NGFW',      color: '#10B981' },
  other:     { label: 'Other',     color: '#94A3B8' },
}

function SeverityBadge({ severity }: { severity: string }) {
  const meta = SEVERITY_META[severity] ?? { label: severity, color: '#94A3B8' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 20,
      background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
      color: meta.color, fontSize: 11, fontWeight: 700,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
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

function TypeBadge({ type }: { type: string }) {
  const meta = AUDIT_TYPE_META[type] ?? { label: type, color: '#94A3B8' }
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

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#CBD5E1', cursor: 'pointer',
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FirewallAuditDetailPage() {
  const params = useParams()
  const auditId = params.id as string

  const [audit, setAudit] = useState<FirewallAudit | null>(null)
  const [findings, setFindings] = useState<FirewallFinding[]>([])
  const [findingStats, setFindingStats] = useState<FindingStats>({ total: 0, critical: 0, high: 0, medium: 0, low: 0, open: 0, remediated: 0 })
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [selectedFinding, setSelectedFinding] = useState<FirewallFinding | null>(null)
  const [showNewFinding, setShowNewFinding] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const qp = new URLSearchParams()
      qp.set('auditId', auditId)
      if (search) qp.set('search', search)
      if (severityFilter) qp.set('severity', severityFilter)
      if (statusFilter) qp.set('status', statusFilter)

      const [auditRes, findingsRes, statsRes] = await Promise.allSettled([
        fetch(`/api/firewall-audit/audits/${auditId}`),
        fetch(`/api/firewall-audit/findings?${qp.toString()}`),
        fetch(`/api/firewall-audit/audits/${auditId}/stats`),
      ])

      if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
        const data = await auditRes.value.json()
        setAudit(data.audit ?? data)
      }
      if (findingsRes.status === 'fulfilled' && findingsRes.value.ok) {
        const data = await findingsRes.value.json()
        setFindings(Array.isArray(data.findings) ? data.findings : Array.isArray(data) ? data : [])
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const data = await statsRes.value.json()
        setFindingStats(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [auditId, search, severityFilter, statusFilter])

  useEffect(() => { loadData() }, [loadData])

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const auditStatusMeta = audit ? (AUDIT_STATUS_META[audit.status] ?? { label: audit.status, color: '#94A3B8' }) : null

  const statCards = [
    { label: 'Total',      value: findingStats.total,      color: '#94A3B8' },
    { label: 'Critical',   value: findingStats.critical,   color: '#EF4444' },
    { label: 'High',       value: findingStats.high,       color: '#F97316' },
    { label: 'Medium',     value: findingStats.medium,     color: '#EAB308' },
    { label: 'Low',        value: findingStats.low,        color: '#3B82F6' },
    { label: 'Open',       value: findingStats.open,       color: '#F97316' },
    { label: 'Remediated', value: findingStats.remediated, color: '#10B981' },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 13 }}>
        <Link href="/firewall-audit" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ArrowLeft size={14} />
          Firewall Audit
        </Link>
        <ChevronRight size={13} color="rgba(255,255,255,0.25)" />
        <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
          {audit?.name ?? '…'}
        </span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
              {audit?.name ?? 'Loading…'}
            </h1>
            {auditStatusMeta && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: `${auditStatusMeta.color}18`, border: `1px solid ${auditStatusMeta.color}40`,
                color: auditStatusMeta.color,
              }}>
                {auditStatusMeta.label}
              </span>
            )}
            {audit?.auditType && <TypeBadge type={audit.auditType} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'rgba(255,255,255,0.45)' }}>
            {audit?.device && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Server size={12} /> {audit.device}
              </span>
            )}
            {audit?.vendor && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {audit.vendor}
              </span>
            )}
            {audit?.auditDate && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={12} />
                {formatDate(audit.auditDate)}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowNewFinding(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
            border: 'none', color: '#fff', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Finding
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {statCards.map((s) => (
          <div
            key={s.label}
            onClick={() => {
              if (s.label === 'Critical') setSeverityFilter('critical')
              else if (s.label === 'High') setSeverityFilter('high')
              else if (s.label === 'Medium') setSeverityFilter('medium')
              else if (s.label === 'Low') setSeverityFilter('low')
              else if (s.label === 'Open') setStatusFilter('open')
              else if (s.label === 'Remediated') setStatusFilter('remediated')
              else { setSeverityFilter(''); setStatusFilter('') }
            }}
            style={{
              background: `${s.color}10`, border: `1px solid ${s.color}30`,
              borderRadius: 8, padding: '10px 14px',
              display: 'flex', flexDirection: 'column', gap: 2,
              cursor: 'pointer', transition: 'all 0.15s', minWidth: 70,
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: '12px 16px', backdropFilter: 'blur(20px)',
        display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 180px', minWidth: 160 }}>
          <Search size={14} color="rgba(255,255,255,0.3)" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search findings..."
            style={{ background: 'none', border: 'none', outline: 'none', flex: 1, color: '#F1F5F9', fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Filter size={13} color="rgba(255,255,255,0.3)" />
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={selectStyle}>
            <option value="">All Severities</option>
            {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button onClick={loadData} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Findings table */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '110px 2fr 110px 160px 80px 130px 110px 100px 80px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 10 }}>
          {['Severity', 'Title', 'Rule ID', 'Device / Zone', 'CVSS', 'Status', 'Assignee', 'Due Date', 'Actions'].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: 8 }} />
            <div>Loading findings...</div>
          </div>
        ) : findings.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <AlertCircle size={22} color="#3B82F6" />
            </div>
            <div style={{ color: '#F1F5F9', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No findings found</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 }}>Add findings manually to this audit</div>
            <button onClick={() => setShowNewFinding(true)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #3B82F6, #2563EB)', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <Plus size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />Add Finding
            </button>
          </div>
        ) : (
          findings.map((finding, i) => (
            <div
              key={finding.id}
              onClick={() => setSelectedFinding(finding)}
              style={{
                display: 'grid', gridTemplateColumns: '110px 2fr 110px 160px 80px 130px 110px 100px 80px',
                padding: '12px 16px', gap: 10, alignItems: 'center',
                borderBottom: i < findings.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div><SeverityBadge severity={finding.severity} /></div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#F1F5F9', marginBottom: 1 }}>{finding.title}</div>
              </div>

              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {finding.ruleId ?? '—'}
              </div>

              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[finding.affectedDevice, finding.affectedZone].filter(Boolean).join(' / ') || '—'}
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 600, color: finding.cvssScore !== null ? (finding.cvssScore >= 9 ? '#EF4444' : finding.cvssScore >= 7 ? '#F97316' : finding.cvssScore >= 4 ? '#EAB308' : '#10B981') : 'rgba(255,255,255,0.3)' }}>
                {finding.cvssScore !== null ? finding.cvssScore.toFixed(1) : '—'}
              </div>

              <div><StatusBadge status={finding.status} /></div>

              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 5 }}>
                {finding.assignedTo ? (
                  <><User size={11} color="rgba(255,255,255,0.25)" />{finding.assignedTo.slice(0, 12)}{finding.assignedTo.length > 12 ? '…' : ''}</>
                ) : <span style={{ color: 'rgba(255,255,255,0.2)' }}>Unassigned</span>}
              </div>

              <div style={{ fontSize: 11, color: finding.dueDate && new Date(finding.dueDate) < new Date() ? '#F97316' : 'rgba(255,255,255,0.4)' }}>
                {formatDate(finding.dueDate)}
              </div>

              <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setSelectedFinding(finding)}
                  style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', fontSize: 12 }}
                >
                  View
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Finding Drawer */}
      {selectedFinding && (
        <FindingDrawer
          finding={selectedFinding}
          onClose={() => setSelectedFinding(null)}
          onUpdate={() => { loadData(); showToast('Finding updated') }}
        />
      )}

      {showNewFinding && (
        <NewFindingDialog
          auditId={auditId}
          onClose={() => setShowNewFinding(false)}
          onSuccess={() => { setShowNewFinding(false); loadData(); showToast('Finding created') }}
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
