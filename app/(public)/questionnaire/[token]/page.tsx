'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ClipboardList, CheckCircle2, AlertTriangle, Star, Upload, ChevronDown } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuestionnaireInfo {
  id: string
  title: string
  description: string | null
  dueDate: string | null
}

interface Question {
  id: string
  questionText: string
  questionType: 'text' | 'yes_no' | 'multiple_choice' | 'file_upload' | 'rating'
  options: string[] | null
  isRequired: number
  orderIndex: number
  category: string | null
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  borderRadius: 12,
}

// ── Question Input ─────────────────────────────────────────────────────────────

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: Question
  value: string
  onChange: (v: string) => void
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 14,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#F1F5F9',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  switch (question.questionType) {
    case 'text':
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="Type your answer here…"
          style={{ ...inputStyle, resize: 'vertical' }}
          required={question.isRequired === 1}
        />
      )

    case 'yes_no':
      return (
        <div style={{ display: 'flex', gap: 10 }}>
          {['Yes', 'No'].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              style={{
                padding: '10px 28px',
                borderRadius: 8,
                border: `1px solid ${value === opt ? '#8B5CF6' : 'rgba(255,255,255,0.12)'}`,
                background: value === opt ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                color: value === opt ? '#8B5CF6' : '#94A3B8',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )

    case 'multiple_choice':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(question.options ?? []).map((opt: string) => (
            <label
              key={opt}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                border: `1px solid ${value === opt ? '#8B5CF6' : 'rgba(255,255,255,0.08)'}`,
                background: value === opt ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <input
                type="radio"
                name={`q_${question.id}`}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                style={{ accentColor: '#8B5CF6' }}
              />
              <span style={{ fontSize: 14, color: value === opt ? '#F1F5F9' : '#94A3B8' }}>{opt}</span>
            </label>
          ))}
        </div>
      )

    case 'rating':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                border: `1px solid ${value === String(n) ? '#F97316' : 'rgba(255,255,255,0.12)'}`,
                background: value === String(n) ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
                color: value === String(n) ? '#F97316' : '#94A3B8',
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              <Star size={16} fill={value === String(n) ? '#F97316' : 'none'} />
            </button>
          ))}
          {value && <span style={{ alignSelf: 'center', fontSize: 13, color: '#F97316', fontWeight: 600 }}>{value} / 5</span>}
        </div>
      )

    case 'file_upload':
      return (
        <div style={{ padding: '24px', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
          <Upload size={24} style={{ color: '#94A3B8', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 8px' }}>File upload is not available in this version.</p>
          <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', margin: 0 }}>Please describe the document in a text response or send via email.</p>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Describe the document or provide a link…"
            style={{ ...inputStyle, marginTop: 10 }}
          />
        </div>
      )

    default:
      return (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'error' | 'form' | 'success'

export default function PublicQuestionnairePage() {
  const params = useParams()
  const token = params.token as string

  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireInfo | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/questionnaire-response/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setErrorMsg(data.error)
          setPageState('error')
          return
        }
        setQuestionnaire(data.questionnaire)
        setQuestions(Array.isArray(data.questions) ? data.questions : [])
        setPageState('form')
      })
      .catch(() => {
        setErrorMsg('Failed to load questionnaire. Please try again.')
        setPageState('error')
      })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    const missing = questions.filter(
      (q) => q.isRequired === 1 && !answers[q.id]?.trim()
    )
    if (missing.length > 0) {
      alert(`Please answer all required questions (${missing.length} remaining).`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/questionnaire-response/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respondentEmail: email,
          answers: questions.map((q) => ({
            questionId: q.id,
            responseText: answers[q.id] ?? '',
          })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setPageState('success')
      } else {
        alert(data.error || 'Failed to submit. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Group questions by category
  const categories = Array.from(new Set(questions.map((q) => q.category ?? 'General')))

  if (pageState === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080B18' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList size={22} style={{ color: '#8B5CF6' }} />
          </div>
          <p style={{ color: '#94A3B8', fontSize: 14 }}>Loading questionnaire…</p>
        </div>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080B18', padding: 24 }}>
        <div style={{ ...cardStyle, padding: 40, maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <AlertTriangle size={40} style={{ color: '#EF4444', marginBottom: 16 }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F1F5F9', margin: '0 0 8px' }}>Questionnaire Not Found</h2>
          <p style={{ fontSize: 14, color: '#94A3B8', margin: 0 }}>{errorMsg}</p>
        </div>
      </div>
    )
  }

  if (pageState === 'success') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080B18', padding: 24 }}>
        <div style={{ ...cardStyle, padding: 48, maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={28} style={{ color: '#22C55E' }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', margin: '0 0 10px' }}>Thank You!</h2>
          <p style={{ fontSize: 15, color: '#94A3B8', margin: '0 0 6px' }}>Your responses have been submitted successfully.</p>
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)', margin: 0 }}>The organization will review your answers and may follow up with you.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080B18', padding: '40px 16px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header card */}
        <div style={{ ...cardStyle, padding: '28px 32px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ClipboardList size={20} style={{ color: '#8B5CF6' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px' }}>{questionnaire?.title}</h1>
              {questionnaire?.dueDate && (
                <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
                  Due: {new Date(questionnaire.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
          {questionnaire?.description && (
            <p style={{ fontSize: 14, color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>{questionnaire.description}</p>
          )}
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, fontSize: 12, color: '#A78BFA' }}>
            {questions.filter((q) => q.isRequired === 1).length} required question{questions.filter((q) => q.isRequired === 1).length !== 1 ? 's' : ''} · {questions.length} total
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Email field */}
          <div style={{ ...cardStyle, padding: '20px 24px', marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 6 }}>
              Your Email Address <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#F1F5F9', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Questions grouped by category */}
          {categories.map((cat) => {
            const catQuestions = questions.filter((q) => (q.category ?? 'General') === cat)
            return (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 4 }}>
                  {cat}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {catQuestions.map((q, i) => (
                    <div key={q.id} style={{ ...cardStyle, padding: '20px 24px' }}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#8B5CF6', minWidth: 24, paddingTop: 1 }}>
                            {i + 1 + questions.findIndex((qq) => qq.id === q.id) - catQuestions.findIndex((qq) => qq.id === q.id)}.
                          </span>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 15, color: '#F1F5F9', margin: '0 0 4px', lineHeight: 1.5 }}>
                              {q.questionText}
                              {q.isRequired === 1 && <span style={{ color: '#EF4444', marginLeft: 4 }}>*</span>}
                            </p>
                            {q.isRequired === 0 && (
                              <span style={{ fontSize: 11, color: '#64748B' }}>Optional</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <QuestionInput
                        question={q}
                        value={answers[q.id] ?? ''}
                        onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Submit */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
            <button
              type="submit"
              disabled={submitting || !email}
              style={{
                padding: '14px 48px',
                borderRadius: 10,
                border: 'none',
                background: submitting ? 'rgba(139,92,246,0.4)' : '#8B5CF6',
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: (submitting || !email) ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {submitting ? 'Submitting…' : 'Submit Responses'}
            </button>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#475569', marginTop: 16 }}>
            Powered by CompliGuard · Your responses are encrypted and stored securely.
          </p>
        </form>
      </div>
    </div>
  )
}
