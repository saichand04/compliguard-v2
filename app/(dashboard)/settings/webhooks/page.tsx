'use client'

import { useState, useEffect, useCallback } from 'react'
import { Webhook, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Clock, Send, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookRecord {
  id: string
  name: string
  url: string
  events: string[]
  status: 'active' | 'inactive' | 'failing'
  consecutiveFailures: string
  lastDeliveryAt: string | null
  lastSuccessAt: string | null
  createdAt: string
}

interface Delivery {
  id: string
  webhookId: string
  eventType: string
  status: 'pending' | 'delivered' | 'failed' | 'retrying'
  responseStatus: string | null
  responseBody: string | null
  attempts: string
  deliveredAt: string | null
  createdAt: string
}

// ─── Event types ──────────────────────────────────────────────────────────────

const ALL_EVENTS = [
  { value: 'finding.created', label: 'Finding Created', group: 'Findings' },
  { value: 'finding.updated', label: 'Finding Updated', group: 'Findings' },
  { value: 'finding.resolved', label: 'Finding Resolved', group: 'Findings' },
  { value: 'evidence.uploaded', label: 'Evidence Uploaded', group: 'Evidence' },
  { value: 'evidence.approved', label: 'Evidence Approved', group: 'Evidence' },
  { value: 'task.created', label: 'Task Created', group: 'Tasks' },
  { value: 'task.completed', label: 'Task Completed', group: 'Tasks' },
  { value: 'control.status_changed', label: 'Control Status Changed', group: 'Controls' },
  { value: 'scan.completed', label: 'Scan Completed', group: 'Scans' },
  { value: 'questionnaire.completed', label: 'Questionnaire Completed', group: 'Vendors' },
]

const EVENT_GROUPS = [...new Set(ALL_EVENTS.map(e => e.group))]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: WebhookRecord['status'] }) {
  const config = {
    active: { color: '#4ADE80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.2)' },
    inactive: { color: '#94A3B8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' },
    failing: { color: '#F87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' },
  }[status]
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 100, fontWeight: 700,
      textTransform: 'uppercase' as const, letterSpacing: '0.05em',
      color: config.color, background: config.bg, border: `1px solid ${config.border}`,
    }}>
      {status}
    </span>
  )
}

function DeliveryStatusIcon({ status }: { status: Delivery['status'] }) {
  if (status === 'delivered') return <CheckCircle size={13} color="#4ADE80" />
  if (status === 'failed') return <XCircle size={13} color="#F87171" />
  if (status === 'retrying') return <RefreshCw size={13} color="#FBBF24" />
  return <Clock size={13} color="#94A3B8" />
}

// ─── Create Webhook Modal ─────────────────────────────────────────────────────

interface CreateWebhookModalProps {
  onClose: () => void
  onCreated: (webhook: WebhookRecord) => void
}

