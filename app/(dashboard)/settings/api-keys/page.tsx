'use client'

import { useState, useEffect, useCallback } from 'react'
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, RefreshCw, Terminal } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  status: 'active' | 'revoked' | 'expired'
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

interface McpKey {
  id: string
  name: string
  keyPrefix: string
  permissions: string[]
  status: 'active' | 'revoked' | 'expired'
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

// ─── Scope definitions ───────────────────────────────────────────────────────

const SCOPE_GROUPS = [
  {
    label: 'Read',
    scopes: [
      { value: 'read:controls', label: 'Controls' },
      { value: 'read:findings', label: 'Findings' },
      { value: 'read:evidence', label: 'Evidence' },
      { value: 'read:tasks', label: 'Tasks' },
      { value: 'read:vendors', label: 'Vendors' },
      { value: 'read:frameworks', label: 'Frameworks' },
      { value: 'read:org', label: 'Organization' },
    ],
  },
  {
    label: 'Write',
    scopes: [
      { value: 'write:controls', label: 'Controls' },
      { value: 'write:findings', label: 'Findings' },
      { value: 'write:evidence', label: 'Evidence' },
      { value: 'write:tasks', label: 'Tasks' },
    ],
  },
  {
    label: 'Admin',
    scopes: [{ value: 'admin:*', label: 'Full Access (all scopes)' }],
  },
]

const EXPIRY_OPTIONS = [
  { label: 'Never', value: null },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '1 year', value: 365 },
  { label: 'Custom date', value: 'custom' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelative(s: string | null) {
  if (!s) return 'Never'
  const diff = Date.now() - new Date(s).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      style={{
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex',
        alignItems: 'center', gap: 4, color: copied ? '#4ADE80' : 'var(--text-secondary)',
        fontSize: 12, transition: 'all 0.15s',
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ─── Create Key Modal ─────────────────────────────────────────────────────────

interface CreateKeyModalProps {
  onClose: () => void
  onCreated: (key: ApiKey, fullKey: string) => void
}

function CreateKeyModal({ onClose, onCreated }: CreateKeyModalProps) {
  const [name, setName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [expiry, setExpiry] = useState<number | 'custom' | null>(null)
  const [customDate, setCustomDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleScope = (scope: string) => {
    if (scope === 'admin:*') {
      setSelectedScopes(prev => prev.includes('admin:*') ? [] : ['admin:*'])
      return
    }
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev.filter(s => s !== 'admin:*'), scope]
    )
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    if (selectedScopes.length === 0) { setError('Select at least one scope'); return }
    setLoading(true); setError('')
    try {
      const body: Record<string, unknown> = { name: name.trim(), scopes: selectedScopes }
      if (expiry === 'custom' && customDate) body.expiresAt = customDate
      else if (typeof expiry === 'number') body.expiresIn = expiry

      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create key')
      onCreated(data.apiKey, data.key)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520, background: '#0E1225', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: 28, boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
          Create API Key
        </h2>

        {/* Name */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Key Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. CI/CD Pipeline, Monitoring Tool"
            style={{
              width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'var(--text-primary)',
              fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Scopes */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 10 }}>
            Scopes
          </label>
          {SCOPE_GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                {group.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {group.scopes.map(scope => {
                  const active = selectedScopes.includes(scope.value) || (scope.value !== 'admin:*' && selectedScopes.includes('admin:*'))
                  return (
                    <button
                      key={scope.value}
                      onClick={() => toggleScope(scope.value)}
                      style={{
                        padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        border: active ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                        background: active ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                        color: active ? '#A78BFA' : 'var(--text-secondary)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {scope.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Expiry */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
            Expiration
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EXPIRY_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setExpiry(opt.value as number | 'custom' | null)}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  border: expiry === opt.value ? '1px solid rgba(6,182,212,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: expiry === opt.value ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.04)',
                  color: expiry === opt.value ? '#22D3EE' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {expiry === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              style={{
                marginTop: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'var(--text-primary)',
                fontSize: 13, outline: 'none',
              }}
            />
          )}
        </div>

        {error && <p style={{ color: '#F87171', fontSize: 12, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
          }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: '9px 20px', borderRadius: 8, background: loading ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.9)',
              border: 'none', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            {loading ? 'Creating…' : 'Create Key'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Key Reveal Modal ─────────────────────────────────────────────────────────

function KeyRevealModal({ fullKey, onClose }: { fullKey: string; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: 520, background: '#0E1225', border: '1px solid rgba(251,191,36,0.3)',
        borderRadius: 16, padding: 28, boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Key size={18} color="#FBBF24" />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#FBBF24' }}>Save Your API Key</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 18 }}>
          This key will <strong style={{ color: 'var(--text-primary)' }}>not be shown again</strong>. Copy it now and store it securely.
        </p>

        <div style={{
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
          fontFamily: 'monospace', fontSize: 13,
        }}>
          <span style={{ flex: 1, wordBreak: 'break-all', color: visible ? '#A78BFA' : 'var(--text-muted)', letterSpacing: visible ? 0 : 2 }}>
            {visible ? fullKey : '•'.repeat(Math.min(fullKey.length, 48))}
          </span>
          <button onClick={() => setVisible(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <CopyButton text={fullKey} />
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '10px', borderRadius: 8, background: 'rgba(139,92,246,0.9)',
            border: 'none', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          I&apos;ve saved my key
        </button>
      </div>
    </div>
  )
}

// ─── Revoke Confirm Dialog ────────────────────────────────────────────────────

function RevokeDialog({ keyName, onConfirm, onCancel }: { keyName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        width: 380, background: '#0E1225', border: '1px solid rgba(248,113,113,0.25)',
        borderRadius: 14, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#F87171', marginBottom: 10 }}>Revoke API Key</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
          Revoking <strong style={{ color: 'var(--text-primary)' }}>{keyName}</strong> is permanent.
          Any systems using this key will lose access immediately.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            padding: '8px 16px', borderRadius: 8, background: 'rgba(248,113,113,0.15)',
            border: '1px solid rgba(248,113,113,0.35)', color: '#F87171', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            Revoke Key
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Keys Table ───────────────────────────────────────────────────────────────

function KeysTable({
  keys,
  onRevoke,
  emptyLabel,
}: {
  keys: ApiKey[] | McpKey[]
  onRevoke: (id: string) => void
  emptyLabel: string
}) {
  if (keys.length === 0) {
    return (
      <div style={{
        padding: '32px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)',
        borderRadius: 12, color: 'var(--text-muted)', fontSize: 13,
      }}>
        {emptyLabel}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Name', 'Key Prefix', 'Scopes / Permissions', 'Status', 'Last Used', 'Expires', 'Actions'].map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700,
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const scopes = ('scopes' in k ? k.scopes : k.permissions) ?? []
            return (
              <tr key={k.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{k.name}</td>
                <td style={{ padding: '10px 12px' }}>
                  <code style={{
                    fontSize: 12, padding: '3px 7px', borderRadius: 4,
                    background: 'rgba(255,255,255,0.06)', color: '#A78BFA',
                    fontFamily: 'monospace',
                  }}>
                    {k.keyPrefix}…
                  </code>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {scopes.slice(0, 4).map((s: string) => (
                      <span key={s} style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 4,
                        background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
                        color: '#22D3EE',
                      }}>{s}</span>
                    ))}
                    {scopes.length > 4 && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{scopes.length - 4}</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 100, fontWeight: 600, textTransform: 'uppercase',
                    background: k.status === 'active' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                    border: `1px solid ${k.status === 'active' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                    color: k.status === 'active' ? '#4ADE80' : '#F87171',
                  }}>{k.status}</span>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{formatRelative(k.lastUsedAt)}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{formatDate(k.expiresAt)}</td>
                <td style={{ padding: '10px 12px' }}>
                  {k.status === 'active' && (
                    <button
                      onClick={() => onRevoke(k.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 4, borderRadius: 4,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                      title="Revoke key"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const [apiKeysList, setApiKeysList] = useState<ApiKey[]>([])
  const [mcpKeysList, setMcpKeysList] = useState<McpKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCreateMcp, setShowCreateMcp] = useState(false)
  const [revealKey, setRevealKey] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string; isMcp?: boolean } | null>(null)
  const [mcpName, setMcpName] = useState('')
  const [mcpLoading, setMcpLoading] = useState(false)

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    try {
      const [akRes, mcpRes] = await Promise.all([
        fetch('/api/settings/api-keys'),
        fetch('/api/settings/mcp-keys'),
      ])
      if (akRes.ok) {
        const d = await akRes.json()
        setApiKeysList(d.keys ?? [])
      }
      if (mcpRes.ok) {
        const d = await mcpRes.json()
        setMcpKeysList(d.keys ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  const handleKeyCreated = (key: ApiKey, fullKey: string) => {
    setShowCreateModal(false)
    setApiKeysList(prev => [key, ...prev])
    setRevealKey(fullKey)
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    const endpoint = revokeTarget.isMcp
      ? `/api/settings/mcp-keys/${revokeTarget.id}`
      : `/api/settings/api-keys/${revokeTarget.id}`
    await fetch(endpoint, { method: 'DELETE' })
    setRevokeTarget(null)
    fetchKeys()
  }

  const handleCreateMcp = async () => {
    if (!mcpName.trim()) return
    setMcpLoading(true)
    try {
      const res = await fetch('/api/settings/mcp-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: mcpName.trim(), permissions: ['tools:*'] }),
      })
      const data = await res.json()
      if (res.ok) {
        setMcpKeysList(prev => [data.mcpKey, ...prev])
        setRevealKey(data.key)
        setShowCreateMcp(false)
        setMcpName('')
      }
    } finally {
      setMcpLoading(false)
    }
  }

  const SectionCard = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: 22, backdropFilter: 'blur(20px)', marginBottom: 24,
    }}>
      {children}
    </div>
  )

  return (
    <div className="animate-fade-in" style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Key size={18} color="#8B5CF6" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              API Keys
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Manage API keys for programmatic access to the CompliGuard REST API
            </p>
          </div>
        </div>
        <button
          onClick={fetchKeys}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Info box */}
      <div style={{
        marginBottom: 24, padding: '14px 18px', borderRadius: 12,
        background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)',
        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
      }}>
        <strong style={{ color: '#22D3EE' }}>Base URL:</strong>{' '}
        <code style={{ fontFamily: 'monospace', color: '#A78BFA', fontSize: 12 }}>
          https://your-instance.com/api/v1
        </code>
        {'  '}— authenticate with{' '}
        <code style={{ fontFamily: 'monospace', color: '#A78BFA', fontSize: 12 }}>
          Authorization: Bearer cgk_…
        </code>
      </div>

      {/* API Keys section */}
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>REST API Keys</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Keys for the public REST API v1 (/api/v1/*)
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'rgba(139,92,246,0.85)', border: 'none', borderRadius: 8,
              color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            <Plus size={14} />
            Create API Key
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
        ) : (
          <KeysTable
            keys={apiKeysList}
            onRevoke={(id) => {
              const key = apiKeysList.find(k => k.id === id)
              if (key) setRevokeTarget({ id, name: key.name })
            }}
            emptyLabel="No API keys yet. Create your first key to get started."
          />
        )}
      </SectionCard>

      {/* MCP API Keys section */}
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Terminal size={16} color="#8B5CF6" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>MCP API Keys</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Keys for AI agent / MCP tool integrations
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCreateMcp(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 8,
              color: '#22D3EE', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            <Plus size={14} />
            Create MCP Key
          </button>
        </div>

        {showCreateMcp && (
          <div style={{
            marginBottom: 16, padding: '16px', background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <input
              value={mcpName}
              onChange={e => setMcpName(e.target.value)}
              placeholder="MCP key name (e.g. Claude Desktop)"
              style={{
                flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                color: 'var(--text-primary)', fontSize: 13, outline: 'none',
              }}
            />
            <button onClick={handleCreateMcp} disabled={mcpLoading} style={{
              padding: '8px 14px', background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)',
              borderRadius: 8, color: '#22D3EE', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>
              {mcpLoading ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowCreateMcp(false)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
            }}>✕</button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
        ) : (
          <KeysTable
            keys={mcpKeysList as unknown as ApiKey[]}
            onRevoke={(id) => {
              const key = mcpKeysList.find(k => k.id === id)
              if (key) setRevokeTarget({ id, name: key.name, isMcp: true })
            }}
            emptyLabel="No MCP keys yet."
          />
        )}
      </SectionCard>

      {/* Modals */}
      {showCreateModal && (
        <CreateKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleKeyCreated}
        />
      )}
      {revealKey && (
        <KeyRevealModal fullKey={revealKey} onClose={() => setRevealKey(null)} />
      )}
      {revokeTarget && (
        <RevokeDialog
          keyName={revokeTarget.name}
          onConfirm={handleRevoke}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </div>
  )
}
