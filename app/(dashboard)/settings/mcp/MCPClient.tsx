'use client'

import { useState, useEffect, useCallback } from 'react'
import { Server, Key, Copy, Check, Plus, Trash2, ChevronDown, ChevronRight, ExternalLink, Zap, Shield } from 'lucide-react'

interface MCPKey {
  id: string
  name: string
  keyPrefix: string
  permissions: string[] | null
  status: 'active' | 'revoked' | 'expired'
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

const MCP_TOOLS_LIST = [
  { name: 'list_frameworks', description: 'List all active compliance frameworks', params: 'includeControls?: boolean' },
  { name: 'get_control_status', description: 'Get full control details including evidence and findings', params: 'controlId: string' },
  { name: 'list_findings', description: 'List findings with severity and status filters', params: 'severity?, status?, limit?' },
  { name: 'create_finding', description: 'Create a new compliance or security finding', params: 'title, description, severity, affectedAsset?' },
  { name: 'list_tasks', description: 'List compliance tasks with status filter', params: 'status?, assignedToMe?, limit?' },
  { name: 'update_task_status', description: "Update a task's status", params: 'taskId, status' },
  { name: 'get_compliance_score', description: 'Get overall or per-framework compliance score', params: 'frameworkId?' },
  { name: 'search_controls', description: 'Full-text search controls by title or description', params: 'query, frameworkId?, limit?' },
  { name: 'list_evidence', description: 'List evidence items with optional filters', params: 'controlId?, status?, limit?' },
  { name: 'get_risk_summary', description: 'Risk summary: findings, overdue tasks, low-score frameworks', params: 'none' },
]

const SCOPE_OPTIONS = [
  { value: 'mcp:read', label: 'mcp:read', description: 'Read-only access to controls, findings, tasks, frameworks' },
  { value: 'mcp:write', label: 'mcp:write', description: 'Create and update findings and tasks (includes read)' },
  { value: 'admin:*', label: 'admin:*', description: 'Full administrative access' },
]

export default function MCPClient() {
  const [keys, setKeys] = useState<MCPKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['mcp:read'])
  const [creating, setCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedTools, setExpandedTools] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/mcp-keys')
      if (res.ok) {
        const data = await res.json()
        setKeys(data.keys ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // ignore
    }
  }

