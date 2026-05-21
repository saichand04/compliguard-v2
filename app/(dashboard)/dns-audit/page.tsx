'use client'

import { ModuleGuard } from '@/components/module-guard'
import { useState, useEffect, useCallback } from 'react'
import {
  Globe, Plus, Search, Filter, RefreshCw,
  ChevronRight, Calendar, AlertCircle,
  CheckCircle2, Activity, Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { NewAuditDialog } from '@/components/dns-audit/new-audit-dialog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DnsAudit {
  id: string
  name: string
  domain: string | null
  auditType: string
  auditDate: string | null
  status: string
  totalIssues: number
  openIssues: number
  criticalIssues: number
  createdAt: string
}

interface DnsAuditStats {
  totalIssues: number
  openIssues: number
  remediatedIssues: number
  criticalIssues: number
}

// ── Badge configs ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open:        { label: 'Open',        color: '#EF4444', icon: AlertCircle },
  in_progress: { label: 'In Progress', color: '#F59E0B', icon: Activity },
  remediated:  { label: 'Remediated',  color: '#10B981', icon: CheckCircle2 },
}

const AUDIT_TYPE_META: Record<string, { label: string; color: string }> = {
  external: { label: 'External', color: '#3B82F6' },
  internal: { label: 'Internal', color: '#06B6D4' },
  both:     { label: 'Both',     color: '#8B5CF6' },
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: '#94A3B8', icon: AlertCircle }
  const Icon = meta.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20,
      background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
      color: meta.color, fontSize: 11, fontWeight: 600,
    }}>
      <Icon size={10} />
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

function DnsAuditPageInner() {
  const [audits, setAudits] = useState<DnsAudit[]>([])
  const [stats, setStats] = useState<DnsAuditStats>({ totalIssues: 0, openIssues: 0, remediatedIssues: 0, criticalIssues: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showNewAudit, setShowNewAudit] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('type', typeFilter)

      const [auditsRes, statsRes] = await Promise.allSettled([
        fetch(`/api/dns-audit/audits?${params.toString()}`),
        fetch('/api/dns-audit/stats'),
      ])

      if (auditsRes.status === 'fulfilled' && auditsRes.value.ok) {
        const data = await auditsRes.value.json()
        setAudits(Array.isArray(data.audits) ? data.audits : Array.isArray(data) ? data : [])
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const data = await statsRes.value.json()
        setStats(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, typeFilter])

  useEffect(() => { loadData() }, [loadData])

  // Fetch role once on mount for super_admin actions
  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user?.role) setUserRole(d.user.role) })
      .catch(() => {})
  }, [])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its issues? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/dns-audit/audits/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      showToast('Audit deleted')
      await loadData()
    } catch {
      showToast('Failed to delete audit')
    } finally {
      setDeletingId(null)
    }
  }

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const statCards = [
    { label: 'Total Issues', value: stats.totalIssues,     color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)' },
    { label: 'Open',         value: stats.openIssues,      color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)'   },
    { label: 'Remediated',   value: stats.remediatedIssues, color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
    { label: 'Critical',     value: stats.criticalIssues,  color: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)'  },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Globe size={18} color="#10B981" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
              DNS Audit
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              Manage DNS audits and track misconfigurations
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowNewAudit(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'linear-gradient(135deg, #10B981, #059669)',
            border: 'none', color: '#fff', cursor: 'pointer',
            boxShadow: '0 0 20px rgba(16,185,129,0.3)',
          }}
        >
          <Plus size={14} /> New Audit
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {statCards.map((s) => (
          <div key={s.label} style={{
            background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '16px 18px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
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
            placeholder="Search audits..."
            style={{ background: 'none', border: 'none', outline: 'none', flex: 1, color: '#F1F5F9', fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} color="rgba(255,255,255,0.3)" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
            <option value="">All Types</option>
            {Object.entries(AUDIT_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button onClick={loadData} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 110px 130px 140px 80px 80px 130px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 10 }}>
          {['Name', 'Type', 'Audit Date', 'Status', 'Issues', 'Open', 'Actions'].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: 8 }} />
            <div>Loading audits...</div>
          </div>
        ) : audits.length === 0 ? (
          <div style={{ padding: '56px 20px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Globe size={24} color="#10B981" />
            </div>
            <div style={{ color: '#F1F5F9', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No audits found</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 20 }}>
              Create your first DNS audit to get started
            </div>
            <button
              onClick={() => setShowNewAudit(true)}
              style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Create Audit
            </button>
          </div>
        ) : (
          audits.map((audit, i) => (
            <div
              key={audit.id}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 110px 130px 140px 80px 80px 130px',
                padding: '13px 16px', gap: 10, alignItems: 'center',
                borderBottom: i < audits.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Name */}
              <Link href={`/dns-audit/${audit.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F1F5F9', marginBottom: 2 }}>{audit.name}</div>
              </Link>

              {/* Type */}
              <div><TypeBadge type={audit.auditType} /></div>

              {/* Audit Date */}
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={11} color="rgba(255,255,255,0.25)" />
                {formatDate(audit.auditDate)}
              </div>

              {/* Status */}
              <div><StatusBadge status={audit.status} /></div>

              {/* Issues */}
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>{audit.totalIssues}</div>

              {/* Open */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#EF4444' }}>{audit.openIssues}</span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                <Link
                  href={`/dns-audit/${audit.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, lineHeight: 1,
                    padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 500,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#CBD5E1', textDecoration: 'none',
                  }}
                >
                  View <ChevronRight size={11} />
                </Link>
                {userRole === 'super_admin' && (
                  <button
                    onClick={() => void handleDelete(audit.id, audit.name)}
                    disabled={deletingId === audit.id}
                    title="Delete audit"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(239,68,68,0.25)',
                      background: 'rgba(239,68,68,0.08)', color: '#EF4444',
                      cursor: deletingId === audit.id ? 'not-allowed' : 'pointer',
                      opacity: deletingId === audit.id ? 0.5 : 1,
                      transition: 'all 0.15s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)' }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dialogs */}
      {showNewAudit && (
        <NewAuditDialog
          onClose={() => setShowNewAudit(false)}
          onSuccess={() => { setShowNewAudit(false); loadData(); showToast('Audit created') }}
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

export default function DnsAuditPage() {
  return (
    <ModuleGuard moduleKey="dnsAudit" label="DNS Audit">
      <DnsAuditPageInner />
    </ModuleGuard>
  )
}
