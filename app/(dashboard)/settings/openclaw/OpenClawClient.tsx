'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Satellite, Plus, Trash2, RefreshCw, Download, Copy, Check,
  Clock, Wifi, WifiOff, ChevronDown, ChevronUp, ExternalLink,
  AlertCircle, CheckCircle, Loader2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpenClawInstance {
  id: string
  name: string
  url: string
  registeredAt: string
  lastPingAt: string | null
}

interface AuditEntry {
  id: string
  resourceTitle: string | null
  createdAt: string
  description: string | null
  metadata: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOnline(lastPingAt: string | null): boolean {
  if (!lastPingAt) return false
  return Date.now() - new Date(lastPingAt).getTime() < 5 * 60 * 1000
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

// ---------------------------------------------------------------------------
// Register modal
// ---------------------------------------------------------------------------

function RegisterModal({
  onClose,
  onRegistered,
}: {
  onClose: () => void
  onRegistered: () => void
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/mcp/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: name, instanceUrl: url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Registration failed')
      onRegistered()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', border: '1px solid var(--border-glass)',
          borderRadius: 16, padding: 28, width: '100%', maxWidth: 440,
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
          Register New Instance
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
              Instance Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="My OpenClaw Agent"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
              Instance URL
            </label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              type="url"
              placeholder="https://openclaw.example.com"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
              }}
            />
          </div>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: 13,
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border-glass)',
                color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, cursor: loading ? 'default' : 'pointer',
                background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', border: 'none',
                color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
              Register
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OpenClawClient() {
  const [instances, setInstances] = useState<OpenClawInstance[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [loadingInstances, setLoadingInstances] = useState(true)
  const [loadingAudit, setLoadingAudit] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [expandedAudit, setExpandedAudit] = useState(true)

  const domain = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'

  const loadInstances = useCallback(async () => {
    setLoadingInstances(true)
    try {
      const res = await fetch('/api/mcp/register')
      if (res.ok) {
        const data = await res.json()
        setInstances(data.instances ?? [])
      }
    } finally {
      setLoadingInstances(false)
    }
  }, [])

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true)
    try {
      const res = await fetch('/api/audit-logs?action=mcp.tool_call&limit=20')
      if (res.ok) {
        const data = await res.json()
        setAuditEntries(data.logs ?? data.entries ?? [])
      }
    } finally {
      setLoadingAudit(false)
    }
  }, [])

  useEffect(() => {
    loadInstances()
    loadAudit()
  }, [loadInstances, loadAudit])

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/mcp/register?instanceId=${id}`, { method: 'DELETE' })
      setInstances(prev => prev.filter(i => i.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const installUrl = `${domain}/public/openclaw/skill.json`
  const clawHubUrl = `https://clawhub.dev/install?url=${encodeURIComponent(installUrl)}`

  return (
    <div className="animate-fade-in" style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Satellite size={18} color="#8B5CF6" />
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            OpenClaw Integration
          </h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Connect AI agents via OpenClaw to query your compliance data using natural language.
        </p>
      </div>

      {/* Section 1 — Registered Instances */}
      <Section title="Registered Instances" action={
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            borderRadius: 8, background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
            border: 'none', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          Register New Instance
        </button>
      }>
        {loadingInstances ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: 8 }} />
            <div>Loading instances...</div>
          </div>
        ) : instances.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <Satellite size={28} color="var(--text-muted)" style={{ marginBottom: 10, opacity: 0.5 }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No instances registered yet. Click &ldquo;Register New Instance&rdquo; to add one.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                  {['Name', 'URL', 'Registered', 'Last Ping', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {instances.map(inst => {
                  const online = isOnline(inst.lastPingAt)
                  return (
                    <tr key={inst.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>{inst.name}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a href={inst.url} target="_blank" rel="noreferrer" style={{ color: 'var(--violet)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {inst.url}
                          <ExternalLink size={11} />
                        </a>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{fmtDate(inst.registeredAt)}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{fmtDate(inst.lastPingAt)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                          background: online ? 'rgba(74,222,128,0.1)' : 'rgba(156,163,175,0.1)',
                          color: online ? '#4ADE80' : 'var(--text-muted)',
                          border: `1px solid ${online ? 'rgba(74,222,128,0.2)' : 'rgba(156,163,175,0.15)'}`,
                        }}>
                          {online ? <Wifi size={10} /> : <WifiOff size={10} />}
                          {online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => handleDelete(inst.id)}
                          disabled={deletingId === inst.id}
                          title="Remove instance"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}
                        >
                          {deletingId === inst.id
                            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            : <Trash2 size={14} />
                          }
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Section 2 — Skill Pack */}
      <Section title="Skill Pack">
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 4 }}>
            Download the OpenClaw skill files to configure your agent, or install directly via ClawHub.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href="/public/openclaw/skill.json"
              download
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
                color: '#8B5CF6', textDecoration: 'none',
              }}
            >
              <Download size={14} />
              skill.json
            </a>
            <a
              href="/public/openclaw/openapi.json"
              download
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
                color: '#06B6D4', textDecoration: 'none',
              }}
            >
              <Download size={14} />
              openapi.json
            </a>
          </div>

          <div style={{
            padding: '14px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                ClawHub Install URL
              </div>
              <code style={{ fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                {clawHubUrl}
              </code>
            </div>
            <button
              onClick={() => handleCopy(clawHubUrl)}
              style={{
                background: copied ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${copied ? 'rgba(74,222,128,0.2)' : 'var(--border-glass)'}`,
                borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                color: copied ? '#4ADE80' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </Section>

      {/* Section 3 — Agent Access Log */}
      <Section
        title="Agent Access Log"
        action={
          <button
            onClick={() => setExpandedAudit(x => !x)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
          >
            {expandedAudit ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expandedAudit ? 'Collapse' : 'Expand'}
          </button>
        }
      >
        {expandedAudit && (
          loadingAudit ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: 8 }} />
              <div>Loading logs...</div>
            </div>
          ) : auditEntries.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No MCP tool calls recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    {['Tool', 'Timestamp', 'Result', 'Latency'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map(entry => {
                    const meta = (entry.metadata ?? {}) as Record<string, unknown>
                    const success = meta.success !== false
                    const latency = meta.latencyMs != null ? `${meta.latencyMs}ms` : '—'
                    return (
                      <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {entry.resourceTitle ?? (meta.tool as string) ?? '—'}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Clock size={11} />
                            {fmtDate(entry.createdAt)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                            background: success ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                            color: success ? '#4ADE80' : '#EF4444',
                            border: `1px solid ${success ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`,
                          }}>
                            {success ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                            {success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{latency}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </Section>

      {/* Section 4 — Quick Setup */}
      <Section title="Quick Setup">
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { n: 1, text: 'Install OpenClaw locally or use ClawHub at clawhub.dev' },
            { n: 2, text: 'Create an MCP API key', link: '/settings/api-keys', linkLabel: 'Settings → API Keys' },
            { n: 3, text: 'Register your instance in the "Registered Instances" section above' },
            { n: 4, text: 'In OpenClaw: add the CompliGuard skill using your domain URL and MCP API key' },
            { n: 5, text: 'Test with: ask your agent "What is my compliance score?"' },
          ].map(step => (
            <div key={step.n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#8B5CF6',
              }}>
                {step.n}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 3 }}>
                {step.text}
                {step.link && (
                  <> — <a href={step.link} style={{ color: 'var(--violet)', textDecoration: 'none' }}>{step.linkLabel}</a></>
                )}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {showModal && (
        <RegisterModal
          onClose={() => setShowModal(false)}
          onRegistered={loadInstances}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{
      marginBottom: 24, borderRadius: 16,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}