  const handleCreate = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/settings/mcp-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim(), permissions: newKeyScopes }),
      })
      if (res.ok) {
        const data = await res.json()
        setCreatedKey(data.key)
        await fetchKeys()
      }
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (keyId: string) => {
    setRevoking(keyId)
    try {
      await fetch(`/api/settings/mcp-keys/${keyId}`, { method: 'DELETE' })
      await fetchKeys()
    } finally {
      setRevoking(null)
    }
  }

  const claudeConfig = `{
  "mcpServers": {
    "compliguard": {
      "url": "${typeof window !== 'undefined' ? window.location.origin : 'https://YOUR_DOMAIN'}/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_MCP_KEY" }
    }
  }
}`

  const sectionStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    backdropFilter: 'blur(20px)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: 12,
    display: 'block',
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Server size={18} color="#06B6D4" />
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            MCP Server
          </h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Connect AI agents (Claude, OpenClaw) to CompliGuard via the Model Context Protocol. AI agents can read compliance data, create findings, and update tasks through natural language.
        </p>
      </div>

      {/* Section 1: Server Status */}
      <div style={sectionStyle}>
        <span style={labelStyle}>Server Status</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 8px #4ADE80' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#4ADE80' }}>Active</span>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{
                fontSize: 12, color: 'var(--text-secondary)',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, padding: '4px 10px', fontFamily: 'monospace', flex: 1,
              }}>
                {typeof window !== 'undefined' ? window.location.origin : 'https://YOUR_DOMAIN'}/api/mcp
              </code>
              <button
                onClick={() => copyToClipboard(
                  `${typeof window !== 'undefined' ? window.location.origin : ''}/api/mcp`,
                  'endpoint'
                )}
                style={{
                  padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-muted)',
                }}
              >
                {copiedId === 'endpoint' ? <Check size={13} color="#4ADE80" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
              color: '#8B5CF6', background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.25)',
              padding: '3px 10px', borderRadius: 100,
            }}>
              Protocol 2024-11-05
            </span>
            <a
              href="/api/mcp/manifest"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
                color: '#06B6D4', background: 'rgba(6,182,212,0.08)',
                border: '1px solid rgba(6,182,212,0.2)',
                padding: '3px 10px', borderRadius: 100,
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              Manifest <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>

      {/* Section 2: MCP API Keys */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={labelStyle}>MCP API Keys</span>
          <button
            onClick={() => { setShowCreateModal(true); setCreatedKey(null); setNewKeyName(''); setNewKeyScopes(['mcp:read']) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(6,182,212,0.15))',
              border: '1px solid rgba(139,92,246,0.4)',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
            }}
          >
            <Plus size={14} /> Create MCP Key
          </button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading keys...</div>
        ) : keys.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 20px',
            background: 'rgba(255,255,255,0.02)', borderRadius: 10,
            border: '1px dashed rgba(255,255,255,0.08)',
          }}>
            <Key size={24} color="var(--text-muted)" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No MCP API keys yet. Create one to connect AI agents.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Name', 'Key Prefix', 'Scopes', 'Last Used', 'Status', ''].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{k.name}</td>
                    <td style={{ padding: '12px 12px' }}>
                      <code style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 4 }}>
                        {k.keyPrefix}...
                      </code>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(k.permissions ?? ['mcp:read']).map((p) => (
                          <span key={p} style={{
                            fontSize: 10, fontWeight: 600,
                            color: p === 'admin:*' ? '#F87171' : p === 'mcp:write' ? '#FBBF24' : '#4ADE80',
                            background: p === 'admin:*' ? 'rgba(248,113,113,0.1)' : p === 'mcp:write' ? 'rgba(251,191,36,0.1)' : 'rgba(74,222,128,0.1)',
                            border: `1px solid ${p === 'admin:*' ? 'rgba(248,113,113,0.2)' : p === 'mcp:write' ? 'rgba(251,191,36,0.2)' : 'rgba(74,222,128,0.2)'}`,
                            padding: '2px 7px', borderRadius: 100,
                          }}>{p}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                        color: k.status === 'active' ? '#4ADE80' : '#F87171',
                        background: k.status === 'active' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                        border: `1px solid ${k.status === 'active' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                        padding: '2px 7px', borderRadius: 100,
                      }}>{k.status}</span>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <button
                        onClick={() => handleRevoke(k.id)}
                        disabled={revoking === k.id || k.status !== 'active'}
                        style={{
                          padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
                          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                          color: '#F87171', opacity: (revoking === k.id || k.status !== 'active') ? 0.5 : 1,
                        }}
                        title="Revoke key"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Quick Connect (Claude Desktop) */}
      <div style={sectionStyle}>
        <span style={labelStyle}>Quick Connect — Claude Desktop</span>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Add this to your <code style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4 }}>claude_desktop_config.json</code> to connect Claude Desktop to CompliGuard.
        </p>
        <div style={{ position: 'relative' }}>
          <pre style={{
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: 16, overflowX: 'auto',
            fontSize: 12, color: '#A78BFA', fontFamily: 'monospace', lineHeight: 1.7,
            margin: 0,
          }}>
            {claudeConfig}
          </pre>
          <button
            onClick={() => copyToClipboard(claudeConfig, 'claude-config')}
            style={{
              position: 'absolute', top: 10, right: 10,
              padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
              background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)',
              color: 'var(--text-primary)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {copiedId === 'claude-config' ? <><Check size={12} color="#4ADE80" /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <Zap size={13} color="#06B6D4" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: 'rgba(6,182,212,0.8)', lineHeight: 1.5, margin: 0 }}>
            Replace <strong>YOUR_DOMAIN</strong> with your CompliGuard deployment URL and <strong>YOUR_MCP_KEY</strong> with a key created above. Use <code style={{ fontFamily: 'monospace' }}>mcp:read</code> for read-only agents.
          </p>
        </div>
      </div>

      {/* Section 4: Tool Reference */}
      <div style={sectionStyle}>
        <button
          onClick={() => setExpandedTools(!expandedTools)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <span style={labelStyle}>Tool Reference ({MCP_TOOLS_LIST.length} tools)</span>
          {expandedTools ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
        </button>

        {expandedTools && (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Tool Name', 'Description', 'Parameters'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MCP_TOOLS_LIST.map((tool) => (
                  <tr key={tool.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <code style={{ fontSize: 11.5, color: '#A78BFA', fontFamily: 'monospace', background: 'rgba(139,92,246,0.1)', padding: '2px 7px', borderRadius: 4 }}>
                        {tool.name}
                      </code>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{tool.description}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <code style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{tool.params}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#0F1629', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 28, width: '100%', maxWidth: 480,
          }}>
            {createdKey ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <Shield size={18} color="#4ADE80" />
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Key Created</h2>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                  Copy your API key now — it will not be shown again.
                </p>
                <div style={{ position: 'relative', marginBottom: 20 }}>
                  <code style={{
                    display: 'block', padding: '12px 48px 12px 14px',
                    background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)',
                    borderRadius: 8, fontSize: 12.5, fontFamily: 'monospace',
                    color: '#4ADE80', wordBreak: 'break-all', lineHeight: 1.6,
                  }}>
                    {createdKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(createdKey, 'created-key')}
                    style={{
                      position: 'absolute', top: 10, right: 10,
                      padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                      background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)',
                      color: '#4ADE80',
                    }}
                  >
                    {copiedId === 'created-key' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
                  }}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Create MCP API Key</h2>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Key Name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Claude Desktop, OpenClaw Agent"
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 8, boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>Scopes</label>
                  {SCOPE_OPTIONS.map((scope) => (
                    <label key={scope.value} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10,
                      cursor: 'pointer', padding: '10px 12px', borderRadius: 8,
                      background: newKeyScopes.includes(scope.value) ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${newKeyScopes.includes(scope.value) ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    }}>
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes(scope.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewKeyScopes([...newKeyScopes, scope.value])
                          } else {
                            setNewKeyScopes(newKeyScopes.filter((s) => s !== scope.value))
                          }
                        }}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace', marginBottom: 2 }}>{scope.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{scope.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newKeyName.trim() || newKeyScopes.length === 0}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                      background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                      border: 'none', color: 'white', fontSize: 14, fontWeight: 600,
                      opacity: (creating || !newKeyName.trim() || newKeyScopes.length === 0) ? 0.6 : 1,
                    }}
                  >
                    {creating ? 'Creating...' : 'Create Key'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
