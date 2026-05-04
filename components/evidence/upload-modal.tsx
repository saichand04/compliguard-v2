'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Upload, Paperclip, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

interface Control {
  id: string
  controlId: string | null
  title: string
}

interface Framework {
  id: string
  name: string
  shortName: string | null
}

interface UploadModalProps {
  onClose: () => void
  onSuccess?: () => void
}

const EVIDENCE_TYPES = [
  { value: 'screenshot',     label: 'Screenshot',       color: '#3B82F6' },
  { value: 'document',       label: 'Policy Document',  color: '#8B5CF6' },
  { value: 'configuration',  label: 'Config Export',    color: '#06B6D4' },
  { value: 'automated',      label: 'Attestation',      color: '#10B981' },
  { value: 'log',            label: 'Interview Notes',  color: '#F59E0B' },
  { value: 'text',           label: 'Text',             color: '#6B7280' },
  { value: 'video',          label: 'Video',            color: '#EC4899' },
]

export function EvidenceUploadModal({ onClose, onSuccess }: UploadModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [evidenceType, setEvidenceType] = useState('document')
  const [expiresAt, setExpiresAt] = useState('')
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [controlSearch, setControlSearch] = useState('')
  const [showControlDropdown, setShowControlDropdown] = useState(false)

  const [controls, setControls] = useState<Control[]>([])
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [loadingControls, setLoadingControls] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoadingControls(true)
    Promise.all([
      fetch('/api/controls').then((r) => r.json()),
      fetch('/api/frameworks').then((r) => r.json()),
    ]).then(([ctrlData, fwData]) => {
      setControls(Array.isArray(ctrlData.controls) ? ctrlData.controls : [])
      setFrameworks(Array.isArray(fwData.frameworks) ? fwData.frameworks : [])
    }).catch(console.error).finally(() => setLoadingControls(false))
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowControlDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredControls = controls.filter((c) => {
    const q = controlSearch.toLowerCase()
    return c.title.toLowerCase().includes(q) || (c.controlId?.toLowerCase().includes(q) ?? false)
  })

  function toggleControl(id: string) {
    setSelectedControlIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null
    setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }

    setSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      if (description) formData.append('description', description)
      formData.append('evidenceType', evidenceType)
      if (expiresAt) formData.append('expiresAt', expiresAt)
      if (notes) formData.append('notes', notes)
      if (selectedControlIds[0]) formData.append('controlAssignmentId', selectedControlIds[0])
      if (file) formData.append('file', file)

      const res = await fetch('/api/evidence', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to upload evidence')
        return
      }

      setSuccess(true)
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1200)
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#0D1120',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          position: 'sticky', top: 0, background: '#0D1120', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Upload size={16} color="#8B5CF6" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#F1F5F9' }}>Upload Evidence</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Add compliance evidence to your library</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 6, color: 'rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Title */}
          <div>
            <label style={labelStyle}>Title <span style={{ color: '#EF4444' }}>*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AWS Security Hub Export — Q4 2024"
              style={inputStyle}
              disabled={submitting}
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this evidence demonstrates..."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
              disabled={submitting}
            />
          </div>

          {/* Evidence Type */}
          <div>
            <label style={labelStyle}>Evidence Type</label>
            <select
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value)}
              style={inputStyle}
              disabled={submitting}
            >
              {EVIDENCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Expiry Date */}
          <div>
            <label style={labelStyle}>Expiry Date <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>(optional)</span></label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              style={inputStyle}
              disabled={submitting}
            />
          </div>

          {/* Link to Controls (multi-select) */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <label style={labelStyle}>Link to Controls</label>
            <div
              onClick={() => setShowControlDropdown(!showControlDropdown)}
              style={{
                ...inputStyle,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, minHeight: 40,
              }}
            >
              {selectedControlIds.length === 0 ? (
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Select controls...</span>
              ) : (
                selectedControlIds.map((cid) => {
                  const ctrl = controls.find((c) => c.id === cid)
                  return (
                    <span key={cid} style={{
                      background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                      borderRadius: 4, padding: '1px 6px', fontSize: 11, color: '#A78BFA',
                    }}>
                      {ctrl?.controlId || ctrl?.title?.slice(0, 20) || cid.slice(0, 8)}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleControl(cid) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A78BFA', marginLeft: 3, padding: 0, fontSize: 11 }}
                      >×</button>
                    </span>
                  )
                })
              )}
            </div>
            {showControlDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: '#1A1F35', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, maxHeight: 200, overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: 4,
              }}>
                <div style={{ padding: '8px 8px 4px' }}>
                  <input
                    type="text"
                    value={controlSearch}
                    onChange={(e) => setControlSearch(e.target.value)}
                    placeholder="Search controls..."
                    onClick={(e) => e.stopPropagation()}
                    style={{ ...inputStyle, padding: '6px 10px', fontSize: 12 }}
                  />
                </div>
                {loadingControls ? (
                  <div style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Loading...</div>
                ) : filteredControls.length === 0 ? (
                  <div style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No controls found</div>
                ) : (
                  filteredControls.slice(0, 50).map((c) => (
                    <div
                      key={c.id}
                      onClick={(e) => { e.stopPropagation(); toggleControl(c.id) }}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                        color: selectedControlIds.includes(c.id) ? '#A78BFA' : '#CBD5E1',
                        background: selectedControlIds.includes(c.id) ? 'rgba(139,92,246,0.1)' : 'transparent',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: 3,
                        background: selectedControlIds.includes(c.id) ? '#8B5CF6' : 'rgba(255,255,255,0.08)',
                        border: `1px solid ${selectedControlIds.includes(c.id) ? '#8B5CF6' : 'rgba(255,255,255,0.15)'}`,
                        flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selectedControlIds.includes(c.id) && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                      </div>
                      <span>
                        {c.controlId && <span style={{ color: 'rgba(255,255,255,0.4)', marginRight: 4 }}>{c.controlId}</span>}
                        {c.title}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context, collection method, chain of custody..."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
              disabled={submitting}
            />
          </div>

          {/* File Upload */}
          <div>
            <label style={labelStyle}>File <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>(optional)</span></label>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${file ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 8, padding: '20px 16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                cursor: 'pointer', transition: 'border-color 0.2s',
                background: file ? 'rgba(139,92,246,0.05)' : 'transparent',
              }}
            >
              {file ? (
                <>
                  <Paperclip size={20} color="#8B5CF6" />
                  <span style={{ fontSize: 13, color: '#A78BFA', fontWeight: 500 }}>{file.name}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{(file.size / 1024).toFixed(1)} KB</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    style={{ fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >Remove</button>
                </>
              ) : (
                <>
                  <Upload size={20} color="rgba(255,255,255,0.3)" />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Click to upload or drag & drop</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>PDF, DOCX, XLSX, PNG, JPG, ZIP</span>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.zip"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#FCA5A5', fontSize: 13,
            }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
              color: '#6EE7B7', fontSize: 13,
            }}>
              <CheckCircle2 size={14} />
              Evidence uploaded successfully!
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#CBD5E1', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || success}
              style={{
                padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                border: 'none', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
              {submitting ? 'Uploading...' : 'Upload Evidence'}
            </button>
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
