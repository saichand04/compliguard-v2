'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Globe, ArrowLeft, Plus, Search, Filter, RefreshCw,
  Calendar, ChevronRight, AlertCircle, User,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { IssueDrawer } from '@/components/dns-audit/issue-drawer'
import { NewIssueDialog } from '@/components/dns-audit/new-issue-dialog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DnsAudit {
  id: string
  name: string
  domain: string | null
  auditType: string
  auditDate: string | null
  auditorName: string | null
  status: string
  scope: string | null
}

interface DnsIssue {
  id: string
  title: string
  severity: string
  status: string
  issueType: string
  affectedRecord: string | null
  recordType: string | null
  currentValue: string | null
  expectedValue: string | null
  assignedTo: string | null
  dueDate: string | null
  description: string | null
  riskDetails: string | null
  remediation: string | null
  createdAt: string
  updatedAt: string
}

interface IssueStats {
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
  open:           { label: 'Open',           color: '#EF4444' },
  in_progress:    { label: 'In Progress',    color: '#F59E0B' },
  remediated:     { label: 'Remediated',     color: '#10B981' },
  accepted:       { label: 'Accepted',       color: '#8B5CF6' },
  false_positive: { label: 'False Positive', color: '#94A3B8' },
}

const AUDIT_STATUS_META: Record<string, { label: string; color: string }> = {
  open:        { label: 'Open',        color: '#EF4444' },
  in_progress: { label: 'In Progress', color: '#F59E0B' },
  remediated:  { label: 'Remediated',  color: '#10B981' },
}

const AUDIT_TYPE_META: Record<string, { label: string; color: string }> = {
  external: { label: 'External', color: '#3B82F6' },
  internal: { label: 'Internal', color: '#06B6D4' },
  both:     { label: 'Both',     color: '#8B5CF6' },
}

