'use client'

import { useState, useEffect, useRef } from 'react'
import { X, AlertTriangle, Save, Trash2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Finding {
  id?: string
  title: string
  description?: string | null
  severity: string
  status: string
  source: string
  cveId?: string | null
  affectedAsset?: string | null
  remediationGuidance?: string | null
  remediationSteps?: string | null
  assignedTo?: string | null
  dueDate?: string | null
  acceptanceRationale?: string | null
  metadata?: Record<string, unknown> | null
}

interface Control {
  id: string
  controlId: string | null
  title: string
}

interface Evidence {
  id: string
  title: string
  evidenceType: string
}

interface User {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

interface FindingModalProps {
  finding?: Finding | null
  onClose: () => void
  onSuccess?: () => void
  onDelete?: (id: string) => void
  prefill?: Partial<Finding>
}

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical', color: '#EF4444' },
  { value: 'high',     label: 'High',     color: '#F97316' },
  { value: 'medium',   label: 'Medium',   color: '#EAB308' },
  { value: 'low',      label: 'Low',      color: '#3B82F6' },
  { value: 'info',     label: 'Info',     color: '#94A3B8' },
]

const STATUS_OPTIONS = [
  { value: 'open',           label: 'Open' },
  { value: 'in_remediation', label: 'In Remediation' },
  { value: 'resolved',       label: 'Resolved' },
  { value: 'accepted',       label: 'Accepted (Risk)' },
  { value: 'false_positive', label: 'False Positive' },
]

const SOURCE_OPTIONS = [
  { value: 'manual',      label: 'Manual' },
  { value: 'pentest',     label: 'Pentest' },
  { value: 'aws',         label: 'AWS' },
  { value: 'azure',       label: 'Azure' },
  { value: 'gcp',         label: 'GCP' },
  { value: 'github',      label: 'GitHub' },
  { value: 'nl_test',     label: 'NL Test' },
  { value: 'integration', label: 'Integration' },
]

export function FindingModal({ finding, onClose, onSuccess, onDelete, prefill }: FindingModalProps) {
  const isEdit = !!finding?.id

  const [title, setTitle] = useState(finding?.title ?? prefill?.title ?? '')
  const [description, setDescription] = useState(finding?.description ?? prefill?.description ?? '')
  const [severity, setSeverity] = useState(finding?.severity ?? prefill?.severity ?? 'medium')
  const [status, setStatus] = useState(finding?.status ?? prefill?.status ?? 'open')
  const [source, setSource] = useState(finding?.source ?? prefill?.source ?? 'manual')
  const [cveId, setCveId] = useState(finding?.cveId ?? '')
  const [affectedAsset, setAffectedAsset] = useState(finding?.affectedAsset ?? '')
  const [remediationGuidance, setRemediationGuidance] = useState(finding?.remediationGuidance ?? prefill?.remediationGuidance ?? '')
  const [remediationSteps, setRemediationSteps] = useState(finding?.remediationSteps ?? '')
  const [assignedTo, setAssignedTo] = useState(finding?.assignedTo ?? '')
  const [dueDate, setDueDate] = useState(finding?.dueDate ? finding.dueDate.split('T')[0] : '')
  const [acceptanceRationale, setAcceptanceRationale] = useState(finding?.acceptanceRationale ?? '')

  const [controls, setControls] = useState<Control[]>([])
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([])
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([])
  const [controlSearch, setControlSearch] = useState('')
  const [evidenceSearch, setEvidenceSearch] = useState('')
  const [showControlDrop, setShowControlDrop] = useState(false)
  const [showEvidenceDrop, setShowEvidenceDrop] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const controlDropRef = useRef<HTMLDivElement>(null)
  const evidenceDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/controls').then((r) => r.json()),
      fetch('/api/evidence').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()),
    ]).then(([ctrlData, evData, usrData]) => {
      setControls(Array.isArray(ctrlData.controls) ? ctrlData.controls : [])
      setEvidenceList(Array.isArray(evData.evidence) ? evData.evidence : [])
      setUsers(Array.isArray(usrData.users) ? usrData.users : [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (controlDropRef.current && !controlDropRef.current.contains(e.target as Node)) setShowControlDrop(false)
      if (evidenceDropRef.current && !evidenceDropRef.current.contains(e.target as Node)) setShowEvidenceDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredControls = controls.filter((c) => {
    const q = controlSearch.toLowerCase()
    return c.title.toLowerCase().includes(q) || (c.controlId?.toLowerCase().includes(q) ?? false)
  })

  const filteredEvidence = evidenceList.filter((e) =>
    e.title.toLowerCase().includes(evidenceSearch.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }

    setSubmitting(true)
    setError(null)

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description || undefined,
      severity,
      status,
      source,
      cveId: cveId || undefined,
      affectedAsset: affectedAsset || undefined,
      remediationGuidance: remediationGuidance || undefined,
      remediationSteps: remediationSteps || undefined,
      assignedTo: assignedTo || undefined,
      dueDate: dueDate || undefined,
    }

    if (status === 'accepted' && acceptanceRationale) {
      payload.acceptanceRationale = acceptanceRationale
    }

    try {
      const url = isEdit ? `/api/findings/${finding!.id}` : '/api/findings'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save finding'); return }

      setSuccess(true)
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1000)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!isEdit || !finding?.id) return
    if (!confirm('Delete this finding? This cannot be undone.')) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/findings/${finding.id}`, { method: 'DELETE' })
      if (res.ok) {
        onDelete?.(finding.id!)
        onClose()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete')
      }
    } catch {
      setError('Network error.')
    } finally {
      setDeleting(false)
    }
  }

  const severityMeta = SEVERITY_OPTIONS.find((s) => s.value === severity)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#0D1120',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, width: '100%', maxWidth: 640,
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          position: 'sticky', top: 0, background: '#0D1120', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: `${severityMeta?.color}18` || 'rgba(239,68,68,0.15)',
              border: `1px solid ${severityMeta?.color}40` || 'rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={15} color={severityMeta?.color || '#EF4444'} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#F1F5F9' }}>
                {isEdit ? 'Edit Finding' : 'New Finding'}
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                {isEdit ? `Editing: ${finding?.title?.slice(0, 40)}` : 'Create a new security finding'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: 'rgba(255,255,255,0.4)', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Title */}
          <div>
            <label style={labelStyle}>Title <span style={{ color: '#EF4444' }}>*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. SQL Injection in /api/users endpoint"
              style={inputStyle} disabled={submitting} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={description as string} onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the finding..."
              rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} disabled={submitting} />
          </div>

          {/* Severity + Status row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={inputStyle} disabled={submitting}>
                {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle} disabled={submitting}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Source + CVE row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Source</label>
              <select value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle} disabled={submitting}>
                {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>CVE ID <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>(optional)</span></label>
              <input type="text" value={cveId as string} onChange={(e) => setCveId(e.target.value)}
                placeholder="CVE-2024-XXXXX" style={inputStyle} disabled={submitting} />
            </div>
          </div>

          {/* Affected Asset */}
          <div>
            <label style={labelStyle}>Affected Asset</label>
            <input type="text" value={affectedAsset as string} onChange={(e) => setAffectedAsset(e.target.value)}
              placeholder="e.g. api.prod.example.com, arn:aws:s3:::my-bucket"
              style={inputStyle} disabled={submitting} />
          </div>

          {/* Remediation Guidance */}
          <div>
            <label style={labelStyle}>Remediation Guidance</label>
            <textarea value={remediationGuidance as string} onChange={(e) => setRemediationGuidance(e.target.value)}
              placeholder="High-level remediation guidance..."
              rows={2} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} disabled={submitting} />
          </div>

          {/* Remediation Steps */}
          <div>
            <label style={labelStyle}>Remediation Steps</label>
            <textarea value={remediationSteps as string} onChange={(e) => setRemediationSteps(e.target.value)}
              placeholder="1. First step&#10;2. Second step&#10;3. Third step"
              rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} disabled={submitting} />
          </div>

          {/* Assigned To + Due Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Assigned To</label>
              <select value={assignedTo as string} onChange={(e) => setAssignedTo(e.target.value)} style={inputStyle} disabled={submitting}>
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                style={inputStyle} disabled={submitting} />
            </div>
          </div>

          {/* Link to Controls */}
          <div style={{ position: 'relative' }} ref={controlDropRef}>
            <label style={labelStyle}>Link to Controls</label>
            <div onClick={() => setShowControlDrop(!showControlDrop)} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 40 }}>
              {selectedControlIds.length === 0 ? (
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Select controls...</span>
              ) : selectedControlIds.map((cid) => {
                const ctrl = controls.find((c) => c.id === cid)
                return (
                  <span key={cid} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 4, padding: '1px 6px', fontSize: 11, color: '#A78BFA' }}>
                    {ctrl?.controlId || ctrl?.title?.slice(0, 20) || cid.slice(0, 8)}
                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedControlIds((p) => p.filter((x) => x !== cid)) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A78BFA', marginLeft: 3, padding: 0, fontSize: 11 }}>×</button>
                  </span>
                )
              })}
            </div>
            {showControlDrop && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#1A1F35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: 4 }}>
                <div style={{ padding: '8px 8px 4px' }}>
                  <input type="text" value={controlSearch} onChange={(e) => setControlSearch(e.target.value)} placeholder="Search controls..."
                    onClick={(e) => e.stopPropagation()} style={{ ...inputStyle, padding: '6px 10px', fontSize: 12 }} />
                </div>
                {filteredControls.slice(0, 50).map((c) => (
                  <div key={c.id} onClick={(e) => { e.stopPropagation(); setSelectedControlIds((p) => p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]) }}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: selectedControlIds.includes(c.id) ? '#A78BFA' : '#CBD5E1', background: selectedControlIds.includes(c.id) ? 'rgba(139,92,246,0.1)' : 'transparent' }}>
                    {c.controlId && <span style={{ color: 'rgba(255,255,255,0.4)', marginRight: 4 }}>{c.controlId}</span>}
                    {c.title}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link to Evidence */}
          <div style={{ position: 'relative' }} ref={evidenceDropRef}>
            <label style={labelStyle}>Link to Evidence</label>
            <div onClick={() => setShowEvidenceDrop(!showEvidenceDrop)} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 40 }}>
              {selectedEvidenceIds.length === 0 ? (
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Select evidence...</span>
              ) : selectedEvidenceIds.map((eid) => {
                const ev = evidenceList.find((e) => e.id === eid)
                return (
                  <span key={eid} style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 4, padding: '1px 6px', fontSize: 11, color: '#67E8F9' }}>
                    {ev?.title?.slice(0, 24) || eid.slice(0, 8)}
                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedEvidenceIds((p) => p.filter((x) => x !== eid)) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#67E8F9', marginLeft: 3, padding: 0, fontSize: 11 }}>×</button>
                  </span>
                )
              })}
            </div>
            {showEvidenceDrop && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#1A1F35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: 4 }}>
                <div style={{ padding: '8px 8px 4px' }}>
                  <input type="text" value={evidenceSearch} onChange={(e) => setEvidenceSearch(e.target.value)} placeholder="Search evidence..."
                    onClick={(e) => e.stopPropagation()} style={{ ...inputStyle, padding: '6px 10px', fontSize: 12 }} />
                </div>
                {filteredEvidence.slice(0, 50).map((ev) => (
                  <div key={ev.id} onClick={(e) => { e.stopPropagation(); setSelectedEvidenceIds((p) => p.includes(ev.id) ? p.filter((x) => x !== ev.id) : [...p, ev.id]) }}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: selectedEvidenceIds.includes(ev.id) ? '#67E8F9' : '#CBD5E1', background: selectedEvidenceIds.includes(ev.id) ? 'rgba(6,182,212,0.1)' : 'transparent' }}>
                    {ev.title}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Acceptance Rationale — only shown when status=accepted */}
          {status === 'accepted' && (
            <div style={{ padding: '12px 14px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8 }}>
              <label style={{ ...labelStyle, color: '#A78BFA' }}>Acceptance Rationale <span style={{ color: '#EF4444' }}>*</span></label>
              <textarea value={acceptanceRationale} onChange={(e) => setAcceptanceRationale(e.target.value)}
                placeholder="Explain why this risk is being accepted (business justification, compensating controls, etc.)..."
                rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} disabled={submitting} />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                This rationale will be recorded for audit purposes along with the accepting user and timestamp.
              </p>
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', fontSize: 13 }}>
              <AlertCircle size={14} />{error}
            </div>
          )}
          {success && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#6EE7B7', fontSize: 13 }}>
              <CheckCircle2 size={14} />Finding saved successfully!
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', paddingTop: 4 }}>
            <div>
              {isEdit && (
                <button type="button" onClick={handleDelete} disabled={deleting || submitting}
                  style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {deleting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
                  Delete
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={onClose} disabled={submitting}
                style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={submitting || success}
                style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', border: 'none', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Finding'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600,
  color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#F1F5F9',
  outline: 'none', transition: 'border-color 0.2s',
}
