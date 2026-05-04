'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Search, Plus, Shield, AlertTriangle,
  CheckCircle2, Clock, XCircle, ExternalLink, ChevronRight,
  Filter,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Vendor {
  id: string
  name: string
  website: string | null
  contactName: string | null
  contactEmail: string | null
  category: string | null
  description: string | null
  status: 'active' | 'inactive' | 'under_review' | 'terminated'
  inherentRiskLevel: 'low' | 'medium' | 'high' | 'critical' | null
  residualRiskLevel: 'low' | 'medium' | 'high' | 'critical' | null
  riskScore: number | null
  dpaStatus: string | null
  dpaSignedAt: string | null
  nextReviewDate: string | null
  ownerId: string | null
  createdAt: string
  updatedAt: string
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  critical: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: '#EF4444' },
  high:     { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)', text: '#F97316' },
  medium:   { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)', text: '#EAB308' },
  low:      { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', text: '#22C55E' },
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  active:       { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', text: '#22C55E', label: 'Active' },
  inactive:     { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)', text: '#94A3B8', label: 'Inactive' },
  under_review: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)', text: '#EAB308', label: 'Under Review' },
  terminated:   { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: '#EF4444', label: 'Terminated' },
}

const DPA_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  signed:       { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', text: '#22C55E', label: 'Signed' },
  pending:      { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)', text: '#EAB308', label: 'Pending' },
  not_required: { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)', text: '#94A3B8', label: 'Not Required' },
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
  const c = RISK_COLORS[level] ?? RISK_COLORS.low
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 20,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.text, fontSize: 11, fontWeight: 600,
      textTransform: 'capitalize',
    }}>
      {level}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.inactive
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 20,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.text, fontSize: 11, fontWeight: 600,
    }}>
      {c.label}
    </span>
  )
}

function DpaBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
  const c = DPA_COLORS[status] ?? DPA_COLORS.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 20,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.text, fontSize: 11, fontWeight: 600,
    }}>
      {c.label}
    </span>
  )
}

function RiskScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
  const color = score >= 75 ? '#EF4444' : score >= 50 ? '#F97316' : score >= 25 ? '#EAB308' : '#22C55E'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 48, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600, minWidth: 24 }}>{score}</span>
    </div>
  )
}

// ── Add Vendor Modal ──────────────────────────────────────────────────────────

function AddVendorModal({ onClose, onCreated }: { onClose: () => void; onCreated: (v: Vendor) => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [website, setWebsite] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category: category || undefined, website: website || undefined, contactName: contactName || undefined, contactEmail: contactEmail || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create vendor')
      onCreated(data.vendor)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#0F1629', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: 28, width: 460, maxWidth: '90vw',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={15} style={{ color: '#8B5CF6' }} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Add Vendor</h2>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Vendor Name *</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="e.g. Acme Cloud Services"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Category</label>
              <input
                value={category} onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Cloud, SaaS"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Website</label>
              <input
                value={website} onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Contact Name</label>
              <input
                value={contactName} onChange={(e) => setContactName(e.target.value)}
                placeholder="Jane Doe"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Contact Email</label>
              <input
                value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                placeholder="jane@vendor.com"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {error && <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Creating…' : 'Create Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)

  const loadVendors = useCallback(() => {
    setLoading(true)
    fetch('/api/vendors')
      .then((r) => r.json())
      .then((data) => setVendors(Array.isArray(data.vendors) ? data.vendors : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadVendors() }, [loadVendors])

  const filtered = vendors.filter((v) => {
    const q = search.toLowerCase()
    if (q && !v.name.toLowerCase().includes(q) && !(v.category ?? '').toLowerCase().includes(q) && !(v.contactName ?? '').toLowerCase().includes(q)) return false
    if (statusFilter !== 'all' && v.status !== statusFilter) return false
    if (riskFilter !== 'all' && v.inherentRiskLevel !== riskFilter) return false
    return true
  })

  const stats = {
    total: vendors.length,
    active: vendors.filter((v) => v.status === 'active').length,
    critical: vendors.filter((v) => v.inherentRiskLevel === 'critical').length,
    review: vendors.filter((v) => v.status === 'under_review').length,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.07em',
  }

  const thStyle: React.CSSProperties = {
    padding: '8px 14px', fontSize: 11, fontWeight: 700,
    color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.06em', textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    verticalAlign: 'middle',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={15} style={{ color: '#8B5CF6' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Vendor Register</h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Track third-party vendors and their risk profiles</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href="/vendors/questionnaires" style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={13} /> Questionnaires
            </a>
            <button
              onClick={() => setShowAddModal(true)}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} /> Add Vendor
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          {[
            { label: 'Total Vendors', value: stats.total, color: 'var(--text-primary)' },
            { label: 'Active', value: stats.active, color: '#22C55E' },
            { label: 'Critical Risk', value: stats.critical, color: '#EF4444' },
            { label: 'Under Review', value: stats.review, color: '#EAB308' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={labelStyle}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative', maxWidth: 320 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendors…"
              style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={13} style={{ color: 'var(--text-muted)' }} />
            <select
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="under_review">Under Review</option>
              <option value="terminated">Terminated</option>
            </select>
            <select
              value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading vendors…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Building2 size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <p style={{ fontSize: 14, margin: '0 0 8px' }}>{vendors.length === 0 ? 'No vendors yet' : 'No vendors match your filters'}</p>
            {vendors.length === 0 && (
              <button onClick={() => setShowAddModal(true)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Add your first vendor
              </button>
            )}
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', marginTop: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Vendor</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Inherent Risk</th>
                  <th style={thStyle}>Residual Risk</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>DPA</th>
                  <th style={thStyle}>Next Review</th>
                  <th style={{ ...thStyle, width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => router.push(`/vendors/${v.id}`)}
                    style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdStyle, minWidth: 180 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{v.name}</div>
                        {v.category && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{v.category}</div>}
                      </div>
                    </td>
                    <td style={tdStyle}><StatusBadge status={v.status} /></td>
                    <td style={tdStyle}><RiskBadge level={v.inherentRiskLevel} /></td>
                    <td style={tdStyle}><RiskBadge level={v.residualRiskLevel} /></td>
                    <td style={tdStyle}><RiskScoreBar score={v.riskScore} /></td>
                    <td style={tdStyle}><DpaBadge status={v.dpaStatus} /></td>
                    <td style={tdStyle}>
                      {v.nextReviewDate
                        ? new Date(v.nextReviewDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>
                      <ChevronRight size={14} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddVendorModal
          onClose={() => setShowAddModal(false)}
          onCreated={(v) => {
            setVendors((prev) => [v, ...prev])
            setShowAddModal(false)
            router.push(`/vendors/${v.id}`)
          }}
        />
      )}
    </div>
  )
}
