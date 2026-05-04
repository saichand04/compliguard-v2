'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ClipboardList, ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
  Send, Settings, LayoutList, MessageSquare, Copy, Check,
  GripVertical, ToggleLeft, Type, CheckSquare, Star, Upload,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Questionnaire {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'sent' | 'in_progress' | 'completed' | 'expired'
  vendorId: string | null
  dueDate: string | null
  sentAt: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

interface Question {
  id: string
  questionnaireId: string
  questionText: string
  questionType: 'text' | 'yes_no' | 'multiple_choice' | 'file_upload' | 'rating'
  options: string[] | null
  isRequired: number
  orderIndex: number
  category: string | null
  createdAt: string
}

interface Response {
  id: string
  questionId: string
  responseText: string | null
  responseData: unknown
  respondentEmail: string | null
  submittedAt: string | null
  createdAt: string
}

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES: Record<string, { label: string; questions: Omit<Question, 'id' | 'questionnaireId' | 'createdAt'>[] }> = {
  caiq_lite: {
    label: 'CAIQ Lite (Cloud Security)',
    questions: [
      { questionText: 'Do you have a documented information security policy?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 0, category: 'Governance' },
      { questionText: 'Is customer data encrypted at rest and in transit?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 1, category: 'Data Security' },
      { questionText: 'Do you conduct regular third-party penetration testing?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 2, category: 'Vulnerability Management' },
      { questionText: 'What is your RTO (Recovery Time Objective) for critical systems?', questionType: 'text', options: null, isRequired: 1, orderIndex: 3, category: 'Business Continuity' },
      { questionText: 'Do you have a formal incident response plan?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 4, category: 'Incident Response' },
      { questionText: 'What security certifications do you hold?', questionType: 'multiple_choice', options: ['SOC 2 Type II', 'ISO 27001', 'PCI DSS', 'FedRAMP', 'None'], isRequired: 1, orderIndex: 5, category: 'Certifications' },
      { questionText: 'Do you perform background checks on employees with access to customer data?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 6, category: 'HR Security' },
      { questionText: 'How often do you review and update access permissions?', questionType: 'multiple_choice', options: ['Monthly', 'Quarterly', 'Annually', 'Ad hoc'], isRequired: 1, orderIndex: 7, category: 'Access Control' },
      { questionText: 'Do you use multi-factor authentication for administrative access?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 8, category: 'Access Control' },
      { questionText: 'Please describe your data retention and deletion policies.', questionType: 'text', options: null, isRequired: 0, orderIndex: 9, category: 'Data Management' },
    ],
  },
  basic_security: {
    label: 'Basic Security Assessment',
    questions: [
      { questionText: 'Do you have an information security team or dedicated CISO?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 0, category: 'Governance' },
      { questionText: 'What is your current security posture rating?', questionType: 'rating', options: null, isRequired: 1, orderIndex: 1, category: 'General' },
      { questionText: 'Do you conduct annual security awareness training for all staff?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 2, category: 'Training' },
      { questionText: 'Do you use a vulnerability management program?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 3, category: 'Vulnerability Management' },
      { questionText: 'How do you handle security patches for critical systems?', questionType: 'multiple_choice', options: ['Within 24 hours', 'Within 7 days', 'Within 30 days', 'No formal process'], isRequired: 1, orderIndex: 4, category: 'Patch Management' },
      { questionText: 'Do you maintain an up-to-date asset inventory?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 5, category: 'Asset Management' },
      { questionText: 'Do you have a formal change management process?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 6, category: 'Change Management' },
      { questionText: 'Please provide your most recent security audit report (if available).', questionType: 'file_upload', options: null, isRequired: 0, orderIndex: 7, category: 'Evidence' },
    ],
  },
  gdpr_dpa: {
    label: 'GDPR Data Processing',
    questions: [
      { questionText: 'Have you appointed a Data Protection Officer (DPO)?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 0, category: 'GDPR Compliance' },
      { questionText: 'Do you maintain a Record of Processing Activities (ROPA)?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 1, category: 'GDPR Compliance' },
      { questionText: 'In which countries is personal data processed or stored?', questionType: 'text', options: null, isRequired: 1, orderIndex: 2, category: 'Data Residency' },
      { questionText: 'Do you have a process for handling Data Subject Access Requests (DSARs)?', questionType: 'yes_no', options: null, isRequired: 1, orderIndex: 3, category: 'Data Subject Rights' },
      { questionText: 'What is your process for notifying authorities of a data breach?', questionType: 'text', options: null, isRequired: 1, orderIndex: 4, category: 'Breach Notification' },
      { questionText: 'Do you transfer personal data outside the EEA, and if so, what safeguards are in place?', questionType: 'text', options: null, isRequired: 1, orderIndex: 5, category: 'International Transfers' },
    ],
  },
}

// ── Question type icons ────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: React.ElementType }> = {
  text:            { label: 'Text',            icon: Type },
  yes_no:          { label: 'Yes / No',        icon: ToggleLeft },
  multiple_choice: { label: 'Multiple Choice', icon: CheckSquare },
  file_upload:     { label: 'File Upload',     icon: Upload },
  rating:          { label: 'Rating',          icon: Star },
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
}

// ── Builder Tab ───────────────────────────────────────────────────────────────

interface BuilderTabProps {
  questionnaire: Questionnaire
  questions: Question[]
  onQuestionsChange: (questions: Question[]) => void
}

function BuilderTab({ questionnaire, questions, onQuestionsChange }: BuilderTabProps) {
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [newQ, setNewQ] = useState({
    questionText: '',
    questionType: 'text' as Question['questionType'],
    category: '',
    isRequired: true,
    options: ['', ''],
  })
  const [saving, setSaving] = useState(false)

  const addQuestion = async () => {
    if (!newQ.questionText.trim()) return
    setSaving(true)
    try {
      const payload = {
        questionText: newQ.questionText,
        questionType: newQ.questionType,
        options: newQ.questionType === 'multiple_choice' ? newQ.options.filter(Boolean) : undefined,
        isRequired: newQ.isRequired,
        orderIndex: questions.length,
        category: newQ.category || undefined,
      }
      const res = await fetch(`/api/questionnaires/${questionnaire.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.questions?.[0]) {
        onQuestionsChange([...questions, data.questions[0]])
        setNewQ({ questionText: '', questionType: 'text', category: '', isRequired: true, options: ['', ''] })
      }
    } finally {
      setSaving(false)
    }
  }

  const deleteQuestion = async (qid: string) => {
    const res = await fetch(`/api/questionnaires/${questionnaire.id}/questions/${qid}`, { method: 'DELETE' })
    if (res.ok) {
      onQuestionsChange(questions.filter((q) => q.id !== qid))
    }
  }

  const moveQuestion = async (index: number, direction: 'up' | 'down') => {
    const newList = [...questions]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= newList.length) return;
    [newList[index], newList[target]] = [newList[target], newList[index]]
    // Update orderIndex for both
    const a = newList[index]
    const b = newList[target]
    await Promise.all([
      fetch(`/api/questionnaires/${questionnaire.id}/questions/${a.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIndex: index }),
      }),
      fetch(`/api/questionnaires/${questionnaire.id}/questions/${b.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIndex: target }),
      }),
    ])
    onQuestionsChange(newList.map((q, i) => ({ ...q, orderIndex: i })))
  }

  const loadTemplate = async (templateKey: string) => {
    const template = TEMPLATES[templateKey]
    if (!template) return
    setSaving(true)
    try {
      const res = await fetch(`/api/questionnaires/${questionnaire.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template.questions.map((q, i) => ({ ...q, orderIndex: questions.length + i }))),
      })
      const data = await res.json()
      if (res.ok) {
        onQuestionsChange([...questions, ...(data.questions ?? [])])
      }
    } finally {
      setSaving(false)
      setShowTemplateModal(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setShowTemplateModal(true)}
          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.4)', background: 'rgba(6,182,212,0.08)', color: '#06B6D4', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Load Template
        </button>
      </div>

      {/* Questions list */}
      {questions.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.1)' }}>
          <LayoutList size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
          <p style={{ fontSize: 13, margin: 0 }}>No questions yet. Add one below or load a template.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {questions.map((q, i) => {
            const TypeIcon = TYPE_META[q.questionType]?.icon ?? Type
            return (
              <div key={q.id} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}>
                  <button onClick={() => moveQuestion(i, 'up')} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'not-allowed' : 'pointer', color: i === 0 ? 'rgba(255,255,255,0.15)' : 'var(--text-muted)', padding: 2 }}>
                    <ChevronUp size={13} />
                  </button>
                  <GripVertical size={13} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto' }} />
                  <button onClick={() => moveQuestion(i, 'down')} disabled={i === questions.length - 1} style={{ background: 'none', border: 'none', cursor: i === questions.length - 1 ? 'not-allowed' : 'pointer', color: i === questions.length - 1 ? 'rgba(255,255,255,0.15)' : 'var(--text-muted)', padding: 2 }}>
                    <ChevronDown size={13} />
                  </button>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Q{i + 1}</span>
                    <span style={{ fontSize: 11, color: '#8B5CF6', background: 'rgba(139,92,246,0.12)', padding: '1px 7px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <TypeIcon size={9} /> {TYPE_META[q.questionType]?.label}
                    </span>
                    {q.category && <span style={{ fontSize: 11, color: '#06B6D4', background: 'rgba(6,182,212,0.1)', padding: '1px 7px', borderRadius: 20 }}>{q.category}</span>}
                    {q.isRequired === 1 && <span style={{ fontSize: 10, color: '#EF4444' }}>Required</span>}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1.5 }}>{q.questionText}</p>
                  {q.options && q.options.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {(q.options as string[]).map((opt: string, oi: number) => (
                        <span key={oi} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>{opt}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => deleteQuestion(q.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add question form */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Add Question</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Question Text</label>
            <textarea
              value={newQ.questionText}
              onChange={(e) => setNewQ((f) => ({ ...f, questionText: e.target.value }))}
              rows={2}
              placeholder="Enter your question…"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select
                value={newQ.questionType}
                onChange={(e) => setNewQ((f) => ({ ...f, questionType: e.target.value as Question['questionType'] }))}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {Object.entries(TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <input
                value={newQ.category}
                onChange={(e) => setNewQ((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Security"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Required</label>
              <button
                onClick={() => setNewQ((f) => ({ ...f, isRequired: !f.isRequired }))}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                  background: newQ.isRequired ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${newQ.isRequired ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  color: newQ.isRequired ? '#8B5CF6' : 'var(--text-muted)', fontWeight: 600,
                }}
              >
                {newQ.isRequired ? 'Required' : 'Optional'}
              </button>
            </div>
          </div>

          {newQ.questionType === 'multiple_choice' && (
            <div>
              <label style={labelStyle}>Options</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {newQ.options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={opt}
                      onChange={(e) => {
                        const opts = [...newQ.options]
                        opts[i] = e.target.value
                        setNewQ((f) => ({ ...f, options: opts }))
                      }}
                      placeholder={`Option ${i + 1}`}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      onClick={() => setNewQ((f) => ({ ...f, options: f.options.filter((_, oi) => oi !== i) }))}
                      disabled={newQ.options.length <= 2}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setNewQ((f) => ({ ...f, options: [...f.options, ''] }))}
                  style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 12, padding: '4px 12px', cursor: 'pointer' }}
                >
                  + Add option
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={addQuestion}
              disabled={saving || !newQ.questionText.trim()}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: (saving || !newQ.questionText.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: (saving || !newQ.questionText.trim()) ? 0.6 : 1 }}
            >
              <Plus size={14} /> Add Question
            </button>
          </div>
        </div>
      </div>

      {/* Template modal */}
      {showTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#0F1629', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, width: 500, maxWidth: '90vw' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>Load Template</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => loadTemplate(key)}
                  disabled={saving}
                  style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: saving ? 0.6 : 1 }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t.questions.length} questions</div>
                  </div>
                  <Plus size={16} style={{ color: '#8B5CF6' }} />
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowTemplateModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Responses Tab ─────────────────────────────────────────────────────────────

function ResponsesTab({ questionnaire, questions }: { questionnaire: Questionnaire; questions: Question[] }) {
  const [responses, setResponses] = useState<Response[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch responses for this questionnaire via the public endpoint using token
    const meta = questionnaire.metadata
    const token = meta?.token as string | undefined
    if (!token) {
      setLoading(false)
      return
    }
    fetch(`/api/questionnaire-response/${token}`)
      .then((r) => r.json())
      .then(() => {
        // Responses aren't exposed via GET — they're stored internally
        // We display a message about where to view them
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [questionnaire])

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>

  if (!questionnaire.metadata?.token) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
        <MessageSquare size={36} style={{ opacity: 0.2, marginBottom: 8 }} />
        <p style={{ fontSize: 13, margin: '0 0 4px' }}>This questionnaire has not been sent yet.</p>
        <p style={{ fontSize: 12, margin: 0 }}>Go to Settings to send it to a vendor.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Public Link</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code style={{ fontSize: 12, color: '#06B6D4', background: 'rgba(6,182,212,0.08)', padding: '4px 10px', borderRadius: 6, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {typeof window !== 'undefined' ? `${window.location.origin}/questionnaire/${questionnaire.metadata.token}` : `/questionnaire/${questionnaire.metadata.token}`}
          </code>
          <button
            onClick={() => {
              const url = `${window.location.origin}/questionnaire/${questionnaire.metadata?.token}`
              navigator.clipboard.writeText(url)
            }}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
          >
            <Copy size={12} /> Copy
          </button>
        </div>
      </div>

      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
        <MessageSquare size={36} style={{ opacity: 0.2, marginBottom: 8 }} />
        <p style={{ fontSize: 13, margin: '0 0 4px', color: 'var(--text-secondary)' }}>
          Questionnaire sent — status: <strong style={{ color: '#8B5CF6' }}>{questionnaire.status}</strong>
        </p>
        <p style={{ fontSize: 12, margin: 0 }}>Responses will be recorded when the vendor submits the form.</p>
        {questionnaire.sentAt && (
          <p style={{ fontSize: 12, margin: '8px 0 0', color: 'var(--text-muted)' }}>Sent on {new Date(questionnaire.sentAt).toLocaleDateString()}</p>
        )}
      </div>
    </div>
  )
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

interface SettingsTabProps {
  questionnaire: Questionnaire
  onUpdate: (q: Questionnaire) => void
}

function SettingsTab({ questionnaire, onUpdate }: SettingsTabProps) {
  const [form, setForm] = useState({
    title: questionnaire.title,
    description: questionnaire.description ?? '',
    vendorId: questionnaire.vendorId ?? '',
    dueDate: questionnaire.dueDate ? new Date(questionnaire.dueDate).toISOString().split('T')[0] : '',
  })
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ publicUrl: string; mailtoLink: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/questionnaires/${questionnaire.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          vendorId: form.vendorId || null,
          dueDate: form.dueDate || null,
        }),
      })
      if (res.ok) {
        const d = await res.json()
        onUpdate(d.questionnaire)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch(`/api/questionnaires/${questionnaire.id}/send`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        setSendResult({ publicUrl: d.publicUrl, mailtoLink: d.mailtoLink })
        onUpdate(d.questionnaire)
      }
    } finally {
      setSending(false)
    }
  }

  const copyUrl = () => {
    if (sendResult?.publicUrl) {
      navigator.clipboard.writeText(sendResult.publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Assigned Vendor ID</label>
            <input
              value={form.vendorId}
              onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
              placeholder="Paste vendor UUID"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Send section */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>Send to Vendor</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
          Generates a secure public link the vendor can use to submit their answers. No login required.
        </p>

        {questionnaire.metadata?.token && !sendResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={13} /> Already sent on {questionnaire.sentAt ? new Date(questionnaire.sentAt).toLocaleDateString() : 'unknown date'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Link: <code style={{ color: '#06B6D4' }}>/questionnaire/{String(questionnaire.metadata.token).slice(0, 8)}…</code>
            </div>
          </div>
        ) : sendResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: '#22C55E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} /> Questionnaire sent successfully!
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <code style={{ fontSize: 12, color: '#06B6D4', background: 'rgba(6,182,212,0.08)', padding: '6px 10px', borderRadius: 6, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sendResult.publicUrl}
              </code>
              <button onClick={copyUrl} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: copied ? '#22C55E' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <a href={sendResult.mailtoLink} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.08)', color: '#8B5CF6', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Send size={13} /> Open Email Draft
            </a>
          </div>
        ) : (
          <button
            onClick={handleSend}
            disabled={sending}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: sending ? 0.7 : 1 }}
          >
            <Send size={14} /> {sending ? 'Generating link…' : 'Send to Vendor'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type TabKey = 'builder' | 'responses' | 'settings'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'builder', label: 'Builder', icon: LayoutList },
  { key: 'responses', label: 'Responses', icon: MessageSquare },
  { key: 'settings', label: 'Settings', icon: Settings },
]

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8', sent: '#8B5CF6', in_progress: '#F97316', completed: '#22C55E', expired: '#EF4444',
}

export default function QuestionnaireBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('builder')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [qRes, qqRes] = await Promise.all([
        fetch(`/api/questionnaires/${id}`),
        fetch(`/api/questionnaires/${id}/questions`),
      ])
      const qData = await qRes.json()
      const qqData = await qqRes.json()
      if (qData.questionnaire) setQuestionnaire(qData.questionnaire)
      if (Array.isArray(qqData.questions)) setQuestions(qqData.questions)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        Loading questionnaire…
      </div>
    )
  }

  if (!questionnaire) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Questionnaire not found.</p>
        <button onClick={() => router.push('/vendors/questionnaires')} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
          Back to Questionnaires
        </button>
      </div>
    )
  }

  const statusColor = STATUS_COLORS[questionnaire.status] ?? '#94A3B8'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <button
          onClick={() => router.push('/vendors/questionnaires')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: '0 0 10px', marginBottom: 4 }}
        >
          <ArrowLeft size={13} /> Back to Questionnaires
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={18} style={{ color: '#8B5CF6' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{questionnaire.title}</h1>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}40`, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
                  {questionnaire.status.replace('_', ' ')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{questions.length} questions</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', display: 'flex', gap: 4, flexShrink: 0 }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
              color: activeTab === key ? '#8B5CF6' : 'var(--text-muted)',
              borderBottom: activeTab === key ? '2px solid #8B5CF6' : '2px solid transparent',
              fontSize: 13, fontWeight: activeTab === key ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'color 0.15s',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {activeTab === 'builder' && (
          <BuilderTab
            questionnaire={questionnaire}
            questions={questions}
            onQuestionsChange={setQuestions}
          />
        )}
        {activeTab === 'responses' && (
          <ResponsesTab questionnaire={questionnaire} questions={questions} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab questionnaire={questionnaire} onUpdate={setQuestionnaire} />
        )}
      </div>
    </div>
  )
}
