'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FlaskConical, Plus, Play, Edit2, Trash2, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Clock, RefreshCw, Shield, Wifi, Globe,
  Lock, Mail, Server, AlertTriangle, Loader2, Copy,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NLTest {
  id: string
  name: string
  query: string
  schedule: string | null
  isActive: boolean
  lastRunAt: string | null
  createdAt: string
  updatedAt: string
}

interface NLTestResult {
  id: string
  testId: string
  passed: boolean | null
  output: string | null
  duration: string | null
  ranAt: string
}

interface RunResult {
  passed: boolean
  output: string
  duration: number
  error?: string
}

// ─── Test Library Templates ───────────────────────────────────────────────────

const TEST_TEMPLATES = [
  {
    icon: Lock,
    name: 'SSL Check',
    query: 'Check SSL certificate on {domain}',
    description: 'Verify HTTPS is reachable and cert is valid',
    color: '#06B6D4',
  },
  {
    icon: Globe,
    name: 'HTTPS Redirect',
    query: 'Verify HTTPS redirect on {domain}',
    description: 'Confirm HTTP automatically redirects to HTTPS',
    color: '#8B5CF6',
  },
  {
    icon: Mail,
    name: 'DMARC/SPF Check',
    query: 'Check DMARC and SPF configured for {domain}',
    description: 'Verify email authentication DNS records exist',
    color: '#10B981',
  },
  {
    icon: Server,
    name: 'Port 22 Closed',
    query: 'Verify port 22 is closed on {host}',
    description: 'Ensure SSH port is not publicly accessible',
    color: '#F59E0B',
  },
  {
    icon: Shield,
    name: 'Security Headers',
    query: 'Confirm security headers on {url}',
    description: 'Check for HSTS, CSP, X-Frame-Options, and more',
    color: '#EF4444',
  },
  {
    icon: Clock,
    name: 'Certificate Expiry',
    query: 'Check certificate not expiring soon for {domain}',
    description: 'Alert if cert expires within 30 days',
    color: '#F97316',
  },
  {
    icon: Wifi,
    name: 'TLS 1.2+ Only',
    query: 'Verify TLS 1.2 or higher on {domain}',
    description: 'Confirm modern TLS protocol is used',
    color: '#06B6D4',
  },
]

