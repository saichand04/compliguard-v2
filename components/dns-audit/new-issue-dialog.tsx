'use client'

import { useState } from 'react'
import { X, RefreshCw, Globe } from 'lucide-react'

interface NewIssueDialogProps {
  auditId: string
  onClose: () => void
  onSuccess: () => void
}

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info']

const ISSUE_TYPES = [
  { value: 'misconfiguration',   label: 'Misconfiguration' },
  { value: 'dangling_record',    label: 'Dangling Record' },
  { value: 'missing_spf',        label: 'Missing SPF' },
  { value: 'missing_dmarc',      label: 'Missing DMARC' },
  { value: 'missing_dkim',       label: 'Missing DKIM' },
  { value: 'zone_transfer',      label: 'Zone Transfer' },
  { value: 'subdomain_takeover', label: 'Subdomain Takeover' },
  { value: 'cache_poisoning',    label: 'Cache Poisoning' },
  { value: 'wildcard_record',    label: 'Wildcard Record' },
  { value: 'other',              label: 'Other' },
]

const STATUSES = [
  { value: 'open',           label: 'Open' },
  { value: 'in_progress',    label: 'In Progress' },
  { value: 'remediated',     label: 'Remediated' },
  { value: 'accepted',       label: 'Accepted' },
  { value: 'false_positive', label: 'False Positive' },
]

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'PTR', 'SRV', 'CAA', 'DNSKEY', 'DS', 'Other']

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

export function NewIssueDialog({ auditId, onClose, onSuccess }: NewIssueDialogProps) {
  const [form, setForm] = useState({
    title: '',
    severity: 'high',
    issueType: 'misconfiguration',
    status: 'open',
    affectedRecord: '',
    recordType: '',
    currentValue: '',
    expectedValue: '',
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
      const res = await fetch('/api/dns-audit/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId,
          title: form.title.trim(),
          severity: form.severity,
          issueType: form.issueType,
          status: form.status,
          affectedRecord: form.affectedRecord.trim() || null,
          recordType: form.recordType || null,
          currentValue: form.currentValue.trim() || null,
          expectedValue: form.expectedValue.trim() || null,
          riskDetails: form.riskDetails.trim() || null,
          remediation: form.remediation.trim() || null,
          assignedTo: form.assignedTo.trim() || null,
          dueDate: form.dueDate || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to create issue')
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
        width: '100%', maxWidth: 600,
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
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={15} color="#10B981" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>Add DNS Issue</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>Record a new DNS audit issue</div>
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
                placeholder="e.g. Missing DMARC record for example.com"
                style={inputStyle}
                autoFocus
              />
            </div>

            {/* Severity + Issue Type */}
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
                <label style={labelStyle}>Issue Type</label>
                <select value={form.issueType} onChange={e => handleChange('issueType', e.target.value)} style={inputStyle}>
                  {ISSUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Status */}
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => handleChange('status', e.target.value)} style={inputStyle}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {/* Affected Record + Record Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Affected Record</label>
                <input
                  type="text"
                  value={form.affectedRecord}
                  onChange={e => handleChange('affectedRecord', e.target.value)}
                  placeholder="e.g. mail.example.com"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Record Type</label>
                <select value={form.recordType} onChange={e => handleChange('recordType', e.target.value)} style={inputStyle}>
                  <option value="">Select…</option>
                  {RECORD_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                </select>
              </div>
            </div>

            {/* Current Value */}
            <div>
              <label style={labelStyle}>Current Value</label>
              <input
                type="text"
                value={form.currentValue}
                onChange={e => handleChange('currentValue', e.target.value)}
                placeholder="Current DNS record value"
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>

            {/* Expected Value */}
            <div>
              <label style={labelStyle}>Expected Value</label>
              <input
                type="text"
                value={form.expectedValue}
                onChange={e => handleChange('expectedValue', e.target.value)}
                placeholder="What the value should be"
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
              />
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
                placeholder="Steps to remediate this issue..."
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
                  background: submitting ? 'rgba(16,185,129,0.4)' : 'linear-gradient(135deg, #10B981, #059669)',
                  border: 'none', color: '#fff',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: !form.title.trim() ? 0.5 : 1,
                }}
              >
                {submitting && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                {submitting ? 'Creating…' : 'Add Issue'}
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
