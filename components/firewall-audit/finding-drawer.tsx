'use client'

import { useState, useRef } from 'react'
import {
  X, RefreshCw, Upload, FileText,
  Download, Trash2, MessageSquare,
  User, Calendar, ChevronDown, Send,
  Paperclip,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FirewallFinding {
  id: string
  title: string
  severity: string
  status: string
  ruleId: string | null
  affectedDevice: string | null
  affectedZone: string | null
  cvssScore: string | null  // stored as varchar in DB
  assignedTo: string | null
  dueDate: string | null
  description: string | null
  riskDetails: string | null
  remediation: string | null
  createdAt: string
  updatedAt: string
}

interface FindingDrawerProps {
  finding: FirewallFinding
  onClose: () => void
  onUpdate: () => void
}

interface Evidence {
  id: string
  filename: string
  fileType: string
  fileUrl: string
  uploadedBy: string
  uploadedAt: string
  thumbnailUrl?: string
}

interface Comment {
  id: string
  author: string
  content: string
  createdAt: string
}

// ── Badge configs ─────────────────────────────────────────────────────────────

const SEVERITY_META: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#EF4444' },
  high:     { label: 'High',     color: '#F97316' },
  medium:   { label: 'Medium',   color: '#EAB308' },
  low:      { label: 'Low',      color: '#3B82F6' },
  info:     { label: 'Info',     color: '#94A3B8' },
}