function CreateWebhookModal({ onClose, onCreated }: CreateWebhookModalProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  const toggleGroup = (group: string) => {
    const groupEvents = ALL_EVENTS.filter(e => e.group === group).map(e => e.value)
    const allSelected = groupEvents.every(e => selectedEvents.includes(e))
    if (allSelected) {
      setSelectedEvents(prev => prev.filter(e => !groupEvents.includes(e)))
    } else {
      setSelectedEvents(prev => [...new Set([...prev, ...groupEvents])])
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    if (!url.trim()) { setError('URL is required'); return }
    if (!url.startsWith('https://')) { setError('URL must use HTTPS'); return }
    if (selectedEvents.length === 0) { setError('Select at least one event'); return }
    setLoading(true); setError('')
    try {
      const body: Record<string, unknown> = { name: name.trim(), url: url.trim(), events: selectedEvents }
      if (secret.trim()) body.secret = secret.trim()
      const res = await fetch('/api/settings/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create webhook')
      onCreated(data.webhook)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 540, maxHeight: '90vh', overflowY: 'auto',
          background: '#0E1225', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: 28, boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 22 }}>
          Add Webhook
        </h2>

        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Slack Alerts, PagerDuty"
            style={{
              width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'var(--text-primary)',
              fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* URL */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Endpoint URL <span style={{ color: '#F87171' }}>HTTPS required</span>
          </label>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            style={{
              width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${url && !url.startsWith('https://') ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Secret */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            Signing Secret <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — auto-generated if empty)</span>
          </label>
          <input
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="Leave blank to auto-generate"
            style={{
              width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'var(--text-primary)',
              fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
          <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            Signature header: <code style={{ fontFamily: 'monospace', color: '#A78BFA' }}>X-CompliGuard-Signature: sha256=…</code>
          </p>
        </div>

        {/* Events */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 10 }}>
            Events ({selectedEvents.length} selected)
          </label>
          {EVENT_GROUPS.map(group => {
            const groupEvents = ALL_EVENTS.filter(e => e.group === group)
            const allSelected = groupEvents.every(e => selectedEvents.includes(e.value))
            return (
              <div key={group} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {group}
                  </span>
                  <button
                    onClick={() => toggleGroup(group)}
                    style={{
                      fontSize: 10, padding: '1px 7px', borderRadius: 4, cursor: 'pointer',
                      background: allSelected ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${allSelected ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      color: allSelected ? '#A78BFA' : 'var(--text-muted)',
                    }}
                  >
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {groupEvents.map(event => {
                    const sel = selectedEvents.includes(event.value)
                    return (
                      <button
                        key={event.value}
                        onClick={() => toggleEvent(event.value)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                          border: sel ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.08)',
                          background: sel ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                          color: sel ? '#A78BFA' : 'var(--text-secondary)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {event.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {error && <p style={{ color: '#F87171', fontSize: 12, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
          }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading} style={{
            padding: '9px 20px', borderRadius: 8, background: loading ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.9)',
            border: 'none', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            {loading ? 'Creating…' : 'Add Webhook'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteDialog({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        width: 380, background: '#0E1225', border: '1px solid rgba(248,113,113,0.25)',
        borderRadius: 14, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#F87171', marginBottom: 10 }}>Delete Webhook</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
          Delete <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>? This will stop all future deliveries.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '8px 16px', borderRadius: 8, background: 'rgba(248,113,113,0.15)',
            border: '1px solid rgba(248,113,113,0.35)', color: '#F87171', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>Delete Webhook</button>
        </div>
      </div>
    </div>
  )
}

// ─── Webhook Row ──────────────────────────────────────────────────────────────

function WebhookRow({
  webhook,
  onDelete,
  onTest,
}: {
  webhook: WebhookRecord
  onDelete: () => void
  onTest: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loadingDeliveries, setLoadingDeliveries] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const loadDeliveries = async () => {
    setLoadingDeliveries(true)
    try {
      const res = await fetch(`/api/settings/webhooks/${webhook.id}/deliveries`)
      const data = await res.json()
      setDeliveries(data.deliveries ?? [])
    } finally {
      setLoadingDeliveries(false)
    }
  }

  const handleToggle = () => {
    const next = !expanded
    setExpanded(next)
    if (next && deliveries.length === 0) loadDeliveries()
  }

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch(`/api/settings/webhooks/${webhook.id}/test`, { method: 'POST' })
      const data = await res.json()
      setTestResult(res.ok ? 'Test ping sent successfully' : (data.error ?? 'Test failed'))
      onTest()
      if (expanded) loadDeliveries()
    } finally {
      setTesting(false)
      setTimeout(() => setTestResult(null), 3000)
    }
  }

  const handleRetry = async (deliveryId: string) => {
    await fetch(`/api/settings/webhooks/${webhook.id}/deliveries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId }),
    })
    loadDeliveries()
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 10,
    }}>
      {/* Row header */}
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Status dot */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: webhook.status === 'active' ? '#4ADE80' : webhook.status === 'failing' ? '#F87171' : '#94A3B8',
          boxShadow: webhook.status === 'active' ? '0 0 6px rgba(74,222,128,0.6)' : undefined,
        }} />

        {/* Name + URL */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {webhook.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {webhook.url}
          </div>
        </div>

        {/* Status badge */}
        <StatusBadge status={webhook.status} />

        {/* Event count */}
        <span style={{
          fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '3px 8px',
        }}>
          {webhook.events.length} event{webhook.events.length !== 1 ? 's' : ''}
        </span>

        {/* Last delivery */}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 100 }}>
          {formatDate(webhook.lastDeliveryAt)}
        </span>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handleTest}
            disabled={testing}
            title="Send test ping"
            style={{
              background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
              borderRadius: 7, padding: '5px 10px', cursor: testing ? 'not-allowed' : 'pointer',
              color: '#22D3EE', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Send size={11} />
            {testing ? 'Sending…' : 'Test'}
          </button>
          <button
            onClick={onDelete}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 5, borderRadius: 6,
            }}
            title="Delete webhook"
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={handleToggle}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center',
            }}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Test result toast */}
      {testResult && (
        <div style={{
          margin: '0 18px 12px',
          padding: '8px 12px', borderRadius: 8, fontSize: 12,
          background: testResult.includes('successfully') ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
          border: `1px solid ${testResult.includes('successfully') ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
          color: testResult.includes('successfully') ? '#4ADE80' : '#F87171',
        }}>
          {testResult}
        </div>
      )}

      {/* Expanded: events + delivery history */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 18px' }}>
          {/* Subscribed events */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Subscribed Events
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {webhook.events.map(e => (
                <span key={e} style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                  color: '#A78BFA',
                }}>{e}</span>
              ))}
            </div>
          </div>

          {/* Delivery history */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Delivery History (last 20)
              </div>
              <button onClick={loadDeliveries} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <RefreshCw size={12} />
              </button>
            </div>

            {loadingDeliveries ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Loading…</div>
            ) : deliveries.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No deliveries yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {deliveries.map(d => (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                      background: 'rgba(0,0,0,0.15)', borderRadius: 7, fontSize: 12,
                    }}
                  >
                    <DeliveryStatusIcon status={d.status} />
                    <span style={{ color: '#A78BFA', minWidth: 160 }}>{d.eventType}</span>
                    <span style={{ color: 'var(--text-muted)', minWidth: 40 }}>
                      {d.responseStatus ? `HTTP ${d.responseStatus}` : '—'}
                    </span>
                    <span style={{ color: 'var(--text-muted)', flex: 1 }}>
                      {formatDate(d.createdAt)}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {d.attempts} attempt{Number(d.attempts) !== 1 ? 's' : ''}
                    </span>
                    {d.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(d.id)}
                        style={{
                          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
                          borderRadius: 5, padding: '2px 7px', cursor: 'pointer', color: '#FBBF24',
                          fontSize: 10, display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <RotateCcw size={10} />
                        Retry
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const [webhooksList, setWebhooksList] = useState<WebhookRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WebhookRecord | null>(null)

  const fetchWebhooks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/webhooks')
      const data = await res.json()
      setWebhooksList(data.webhooks ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWebhooks() }, [fetchWebhooks])

  const handleCreated = (webhook: WebhookRecord) => {
    setShowCreate(false)
    setWebhooksList(prev => [webhook, ...prev])
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await fetch(`/api/settings/webhooks/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    fetchWebhooks()
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Webhook size={18} color="#06B6D4" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Webhooks
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Send real-time event notifications to external endpoints
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={fetchWebhooks}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center',
            }}
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 8,
              color: '#22D3EE', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            <Plus size={14} />
            Add Webhook
          </button>
        </div>
      </div>

      {/* Signature info */}
      <div style={{
        marginBottom: 24, padding: '14px 18px', borderRadius: 12,
        background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)',
        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
      }}>
        Payloads are signed with HMAC-SHA256.{' '}
        Verify with header{' '}
        <code style={{ fontFamily: 'monospace', color: '#A78BFA', fontSize: 12 }}>X-CompliGuard-Signature: sha256=…</code>
        {' '}and event type via{' '}
        <code style={{ fontFamily: 'monospace', color: '#A78BFA', fontSize: 12 }}>X-CompliGuard-Event</code>.
      </div>

      {/* Webhooks list */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading webhooks…</div>
      ) : webhooksList.length === 0 ? (
        <div style={{
          padding: '48px 32px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: 14, color: 'var(--text-muted)', fontSize: 13,
        }}>
          <Webhook size={28} color="rgba(255,255,255,0.1)" style={{ marginBottom: 12 }} />
          <div style={{ marginBottom: 6, fontSize: 14, color: 'var(--text-secondary)' }}>No webhooks yet</div>
          <div>Add a webhook to receive real-time compliance event notifications.</div>
        </div>
      ) : (
        <div>
          {webhooksList.map(webhook => (
            <WebhookRow
              key={webhook.id}
              webhook={webhook}
              onDelete={() => setDeleteTarget(webhook)}
              onTest={fetchWebhooks}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateWebhookModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
      {deleteTarget && (
        <DeleteDialog
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