const ISSUE_TYPE_META: Record<string, { label: string; color: string }> = {
  misconfiguration:   { label: 'Misconfiguration',    color: '#EF4444' },
  dangling_record:    { label: 'Dangling Record',     color: '#F97316' },
  missing_spf:        { label: 'Missing SPF',         color: '#F59E0B' },
  missing_dmarc:      { label: 'Missing DMARC',       color: '#F59E0B' },
  missing_dkim:       { label: 'Missing DKIM',        color: '#F59E0B' },
  zone_transfer:      { label: 'Zone Transfer',       color: '#EF4444' },
  subdomain_takeover: { label: 'Subdomain Takeover',  color: '#EF4444' },
  cache_poisoning:    { label: 'Cache Poisoning',     color: '#F97316' },
  wildcard_record:    { label: 'Wildcard Record',     color: '#3B82F6' },
  other:              { label: 'Other',               color: '#94A3B8' },
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

function TypeBadge({ type, meta }: { type: string; meta: Record<string, { label: string; color: string }> }) {
  const m = meta[type] ?? { label: type, color: '#94A3B8' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 6,
      background: `${m.color}14`, border: `1px solid ${m.color}35`,
      color: m.color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {m.label}
    </span>
  )
}

function IssueTypeBadge({ type }: { type: string }) {
  const meta = ISSUE_TYPE_META[type] ?? { label: type, color: '#94A3B8' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: 5,
      background: `${meta.color}14`, border: `1px solid ${meta.color}35`,
      color: meta.color, fontSize: 10, fontWeight: 600, letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
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

export default function DnsAuditDetailPage() {
  const params = useParams()
  const auditId = params.id as string

  const [audit, setAudit] = useState<DnsAudit | null>(null)
  const [issues, setIssues] = useState<DnsIssue[]>([])
  const [issueStats, setIssueStats] = useState<IssueStats>({ total: 0, critical: 0, high: 0, medium: 0, low: 0, open: 0, remediated: 0 })
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [issueTypeFilter, setIssueTypeFilter] = useState('')

  const [selectedIssue, setSelectedIssue] = useState<DnsIssue | null>(null)
  const [showNewIssue, setShowNewIssue] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const qp = new URLSearchParams()
      qp.set('auditId', auditId)
      if (search) qp.set('search', search)
      if (severityFilter) qp.set('severity', severityFilter)
      if (statusFilter) qp.set('status', statusFilter)
      if (issueTypeFilter) qp.set('issueType', issueTypeFilter)

      const [auditRes, issuesRes, statsRes] = await Promise.allSettled([
        fetch(`/api/dns-audit/audits/${auditId}`),
        fetch(`/api/dns-audit/issues?${qp.toString()}`),
        fetch(`/api/dns-audit/audits/${auditId}/stats`),
      ])

      if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
        const data = await auditRes.value.json()
        setAudit(data.audit ?? data)
      }
      if (issuesRes.status === 'fulfilled' && issuesRes.value.ok) {
        const data = await issuesRes.value.json()
        setIssues(Array.isArray(data.issues) ? data.issues : Array.isArray(data) ? data : [])
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const data = await statsRes.value.json()
        setIssueStats(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [auditId, search, severityFilter, statusFilter, issueTypeFilter])

  useEffect(() => { loadData() }, [loadData])

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const auditStatusMeta = audit ? (AUDIT_STATUS_META[audit.status] ?? { label: audit.status, color: '#94A3B8' }) : null

  const statCards = [
    { label: 'Total',      value: issueStats.total,      color: '#94A3B8' },
    { label: 'Critical',   value: issueStats.critical,   color: '#EF4444' },
    { label: 'High',       value: issueStats.high,       color: '#F97316' },
    { label: 'Medium',     value: issueStats.medium,     color: '#EAB308' },
    { label: 'Low',        value: issueStats.low,        color: '#3B82F6' },
    { label: 'Open',       value: issueStats.open,       color: '#F97316' },
    { label: 'Remediated', value: issueStats.remediated, color: '#10B981' },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 13 }}>
        <Link href="/dns-audit" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ArrowLeft size={14} />
          DNS Audit
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
            {audit?.auditType && <TypeBadge type={audit.auditType} meta={AUDIT_TYPE_META} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'rgba(255,255,255,0.45)' }}>
            {audit?.domain && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Globe size={12} /> {audit.domain}
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
          onClick={() => setShowNewIssue(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'linear-gradient(135deg, #10B981, #059669)',
            border: 'none', color: '#fff', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Issue
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
            placeholder="Search issues..."
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
          <select value={issueTypeFilter} onChange={(e) => setIssueTypeFilter(e.target.value)} style={selectStyle}>
            <option value="">All Issue Types</option>
            {Object.entries(ISSUE_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button onClick={loadData} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Issues table */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '110px 2fr 150px 160px 100px 130px 110px 100px 80px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 10 }}>
          {['Severity', 'Title', 'Issue Type', 'Affected Record', 'Rec. Type', 'Status', 'Assignee', 'Due Date', 'Actions'].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: 8 }} />
            <div>Loading issues...</div>
          </div>
        ) : issues.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <AlertCircle size={22} color="#10B981" />
            </div>
            <div style={{ color: '#F1F5F9', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No issues found</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 }}>Add DNS issues to this audit</div>
            <button onClick={() => setShowNewIssue(true)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <Plus size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />Add Issue
            </button>
          </div>
        ) : (
          issues.map((issue, i) => (
            <div
              key={issue.id}
              onClick={() => setSelectedIssue(issue)}
              style={{
                display: 'grid', gridTemplateColumns: '110px 2fr 150px 160px 100px 130px 110px 100px 80px',
                padding: '12px 16px', gap: 10, alignItems: 'center',
                borderBottom: i < issues.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div><SeverityBadge severity={issue.severity} /></div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#F1F5F9', marginBottom: 1 }}>{issue.title}</div>
              </div>

              <div><IssueTypeBadge type={issue.issueType} /></div>

              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {issue.affectedRecord ?? '—'}
              </div>

              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>
                {issue.recordType ?? '—'}
              </div>

              <div><StatusBadge status={issue.status} /></div>

              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 5 }}>
                {issue.assignedTo ? (
                  <><User size={11} color="rgba(255,255,255,0.25)" />{issue.assignedTo.slice(0, 12)}{issue.assignedTo.length > 12 ? '…' : ''}</>
                ) : <span style={{ color: 'rgba(255,255,255,0.2)' }}>Unassigned</span>}
              </div>

              <div style={{ fontSize: 11, color: issue.dueDate && new Date(issue.dueDate) < new Date() ? '#F97316' : 'rgba(255,255,255,0.4)' }}>
                {formatDate(issue.dueDate)}
              </div>

              <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setSelectedIssue(issue)}
                  style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', fontSize: 12 }}
                >
                  View
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Issue Drawer */}
      {selectedIssue && (
        <IssueDrawer
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onUpdate={() => { loadData(); showToast('Issue updated') }}
        />
      )}

      {showNewIssue && (
        <NewIssueDialog
          auditId={auditId}
          onClose={() => setShowNewIssue(false)}
          onSuccess={() => { setShowNewIssue(false); loadData(); showToast('Issue created') }}
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