const STATUS_OPTIONS = [
  { value: 'open',           label: 'Open',           color: '#EF4444' },
  { value: 'in_progress',    label: 'In Progress',    color: '#F59E0B' },
  { value: 'remediated',     label: 'Remediated',     color: '#10B981' },
  { value: 'accepted',       label: 'Accepted',       color: '#8B5CF6' },
  { value: 'false_positive', label: 'False Positive', color: '#94A3B8' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function FieldValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: '#E2E8F0', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

function PreText({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Not specified</span>
  return (
    <pre style={{
      margin: 0, padding: '10px 12px',
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, fontSize: 12.5, color: '#CBD5E1', lineHeight: 1.7,
      whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit',
    }}>
      {value}
    </pre>
  )
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export function FindingDrawer({ finding, onClose, onUpdate }: FindingDrawerProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'evidence' | 'comments'>('details')
  const [status, setStatus] = useState(finding.status)
  const [statusSaving, setStatusSaving] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  // Evidence tab state
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [evidenceLoaded, setEvidenceLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Comments tab state
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)

  const sevMeta = SEVERITY_META[finding.severity] ?? { label: finding.severity, color: '#94A3B8' }
  const statusMeta = STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_OPTIONS[0]

  async function handleStatusChange(newStatus: string) {
    setStatus(newStatus)
    setShowStatusMenu(false)
    setStatusSaving(true)
    try {
      await fetch(`/api/firewall-audit/findings/${finding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      onUpdate()
    } catch (err) {
      console.error(err)
    } finally {
      setStatusSaving(false)
    }
  }

  async function loadEvidence() {
    if (evidenceLoaded) return
    try {
      const res = await fetch(`/api/firewall-audit/findings/${finding.id}/evidence`)
      if (res.ok) {
        const data = await res.json()
        setEvidence(Array.isArray(data.evidence) ? data.evidence : [])
      }
    } catch (err) { console.error(err) }
    setEvidenceLoaded(true)
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadProgress(0)
    const formData = new FormData()
    Array.from(files).forEach(f => formData.append('files', f))

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(p => Math.min(p + 15, 90))
      }, 200)

      const res = await fetch(`/api/firewall-audit/findings/${finding.id}/evidence`, {
        method: 'POST',
        body: formData,
      })
      clearInterval(progressInterval)
      setUploadProgress(100)

      if (res.ok) {
        const data = await res.json()
        setEvidence(prev => [...prev, ...(data.evidence ?? [])])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setTimeout(() => { setUploading(false); setUploadProgress(0) }, 600)
    }
  }

  async function handleDeleteEvidence(evidenceId: string) {
    try {
      await fetch(`/api/firewall-audit/findings/${finding.id}/evidence/${evidenceId}`, { method: 'DELETE' })
      setEvidence(prev => prev.filter(e => e.id !== evidenceId))
    } catch (err) { console.error(err) }
  }

  async function loadComments() {
    if (commentsLoaded) return
    try {
      const res = await fetch(`/api/firewall-audit/findings/${finding.id}/comments`)
      if (res.ok) {
        const data = await res.json()
        setComments(Array.isArray(data.comments) ? data.comments : [])
      }
    } catch (err) { console.error(err) }
    setCommentsLoaded(true)
  }

  async function handleAddComment() {
    if (!newComment.trim()) return
    setCommentSubmitting(true)
    try {
      const res = await fetch(`/api/firewall-audit/findings/${finding.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      })
      if (res.ok) {
        const data = await res.json()
        setComments(prev => [...prev, data.comment])
        setNewComment('')
      }
    } catch (err) { console.error(err) }
    setCommentSubmitting(false)
  }

  function handleTabChange(tab: typeof activeTab) {
    setActiveTab(tab)
    if (tab === 'evidence') loadEvidence()
    if (tab === 'comments') loadComments()
  }

  const tabs = [
    { id: 'details' as const,  label: 'Details' },
    { id: 'evidence' as const, label: 'Evidence' },
    { id: 'comments' as const, label: 'Comments' },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 680,
        background: '#0f1020', borderLeft: '1px solid rgba(255,255,255,0.1)',
        zIndex: 101, display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.25s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '-24px 0 80px rgba(0,0,0,0.5)',
      }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {/* Severity badge */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: `${sevMeta.color}18`, border: `1px solid ${sevMeta.color}40`,
                  color: sevMeta.color,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: sevMeta.color }} />
                  {sevMeta.label}
                </span>

                {/* Status dropdown */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowStatusMenu(!showStatusMenu)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: `${statusMeta.color}18`, border: `1px solid ${statusMeta.color}40`,
                      color: statusMeta.color, cursor: 'pointer',
                    }}
                  >
                    {statusSaving ? <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                    {statusMeta.label}
                    <ChevronDown size={11} />
                  </button>
                  {showStatusMenu && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 1 }} onClick={() => setShowStatusMenu(false)} />
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, zIndex: 2, marginTop: 4,
                        background: '#1a1f35', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8, overflow: 'hidden', minWidth: 160,
                      }}>
                        {STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => void handleStatusChange(opt.value)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                              padding: '9px 14px', fontSize: 13, color: opt.color,
                              background: 'transparent', border: 'none', cursor: 'pointer',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#F1F5F9', lineHeight: 1.35 }}>
                {finding.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: -1 }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  padding: '8px 16px', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
                  color: activeTab === tab.id ? '#F1F5F9' : 'rgba(255,255,255,0.45)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  borderBottom: activeTab === tab.id ? '2px solid #3B82F6' : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── DETAILS TAB ─────────────────────────────── */}
          {activeTab === 'details' && (
            <div>
              <Section title="Overview">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                  <FieldValue label="Rule ID">
                    {finding.ruleId ?? <span style={{ color: 'rgba(255,255,255,0.25)' }}>Not specified</span>}
                  </FieldValue>
                  <FieldValue label="CVSS Score">
                    {(() => {
                      const n = parseFloat(finding.cvssScore ?? '')
                      return !isNaN(n) ? (
                        <span style={{ fontWeight: 700, color: n >= 9 ? '#EF4444' : n >= 7 ? '#F97316' : n >= 4 ? '#EAB308' : '#10B981' }}>
                          {n.toFixed(1)}
                        </span>
                      ) : <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
                    })()}
                  </FieldValue>
                  <FieldValue label="Affected Device">
                    {finding.affectedDevice ?? <span style={{ color: 'rgba(255,255,255,0.25)' }}>Not specified</span>}
                  </FieldValue>
                  <FieldValue label="Affected Zone">
                    {finding.affectedZone ?? <span style={{ color: 'rgba(255,255,255,0.25)' }}>Not specified</span>}
                  </FieldValue>
                  <FieldValue label="Assignee">
                    {finding.assignedTo ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={13} color="rgba(255,255,255,0.4)" />
                        {finding.assignedTo}
                      </span>
                    ) : <span style={{ color: 'rgba(255,255,255,0.25)' }}>Unassigned</span>}
                  </FieldValue>
                  <FieldValue label="Due Date">
                    {finding.dueDate ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: new Date(finding.dueDate) < new Date() ? '#F97316' : '#E2E8F0' }}>
                        <Calendar size={13} />
                        {new Date(finding.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    ) : <span style={{ color: 'rgba(255,255,255,0.25)' }}>Not set</span>}
                  </FieldValue>
                </div>
              </Section>

              <Section title="Description">
                <PreText value={finding.description} />
              </Section>

              <Section title="Risk Details">
                <PreText value={finding.riskDetails} />
              </Section>

              <Section title="Remediation Guidance">
                <PreText value={finding.remediation} />
              </Section>

              <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: 'rgba(255,255,255,0.3)', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span>Created: {new Date(finding.createdAt).toLocaleString()}</span>
                <span>Updated: {new Date(finding.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* ── EVIDENCE TAB ─────────────────────────────── */}
          {activeTab === 'evidence' && (
            <div>
              {/* Upload zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFileUpload(e.dataTransfer.files) }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#3B82F6' : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: 12, padding: '28px 20px', textAlign: 'center',
                  cursor: 'pointer', marginBottom: 20, transition: 'all 0.2s',
                  background: dragOver ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <Upload size={24} color={dragOver ? '#3B82F6' : 'rgba(255,255,255,0.3)'} style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: 14, fontWeight: 500, color: '#E2E8F0', marginBottom: 4 }}>
                  Drop files here or click to upload
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                  JPG, PNG, GIF, PDF, DOC, DOCX, XLSX, ZIP
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xlsx,.zip"
                  style={{ display: 'none' }}
                  onChange={(e) => void handleFileUpload(e.target.files)}
                />
              </div>

              {/* Upload progress */}
              {uploading && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #3B82F6, #06B6D4)', width: `${uploadProgress}%`, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}

              {/* Evidence list */}
              {evidence.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  <Paperclip size={28} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
                  No evidence uploaded yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {evidence.map((ev) => {
                    const isImage = /\.(jpg|jpeg|png|gif)$/i.test(ev.filename)
                    return (
                      <div key={ev.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      }}>
                        <div style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isImage && ev.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ev.thumbnailUrl} alt={ev.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <FileText size={18} color="rgba(255,255,255,0.4)" />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.filename}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                            {ev.uploadedBy} · {new Date(ev.uploadedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <a href={ev.fileUrl} download target="_blank" rel="noopener noreferrer" style={{ padding: '5px 7px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
                            <Download size={13} />
                          </a>
                          <button
                            onClick={() => void handleDeleteEvidence(ev.id)}
                            style={{ padding: '5px 7px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', cursor: 'pointer', display: 'flex' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── COMMENTS TAB ─────────────────────────────── */}
          {activeTab === 'comments' && (
            <div>
              {/* Comment list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                    <MessageSquare size={26} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }} />
                    No comments yet
                  </div>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} style={{
                      padding: '12px 14px', borderRadius: 10,
                      background: 'rgba(59,130,246,0.05)',
                      border: '1px solid rgba(59,130,246,0.15)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#93C5FD' }}>
                            {c.author.slice(0, 1).toUpperCase()}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>{c.author}</span>
                        </div>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#CBD5E1', lineHeight: 1.6 }}>{c.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add comment */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Add an internal comment..."
                  rows={3}
                  style={{
                    width: '100%', background: 'none', border: 'none', outline: 'none',
                    padding: '12px 14px', fontSize: 13, color: '#E2E8F0', resize: 'none',
                    lineHeight: 1.6, boxSizing: 'border-box',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleAddComment()
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>⌘ + Enter to submit</span>
                  <button
                    onClick={() => void handleAddComment()}
                    disabled={!newComment.trim() || commentSubmitting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                      borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                      background: newComment.trim() ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${newComment.trim() ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      color: newComment.trim() ? '#93C5FD' : 'rgba(255,255,255,0.25)',
                      cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {commentSubmitting ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={12} />}
                    Comment
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
