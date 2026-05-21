'use client'

import { useState } from 'react'
import { X, RefreshCw, Globe } from 'lucide-react'

interface NewAuditDialogProps {
  onClose: () => void
  onSuccess: () => void
}

const AUDIT_TYPES = [
  { value: 'external', label: 'External' },
  { value: 'internal', label: 'Internal' },
  { value: 'both',     label: 'Both' },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: '#E2E8F0',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'rgba(255,255,255,0.5)',
  marginBottom: 6,
}

export function NewAuditDialog({ onClose, onSuccess }: NewAuditDialogProps) {
  const [form, setForm] = useState({
    name: '',
    auditType: 'external',
    scope: '',
    auditDate: '',
    auditorName: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Audit name is required'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/dns-audit/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          auditType: form.auditType,
          scope: form.scope.trim() || null,
          auditDate: form.auditDate || null,
          auditorName: form.auditorName.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to create audit')
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Backdrop — no onClick so accidental outside clicks don't close */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />

      {/* Dialog */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 520,
        background: '#12121a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        zIndex: 201,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'dialogIn 0.2s cubic-bezier(0.4,0,0.2,1)',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={15} color="#10B981" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>New DNS Audit</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>Create a new DNS audit record</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ padding: 7, borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Name */}
            <div>
              <label style={labelStyle}>Audit Name <span style={{ color: '#EF4444' }}>*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="e.g. Q3 2024 External DNS Audit"
                style={inputStyle}
                autoFocus
              />
            </div>

            {/* Audit Type */}
            <div>
              <label style={labelStyle}>Audit Type</label>
              <select
                value={form.auditType}
                onChange={e => handleChange('auditType', e.target.value)}
                style={inputStyle}
              >
                {AUDIT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Scope */}
            <div>
              <label style={labelStyle}>Scope</label>
              <textarea
                value={form.scope}
                onChange={e => handleChange('scope', e.target.value)}
                placeholder="Describe the scope of this DNS audit..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            {/* Audit Date + Auditor */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Audit Date</label>
                <input
                  type="date"
                  value={form.auditDate}
                  onChange={e => handleChange('auditDate', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Auditor Name</label>
                <input
                  type="text"
                  value={form.auditorName}
                  onChange={e => handleChange('auditorName', e.target.value)}
                  placeholder="e.g. Jane Smith"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171', fontSize: 13 }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !form.name.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: submitting ? 'rgba(16,185,129,0.4)' : 'linear-gradient(135deg, #10B981, #059669)',
                  border: 'none', color: '#fff',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: !form.name.trim() ? 0.5 : 1,
                }}
              >
                {submitting && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                {submitting ? 'Creating…' : 'Create Audit'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes dialogIn { from { opacity: 0; transform: translate(-50%, -52%) scale(0.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
