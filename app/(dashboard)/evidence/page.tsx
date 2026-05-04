'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Upload, Search, Filter, Download, Trash2, RefreshCw,
  FileText, Image, Archive, Shield, MessageSquare, File, Clock,
  CheckCircle2, AlertTriangle, XCircle, Plus, Send, Loader2, X,
} from 'lucide-react'
import { EvidenceUploadModal } from '@/components/evidence/upload-modal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EvidenceItem {
  id: string
  title: string
  description: string | null
  evidenceType: string
  status: string
  fileName: string | null
  fileSize: number | null
  uploadedBy: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

interface EvidenceStats {
  total: number
  pendingReview: number
  approved: number
  expiringSoon: number
}

// ── Badge configs ──────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  screenshot:    { label: 'Screenshot',      color: '#3B82F6', Icon: Image },
  document:      { label: 'Policy Doc',      color: '#8B5CF6', Icon: FileText },
  configuration: { label: 'Config Export',   color: '#06B6D4', Icon: Archive },
  automated:     { label: 'Attestation',     color: '#10B981', Icon: Shield },
  log:           { label: 'Interview Notes', color: '#F59E0B', Icon: MessageSquare },
  text:          { label: 'Text',            color: '#94A3B8', Icon: File },
  video:         { label: 'Video',           color: '#EC4899', Icon: File },
}

const STATUS_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  pending:  { label: 'Pending Review', color: '#EAB308', Icon: Clock },
  approved: { label: 'Approved',       color: '#10B981', Icon: CheckCircle2 },
  rejected: { label: 'Rejected',       color: '#EF4444', Icon: XCircle },
  expired:  { label: 'Expired',        color: '#F97316', Icon: AlertTriangle },
}