const SCHEDULE_OPTIONS = [
  { value: 'manual', label: 'Manual only' },
  { value: 'daily', label: 'Daily (9am)' },
  { value: 'weekly', label: 'Weekly (Mon 9am)' },
  { value: 'monthly', label: 'Monthly (1st at 9am)' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function scheduleLabel(schedule: string | null): string {
  if (!schedule || schedule === 'manual') return 'Manual'
  const map: Record<string, string> = {
    'daily': 'Daily',
    'weekly': 'Weekly',
    'monthly': 'Monthly',
    '0 9 * * *': 'Daily at 9am',
    '0 9 * * 1': 'Weekly Mon',
    '0 9 1 * *': 'Monthly 1st',
  }
  return map[schedule] ?? schedule
}

// ─── Create/Edit Modal ────────────────────────────────────────────────────────

interface ModalProps {
  initial?: NLTest
  onClose: () => void
  onSave: (test: NLTest) => void
}

function TestModal({ initial, onClose, onSave }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [query, setQuery] = useState(initial?.query ?? '')
  const [schedule, setSchedule] = useState(initial?.schedule ?? 'manual')
  const [runNow, setRunNow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !query.trim()) { setError('Name and query are required.'); return }
    setSaving(true)
    setError('')

    try {
      const url = initial ? `/api/integrations/nl-tests/${initial.id}` : '/api/integrations/nl-tests'
      const method = initial ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), query: query.trim(), schedule }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to save')
      }
      const data = await res.json() as { test: NLTest }
      onSave(data.test)

      if (runNow && !initial) {
        // Run the newly created test
        await fetch(`/api/integrations/nl-tests/${data.test.id}/run`, { method: 'POST' })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(8,11,24,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#0E1221', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, width: '100%', maxWidth: 560, padding: 28,
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
          {initial ? 'Edit Test' : 'Create NL Test'}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Test Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Check SSL on api.example.com"
              style={{
                width: '100%', padding: '10px 12px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Query (plain English)
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Check that SSL is valid on api.example.com and certificate doesn't expire within 30 days"
              rows={3}
              style={{
                width: '100%', padding: '10px 12px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Schedule
            </label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, outline: 'none',
              }}
            >
              {SCHEDULE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} style={{ background: '#0E1221' }}>{o.label}</option>
              ))}
            </select>
          </div>

          {!initial && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={runNow}
                onChange={(e) => setRunNow(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--violet)' }}
              />
              Run immediately after creating
            </label>
          )}

          {error && (
            <div style={{ fontSize: 13, color: '#EF4444', background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--violet)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Results Drawer ───────────────────────────────────────────────────────────

function ResultsDrawer({ test, onClose }: { test: NLTest; onClose: () => void }) {
  const [results, setResults] = useState<NLTestResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/integrations/nl-tests/${test.id}/results`)
      .then(r => r.json())
      .then((d: { results?: NLTestResult[] }) => setResults(d.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [test.id])

  return (
    <div style={{
      marginTop: 0, borderTop: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(0,0,0,0.25)', padding: '16px 20px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
        Last 20 Results
      </div>
      {loading ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
        </div>
      ) : !results.length ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No results yet. Run the test to see results here.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((r) => (
            <div key={r.id} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '10px 14px', borderRadius: 8,
              background: r.passed ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${r.passed ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              {r.passed
                ? <CheckCircle size={15} style={{ color: '#10B981', flexShrink: 0, marginTop: 1 }} />
                : <XCircle size={15} style={{ color: '#EF4444', flexShrink: 0, marginTop: 1 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{r.output ?? '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {formatRelative(r.ranAt)} · {r.duration ? `${r.duration}ms` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NLTestsPage() {
  const [tests, setTests] = useState<NLTest[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<NLTest | undefined>()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [runningAll, setRunningAll] = useState(false)
  const [lastRunResult, setLastRunResult] = useState<Record<string, RunResult>>({})
  const [runAllSummary, setRunAllSummary] = useState<{ ran: number; passed: number; failed: number } | null>(null)

  const loadTests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/integrations/nl-tests')
      const data = await res.json() as { tests?: NLTest[] }
      setTests(data.tests ?? [])
    } catch {
      setTests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadTests() }, [loadTests])

  async function handleRun(test: NLTest) {
    setRunningId(test.id)
    try {
      const res = await fetch(`/api/integrations/nl-tests/${test.id}/run`, { method: 'POST' })
      const data = await res.json() as { result?: RunResult }
      if (data.result) {
        setLastRunResult(prev => ({ ...prev, [test.id]: data.result! }))
      }
      await loadTests()
    } finally {
      setRunningId(null)
    }
  }

  async function handleDelete(test: NLTest) {
    if (!confirm(`Delete "${test.name}"? This cannot be undone.`)) return
    await fetch(`/api/integrations/nl-tests/${test.id}`, { method: 'DELETE' })
    setTests(prev => prev.filter(t => t.id !== test.id))
  }

  async function handleRunAll() {
    setRunningAll(true)
    setRunAllSummary(null)
    try {
      const res = await fetch('/api/integrations/nl-tests/run-all', { method: 'POST' })
      const data = await res.json() as { ran: number; passed: number; failed: number }
      setRunAllSummary(data)
      await loadTests()
    } finally {
      setRunningAll(false)
    }
  }

  function handleUseTemplate(template: typeof TEST_TEMPLATES[0]) {
    setEditTarget(undefined)
    setShowModal(true)
    // Pre-fill via state — we'll pass a synthetic "initial" later
    // For now, open modal and user can copy the template query
    void navigator.clipboard?.writeText(template.query)
  }

  function handleSaveTest(saved: NLTest) {
    setTests(prev => {
      const idx = prev.findIndex(t => t.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [...prev, saved]
    })
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FlaskConical size={18} color="#fff" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>NL Tests</h1>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            Plain-English security checks — SSL, DNS, headers, ports, and more.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleRunAll}
            disabled={runningAll || !tests.length}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-secondary)', cursor: (runningAll || !tests.length) ? 'not-allowed' : 'pointer',
              opacity: (runningAll || !tests.length) ? 0.6 : 1,
            }}
          >
            {runningAll
              ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <RefreshCw size={14} />
            }
            Run All
          </button>
          <button
            onClick={() => { setEditTarget(undefined); setShowModal(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: 'var(--violet)', border: 'none', color: '#fff', cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Create Test
          </button>
        </div>
      </div>

      {/* Run-all summary */}
      {runAllSummary && (
        <div style={{
          display: 'flex', gap: 16, padding: '12px 16px', borderRadius: 10, marginBottom: 20,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Last run-all:</span>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{runAllSummary.ran} ran</span>
          <span style={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>{runAllSummary.passed} passed</span>
          {runAllSummary.failed > 0 && (
            <span style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>{runAllSummary.failed} failed</span>
          )}
        </div>
      )}

      {/* Test Library */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Test Library
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {TEST_TEMPLATES.map((tpl) => (
            <div
              key={tpl.name}
              style={{
                padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = `${tpl.color}44`
                ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)'
                ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'
              }}
              onClick={() => handleUseTemplate(tpl)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: `${tpl.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <tpl.icon size={14} style={{ color: tpl.color }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{tpl.name}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{tpl.description}</p>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, color: tpl.color, fontSize: 11 }}>
                <Copy size={10} />
                <span>Copy query</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tests Table */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 3fr 1fr 1fr 1fr 120px',
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          gap: 12,
        }}>
          {['Name', 'Query', 'Schedule', 'Last Run', 'Result', 'Actions'].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            Loading tests…
          </div>
        ) : !tests.length ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <FlaskConical size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>No tests yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Create your first NL security test.</div>
            <button
              onClick={() => { setEditTarget(undefined); setShowModal(true) }}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--violet)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              <Plus size={13} style={{ display: 'inline', marginRight: 6 }} />
              Create Test
            </button>
          </div>
        ) : (
          tests.map((test) => {
            const isExpanded = expandedId === test.id
            const isRunning = runningId === test.id
            const lastResult = lastRunResult[test.id]

            return (
              <div key={test.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 3fr 1fr 1fr 1fr 120px',
                    padding: '14px 20px',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                  onClick={() => setExpandedId(isExpanded ? null : test.id)}
                >
                  {/* Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isExpanded
                      ? <ChevronUp size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      : <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    }
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {test.name}
                    </span>
                    {!test.isActive && (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Query */}
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {test.query}
                  </div>

                  {/* Schedule */}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {scheduleLabel(test.schedule)}
                  </div>

                  {/* Last Run */}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatRelative(test.lastRunAt)}
                  </div>

                  {/* Result */}
                  <div>
                    {lastResult ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: lastResult.passed ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                        color: lastResult.passed ? '#10B981' : '#EF4444',
                      }}>
                        {lastResult.passed
                          ? <CheckCircle size={11} />
                          : <XCircle size={11} />
                        }
                        {lastResult.passed ? 'Pass' : 'Fail'}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    style={{ display: 'flex', gap: 6 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleRun(test)}
                      disabled={isRunning}
                      title="Run test"
                      style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#06B6D4', cursor: isRunning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {isRunning
                        ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Play size={12} />
                      }
                    </button>
                    <button
                      onClick={() => { setEditTarget(test); setShowModal(true) }}
                      title="Edit test"
                      style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(test)}
                      title="Delete test"
                      style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Inline result */}
                {lastResult && !isExpanded && (
                  <div style={{
                    margin: '0 20px 10px 20px',
                    padding: '8px 12px', borderRadius: 8, fontSize: 12,
                    background: lastResult.passed ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                    border: `1px solid ${lastResult.passed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                    color: lastResult.passed ? '#10B981' : '#EF4444',
                  }}>
                    {lastResult.output} ({lastResult.duration}ms)
                  </div>
                )}

                {/* Results Drawer */}
                {isExpanded && (
                  <ResultsDrawer test={test} onClose={() => setExpandedId(null)} />
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <TestModal
          initial={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(undefined) }}
          onSave={handleSaveTest}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
