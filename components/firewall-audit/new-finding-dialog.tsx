'use client'

import { useState } from 'react'
import { X, RefreshCw, AlertCircle } from 'lucide-react'

interface NewFindingDialogProps {
  auditId: string
  onClose: () => void
  onSuccess: () => void
}

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info']
const STATUSES = [
  { value: 'open',           label: 'Open' },
  { value: 'in_progress',    label: 'In Progress' },
  { value: 'remediated',     label: 'Remediated' },
  { value: 'accepted',       label: 'Accepted' },
  { value: 'false_positive', label: 'False Positive' },
]

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#EAB308',
  low:      '#3B82F6',
  info:     '#94A3B8',
}

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

export function NewFindingDialog({ auditId, onClose, onSuccess }: NewFindingDialogProps) {
  const [form, setForm] = useState({
    title: '',
    severity: 'high',
    status: 'open',
    ruleId: '',
    affectedDevice: '',
    affectedZone: '',
    cvssScore: '',
    riskDetails: '',
    remediation: '',
    assignedTo: '',
    dueDate: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/firewall-audit/findings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId,
          title: form.title.trim(),
          severity: form.severity,
          status: form.status,
          ruleId: form.ruleId.trim() || null,
          affectedDevice: form.affectedDevice.trim() || null,
          affectedZone: form.affectedZone.trim() || null,
          cvssScore: form.cvssScore ? parseFloat(form.cvssScore) : null,
          riskDetails: form.riskDetails.trim() || null,
          remediation: form.remediation.trim() || null,
          assignedTo: form.assignedTo.trim() || null,
          dueDate: form.dueDate || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to create finding')
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
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }}
      />

      {/* Dialog */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 580,
        background: '#12121a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        zIndex: 201,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'dialogIn 0.2s cubic-bezier(0.4,0,0.2,1)',
        maxHeight: '92vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#12121a', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={15} color="#EF4444" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>Add Finding</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>Record a new firewall audit finding</div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Title */}
            <div>
              <label style={labelStyle}>Title <span style={{ color: '#EF4444' }}>*</span></label>
              <input
                type="text"
                value={form.title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder="e.g. Overly permissive outbound rule"
                style={inputStyle}
                autoFocus
              />
            </div>

            {/* Severity + Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Severity</label>
                <select value={form.severity} onChange={e => handleChange('severity', e.target.value)} style={{ ...inputStyle, color: SEVERITY_COLORS[form.severity] ?? '#E2E8F0' }}>
                  {SEVERITIES.map(s => (
                    <option key={s} value={s} style={{ color: SEVERITY_COLORS[s] ?? '#E2E8F0' }}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={form.status} onChange={e => handleChange('status', e.target.value)} style={inputStyle}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Rule ID + CVSS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Rule ID</label>
                <input
                  type="text"
                  value={form.ruleId}
                  onChange={e => handleChange('ruleId', e.target.value)}
                  placeholder="e.g. RULE-001"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>CVSS Score</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={form.cvssScore}
                  onChange={e => handleChange('cvssScore', e.target.value)}
                  placeholder="0.0 – 10.0"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Affected Device + Zone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Affected Device</label>
                <input
                  type="text"
                  value={form.affectedDevice}
                  onChange={e => handleChange('affectedDevice', e.target.value)}
                  placeholder="e.g. fw-core-01"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Affected Zone</label>
                <input
                  type="text"
                  value={form.affectedZone}
                  onChange={e => handleChange('affectedZone', e.target.value)}
                  placeholder="e.g. DMZ, Internal"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Risk Details */}
            <div>
              <label style={labelStyle}>Risk Details</label>
              <textarea
                value={form.riskDetails}
                onChange={e => handleChange('riskDetails', e.target.value)}
                placeholder="Describe the risk and impact..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            {/* Remediation */}
            <div>
              <label style={labelStyle}>Remediation Guidance</label>
              <textarea
                value={form.remediation}
                onChange={e => handleChange('remediation', e.target.value)}
                placeholder="Steps to remediate this finding..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            {/* Assignee + Due Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Assignee</label>
                <input
                  type="text"
                  value={form.assignedTo}
                  onChange={e => handleChange('assignedTo', e.target.value)}
                  placeholder="e.g. john@example.com"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Due Date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => handleChange('dueDate', e.target.value)}
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
                disabled={submitting || !form.title.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: submitting ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg, #EF4444, #DC2626)',
                  border: 'none', color: '#fff',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: !form.title.trim() ? 0.5 : 1,
                }}
              >
                {submitting && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                {submitting ? 'Creating…' : 'Add Finding'}
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