function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? { label: type, color: '#94A3B8', Icon: File }
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

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: '#94A3B8', Icon: File }
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

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [stats, setStats] = useState<EvidenceStats>({ total: 0, pendingReview: 0, approved: 0, expiringSoon: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadEvidence = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/evidence?${params.toString()}`)
      if (!res.ok) return
      const data = await res.json()
      setEvidence(Array.isArray(data.evidence) ? data.evidence : [])
      if (data.stats) setStats(data.stats)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, statusFilter])

  useEffect(() => {
    loadEvidence()
  }, [loadEvidence])

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this evidence? This cannot be undone.')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/evidence/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setEvidence((prev) => prev.filter((e) => e.id !== id))
        setStats((prev) => ({ ...prev, total: prev.total - 1 }))
        showToast('Evidence deleted')
      } else {
        showToast('Failed to delete evidence')
      }
    } catch {
      showToast('Network error')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDownload(item: EvidenceItem) {
    if (!item.fileName) { showToast('No file attached to this evidence'); return }
    window.open(`/api/evidence/${item.id}/download`, '_blank')
  }

  const statCards = [
    { label: 'Total Evidence', value: stats.total, color: '#8B5CF6', icon: <FileText size={18} color="#8B5CF6" /> },
    { label: 'Pending Review', value: stats.pendingReview, color: '#EAB308', icon: <Clock size={18} color="#EAB308" /> },
    { label: 'Approved', value: stats.approved, color: '#10B981', icon: <CheckCircle2 size={18} color="#10B981" /> },
    { label: 'Expiring Soon', value: stats.expiringSoon, color: '#F97316', icon: <AlertTriangle size={18} color="#F97316" /> },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
            Evidence Library
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
            Manage compliance evidence, attestations, and supporting documentation
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowRequestModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#CBD5E1', cursor: 'pointer',
            }}
          >
            <Send size={14} /> Request Evidence
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
              border: 'none', color: '#fff', cursor: 'pointer',
            }}
          >
            <Upload size={14} /> Upload Evidence
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {statCards.map((s) => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '14px 16px', backdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: `${s.color}12`, border: `1px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.label}</div>
            </div>
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
            placeholder="Search evidence..."
            style={{
              background: 'none', border: 'none', outline: 'none', flex: 1,
              color: '#F1F5F9', fontSize: 13,
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} color="rgba(255,255,255,0.3)" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#CBD5E1', cursor: 'pointer' }}
          >
            <option value="">All Types</option>
            {Object.entries(TYPE_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#CBD5E1', cursor: 'pointer' }}
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={loadEvidence}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Evidence Table */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, backdropFilter: 'blur(20px)', overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 100px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 12 }}>
          {['Title', 'Type', 'Status', 'Uploaded', 'Expires', 'Actions'].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: 8 }} />
            <div>Loading evidence...</div>
          </div>
        ) : evidence.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <FileText size={22} color="#8B5CF6" />
            </div>
            <div style={{ color: '#F1F5F9', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No evidence found</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 }}>Upload your first evidence item to get started</div>
            <button
              onClick={() => setShowUploadModal(true)}
              style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Upload Evidence
            </button>
          </div>
        ) : (
          evidence.map((item, i) => (
            <div
              key={item.id}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 100px',
                padding: '12px 16px', gap: 12, alignItems: 'center',
                borderBottom: i < evidence.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Title */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#F1F5F9', marginBottom: 2 }}>{item.title}</div>
                {item.fileName && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <File size={9} /> {item.fileName} {item.fileSize ? `(${formatBytes(item.fileSize)})` : ''}
                  </div>
                )}
              </div>

              {/* Type */}
              <div><TypeBadge type={item.evidenceType} /></div>

              {/* Status */}
              <div><StatusBadge status={item.status} /></div>

              {/* Uploaded */}
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{formatDate(item.createdAt)}</div>

              {/* Expires */}
              <div style={{ fontSize: 12, color: item.expiresAt && new Date(item.expiresAt) < new Date() ? '#F97316' : 'rgba(255,255,255,0.5)' }}>
                {formatDate(item.expiresAt)}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => handleDownload(item)}
                  title="Download"
                  style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex' }}
                >
                  <Download size={13} />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  title="Delete"
                  style={{ padding: 6, borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', color: '#FCA5A5', display: 'flex' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <EvidenceUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => { setShowUploadModal(false); loadEvidence() }}
        />
      )}

      {/* Request Evidence Modal */}
      {showRequestModal && (
        <RequestEvidenceModal
          onClose={() => setShowRequestModal(false)}
          onSuccess={(email) => { setShowRequestModal(false); showToast(`Request sent to ${email}`) }}
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

// ── Request Evidence Modal ─────────────────────────────────────────────────────

interface RequestEvidenceModalProps {
  onClose: () => void
  onSuccess: (email: string) => void
}

function RequestEvidenceModal({ onClose, onSuccess }: RequestEvidenceModalProps) {
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [expiryDays, setExpiryDays] = useState('7')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipientEmail || !title) {
      setError('Recipient email and title are required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/evidence-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail, recipientName, title, description, expiryDays: Number(expiryDays) }),
      })
      if (res.ok) {
        onSuccess(recipientEmail)
      } else {
        const data = await res.json() as { error?: string }
        setError(data.error || 'Failed to send request.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const fieldStyle = {
    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '9px 12px', color: '#F1F5F9', fontSize: 13, outline: 'none',
  } as React.CSSProperties

  const labelStyle = { display: 'block', fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 6 } as React.CSSProperties

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#141828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
        width: '100%', maxWidth: 500, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        animation: 'fadeIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Send size={15} color="#60A5FA" />
            </div>
            <div>
              <h3 style={{ margin: 0, color: 'white', fontSize: 15, fontWeight: 700 }}>Request Evidence</h3>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Send a secure upload link to a recipient</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Recipient Email *</label>
              <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="user@example.com" style={fieldStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Recipient Name <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>(optional)</span></label>
              <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="John Doe" style={fieldStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Evidence Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SOC 2 Access Control Policy" style={fieldStyle} required />
          </div>

          <div>
            <label style={labelStyle}>Description <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what evidence is needed and why..."
              rows={3}
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ maxWidth: 180 }}>
            <label style={labelStyle}>Link Expiry</label>
            <select value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
              <option value="3">3 days</option>
              <option value="7">7 days (default)</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </div>

          {error && (
            <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', color: '#F87171', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#1D4ED8,#2563EB)', border: 'none', color: 'white', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
              {submitting ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
