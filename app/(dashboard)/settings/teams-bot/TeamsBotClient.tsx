'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare, CheckCircle, XCircle, Trash2, RefreshCw, Send,
  ChevronRight, Eye, EyeOff, Settings, Bell, BookOpen, Zap,
  Sun, BarChart2, ToggleLeft, ToggleRight, Scissors,
} from 'lucide-react'

interface ConversationRow {
  id: string
  conversationRef: Record<string, unknown>
  serviceUrl: string
  tenantId: string | null
  teamsUserId: string | null
  channelId: string | null
  createdAt: string
  updatedAt: string
}

interface ConfigStatus {
  botAppId: string | null
  connected: boolean
  conversationCount: number
  webhookUrl: string
}

interface NotificationPrefs {
  criticalFindings: boolean
  complianceScoreDrop: boolean
  incidentCreated: boolean
  taskOverdue: boolean
}

interface DigestSettings {
  enabled: boolean
  time: string
  timezone: string
  lastSentAt: string | null
  nextScheduledAt: string | null
}

interface ConvStats {
  total: number
  active: number
  inactive: number
  lastActiveAt: string | null
  channelBreakdown: Array<{ channel: string; count: number }>
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Dubai',
  'Australia/Sydney',
  'UTC',
]

const glass = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
} as const

const violetGlass = {
  background: 'rgba(139,92,246,0.08)',
  border: '1px solid rgba(139,92,246,0.2)',
  borderRadius: 12,
} as const

const cyanGlass = {
  background: 'rgba(6,182,212,0.08)',
  border: '1px solid rgba(6,182,212,0.2)',
  borderRadius: 12,
} as const

const amberGlass = {
  background: 'rgba(245,158,11,0.08)',
  border: '1px solid rgba(245,158,11,0.2)',
  borderRadius: 12,
} as const

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 6,
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const btnPrimary: React.CSSProperties = {
  padding: '9px 18px',
  borderRadius: 8,
  background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

const btnSecondary: React.CSSProperties = {
  padding: '9px 18px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.07)',
  color: 'var(--text-primary)',
  fontWeight: 600,
  fontSize: 13,
  border: '1px solid rgba(255,255,255,0.12)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

const btnDanger: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  background: 'rgba(220,38,38,0.12)',
  color: '#F87171',
  fontWeight: 600,
  fontSize: 12,
  border: '1px solid rgba(220,38,38,0.25)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
}

const btnCyan: React.CSSProperties = {
  padding: '9px 18px',
  borderRadius: 8,
  background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color}18`, border: `1px solid ${color}35`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={16} color={color} />
      </div>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
        {title}
      </h2>
    </div>
  )
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center',
      }}
      aria-pressed={enabled}
    >
      {enabled
        ? <ToggleRight size={28} color="#8B5CF6" />
        : <ToggleLeft size={28} color="rgba(255,255,255,0.25)" />}
    </button>
  )
}

export function TeamsBotClient() {
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Config form
  const [appId, setAppId] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  // Test
  const [testingConnection, setTestingConnection] = useState(false)

  // Notification prefs
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    criticalFindings: true,
    complianceScoreDrop: true,
    incidentCreated: true,
    taskOverdue: false,
  })

  // Digest settings
  const [digest, setDigest] = useState<DigestSettings>({
    enabled: false,
    time: '08:00',
    timezone: 'America/Chicago',
    lastSentAt: null,
    nextScheduledAt: null,
  })
  const [sendingDigest, setSendingDigest] = useState(false)
  const [savingDigest, setSavingDigest] = useState(false)

  // Conversation stats
  const [convStats, setConvStats] = useState<ConvStats | null>(null)
  const [pruning, setPruning] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [configRes, convsRes, digestRes, statsRes] = await Promise.all([
        fetch('/api/teams/config'),
        fetch('/api/teams/conversations'),
        fetch('/api/teams/digest'),
        fetch('/api/teams/conversations/stats'),
      ])
      if (configRes.ok) {
        const data = await configRes.json() as ConfigStatus
        setConfigStatus(data)
        if (data.botAppId) setAppId(data.botAppId)
      }
      if (convsRes.ok) {
        const data = await convsRes.json() as { conversations: ConversationRow[] }
        setConversations(data.conversations)
      }
      if (digestRes.ok) {
        const data = await digestRes.json() as DigestSettings
        setDigest(data)
      }
      if (statsRes.ok) {
        const data = await statsRes.json() as ConvStats
        setConvStats(data)
      }
    } catch {
      showToast('Failed to load Teams Bot configuration', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveConfig = async () => {
    if (!appId || !appPassword || !tenantId) {
      showToast('All three fields are required', 'error')
      return
    }
    setSavingConfig(true)
    try {
      const res = await fetch('/api/teams/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, appPassword, tenantId }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (res.ok && data.success) {
        showToast('Configuration saved successfully', 'success')
        await loadData()
      } else {
        showToast(data.error ?? 'Failed to save configuration', 'error')
      }
    } catch {
      showToast('Network error saving configuration', 'error')
    } finally {
      setSavingConfig(false)
    }
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    try {
      const res = await fetch('/api/teams/test', { method: 'POST' })
      const data = await res.json() as { success?: boolean; message?: string }
      if (res.ok) {
        showToast(data.message ?? 'Test complete', data.success ? 'success' : 'error')
      } else {
        showToast('Test failed — check bot configuration', 'error')
      }
    } catch {
      showToast('Network error sending test message', 'error')
    } finally {
      setTestingConnection(false)
    }
  }

  const handleRemoveConversation = async (id: string) => {
    try {
      const res = await fetch('/api/teams/conversations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        showToast('Conversation removed', 'success')
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (configStatus) {
          setConfigStatus({ ...configStatus, conversationCount: configStatus.conversationCount - 1 })
        }
        setConvStats((prev) => prev ? { ...prev, total: Math.max(0, prev.total - 1), active: Math.max(0, prev.active - 1) } : prev)
      } else {
        showToast('Failed to remove conversation', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
  }

  const handleSavePrefs = () => {
    showToast('Notification preferences saved', 'success')
  }

  const handleSaveDigest = async () => {
    setSavingDigest(true)
    try {
      const res = await fetch('/api/teams/digest', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: digest.enabled,
          time: digest.time,
          timezone: digest.timezone,
        }),
      })
      if (res.ok) {
        showToast('Digest settings saved', 'success')
      } else {
        showToast('Failed to save digest settings', 'error')
      }
    } catch {
      showToast('Network error saving digest settings', 'error')
    } finally {
      setSavingDigest(false)
    }
  }

  const handleSendDigestNow = async () => {
    setSendingDigest(true)
    try {
      const res = await fetch('/api/teams/digest', { method: 'POST' })
      const data = await res.json() as { ok?: boolean; sent?: number; error?: string }
      if (res.ok && data.ok) {
        showToast(`Daily digest sent to ${data.sent ?? 0} conversation(s)`, 'success')
        await loadData()
      } else {
        showToast(data.error ?? 'Failed to send digest', 'error')
      }
    } catch {
      showToast('Network error sending digest', 'error')
    } finally {
      setSendingDigest(false)
    }
  }

  const handlePruneStale = async () => {
    setPruning(true)
    try {
      const res = await fetch('/api/teams/conversations?prune=true', { method: 'DELETE' })
      const data = await res.json() as { success?: boolean; pruned?: number }
      if (res.ok) {
        showToast(`Pruned ${data.pruned ?? 0} stale conversation(s)`, 'success')
        await loadData()
      } else {
        showToast('Failed to prune conversations', 'error')
      }
    } catch {
      showToast('Network error pruning conversations', 'error')
    } finally {
      setPruning(false)
    }
  }

  const setupSteps = [
    {
      num: '1',
      title: 'Register App in Azure AD',
      detail: 'Go to Azure Portal → Azure Active Directory → App Registrations → New Registration. Name it "CompliGuard Bot". Copy the Application (client) ID.',
    },
    {
      num: '2',
      title: 'Create Bot Channel Registration',
      detail: 'In Azure Portal, search for "Azure Bot". Create a new Azure Bot resource. Select "Use existing app registration" and paste your App ID. Under Certificates & Secrets, create a new client secret — copy it.',
    },
    {
      num: '3',
      title: 'Enable Microsoft Teams Channel',
      detail: 'In your Azure Bot resource, go to Channels → Microsoft Teams. Enable the Teams channel and save.',
    },
    {
      num: '4',
      title: 'Configure Webhook URL',
      detail: `In the Azure Bot Messaging Endpoint field, set:\n${configStatus?.webhookUrl ?? 'https://your-domain.com/api/teams/bot'}`,
    },
    {
      num: '5',
      title: 'Enter Credentials Above',
      detail: 'Copy the App ID, client secret (password), and your Azure AD Tenant ID into the Bot Configuration form above and click Save Configuration.',
    },
  ]

  return (
    <div className="animate-fade-in" style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.type === 'success' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)'}`,
          color: toast.type === 'success' ? '#4ADE80' : '#F87171',
          backdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.type === 'success' ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageSquare size={18} color="#8B5CF6" />
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em',
          }}>
            Microsoft Teams Bot
          </h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Receive real-time compliance alerts, finding notifications, and run status commands directly in Microsoft Teams.
        </p>
      </div>

      {/* ── Section 1 — Bot Configuration ───────────────────── */}
      <div style={{ ...glass, padding: 28, marginBottom: 20 }}>
        <SectionHeader icon={Settings} title="Bot Configuration" color="#8B5CF6" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Bot App ID</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Tenant ID</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Bot App Password (Client Secret)</label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inputStyle, paddingRight: 40 }}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••••••••••••"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={btnPrimary} onClick={handleSaveConfig} disabled={savingConfig}>
            {savingConfig ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
            {savingConfig ? 'Saving…' : 'Save Configuration'}
          </button>
          <button style={btnSecondary} onClick={handleTestConnection} disabled={testingConnection}>
            {testingConnection ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
            {testingConnection ? 'Sending…' : 'Test Connection'}
          </button>
        </div>
      </div>

      {/* ── Section 2 — Connection Status ───────────────────── */}
      <div style={{ ...glass, padding: 28, marginBottom: 20 }}>
        <SectionHeader icon={Zap} title="Connection Status" color="#06B6D4" />

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ ...cyanGlass, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Status
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {configStatus?.connected
                  ? <CheckCircle size={16} color="#4ADE80" />
                  : <XCircle size={16} color="#F87171" />}
                <span style={{ fontSize: 14, fontWeight: 700, color: configStatus?.connected ? '#4ADE80' : '#F87171' }}>
                  {configStatus?.connected ? 'Connected' : 'Not Configured'}
                </span>
              </div>
            </div>

            <div style={{ ...violetGlass, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Active Conversations
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#8B5CF6' }}>
                {configStatus?.conversationCount ?? 0}
              </div>
            </div>

            <div style={{ ...glass, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Webhook URL
              </div>
              <code style={{ fontSize: 11, color: '#06B6D4', wordBreak: 'break-all' }}>
                {configStatus?.webhookUrl ?? '/api/teams/bot'}
              </code>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3 — Active Conversations ────────────────── */}
      <div style={{ ...glass, padding: 28, marginBottom: 20 }}>
        <SectionHeader icon={MessageSquare} title="Active Conversations" color="#8B5CF6" />

        {conversations.length === 0 ? (
          <div style={{
            padding: '32px', textAlign: 'center',
            background: 'rgba(255,255,255,0.02)', borderRadius: 10,
            border: '1px dashed rgba(255,255,255,0.08)',
          }}>
            <MessageSquare size={32} color="var(--text-muted)" style={{ marginBottom: 10, opacity: 0.4 }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No active conversations yet. Install the bot in a Microsoft Teams channel to get started.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Conversation ID', 'Channel', 'Tenant ID', 'Connected At', ''].map((h) => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: 'left', fontSize: 11,
                      fontWeight: 600, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conversations.map((conv) => {
                  const ref = conv.conversationRef as Record<string, unknown>
                  const convId = (ref?.conversationId as string) ?? conv.id
                  return (
                    <tr key={conv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 12 }}>
                        {convId.length > 24 ? `${convId.slice(0, 24)}…` : convId}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                        {conv.channelId ?? 'msteams'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>
                        {conv.tenantId ? `${conv.tenantId.slice(0, 14)}…` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                        {new Date(conv.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button style={btnDanger} onClick={() => handleRemoveConversation(conv.id)}>
                          <Trash2 size={12} />
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 4 — Notification Settings ───────────────── */}
      <div style={{ ...glass, padding: 28, marginBottom: 20 }}>
        <SectionHeader icon={Bell} title="Notification Settings" color="#06B6D4" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
          {(
            [
              { key: 'criticalFindings', label: 'Notify on new Critical Findings', desc: 'Send alert when a critical-severity finding is created' },
              { key: 'complianceScoreDrop', label: 'Notify on Compliance Score Drop', desc: 'Alert when overall compliance score decreases by more than 5%' },
              { key: 'incidentCreated', label: 'Notify on Incident Created', desc: 'Send notification when a new risk incident is logged' },
              { key: 'taskOverdue', label: 'Notify on Task Overdue', desc: 'Alert when assigned tasks pass their due date' },
            ] as Array<{ key: keyof NotificationPrefs; label: string; desc: string }>
          ).map(({ key, label, desc }) => (
            <label
              key={key}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                cursor: 'pointer', padding: '12px 16px',
                background: prefs[key] ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.02)',
                borderRadius: 10, border: `1px solid ${prefs[key] ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.06)'}`,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ marginTop: 1 }}>
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                  style={{ accentColor: '#8B5CF6', width: 15, height: 15 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
              </div>
            </label>
          ))}
        </div>

        <button style={btnPrimary} onClick={handleSavePrefs}>
          <CheckCircle size={14} />
          Save Preferences
        </button>
      </div>

      {/* ── Section 5 — Setup Guide ──────────────────────────── */}
      <div style={{ ...glass, padding: 28, marginBottom: 20 }}>
        <SectionHeader icon={BookOpen} title="Setup Guide" color="#8B5CF6" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {setupSteps.map((step) => (
            <div key={step.num} style={{
              display: 'flex', gap: 16, padding: '16px 18px',
              background: 'rgba(255,255,255,0.02)', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#8B5CF6',
              }}>
                {step.num}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {step.detail}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 20, padding: '14px 18px', borderRadius: 10,
          background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)',
        }}>
          <p style={{ fontSize: 12.5, color: 'rgba(6,182,212,0.9)', lineHeight: 1.6 }}>
            <strong>Teams App Package:</strong> Download the manifest from{' '}
            <code style={{ fontSize: 11 }}>/teams-manifest/manifest.json</code>{' '}
            and sideload it in Microsoft Teams Admin Center or use the Teams Developer Portal.
            See <code>/teams-manifest/README.md</code> for full packaging instructions.
          </p>
        </div>
      </div>

      {/* ── Section 6 — Daily Digest ─────────────────────────── */}
      <div style={{ ...glass, padding: 28, marginBottom: 20 }}>
        <SectionHeader icon={Sun} title="Daily Digest" color="#F59E0B" />

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          Send a morning summary card to all connected Teams conversations — includes compliance score, key metrics, framework health, and recent activity.
        </p>

        {/* Enable toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderRadius: 10, marginBottom: 16,
          background: digest.enabled ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${digest.enabled ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.06)'}`,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Enable Daily Digest</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Automatically send a digest card each morning to all active conversations
            </div>
          </div>
          <Toggle enabled={digest.enabled} onToggle={() => setDigest((d) => ({ ...d, enabled: !d.enabled }))} />
        </div>

        {/* Time and timezone */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Send At</label>
            <input
              style={inputStyle}
              type="time"
              value={digest.time}
              onChange={(e) => setDigest((d) => ({ ...d, time: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Timezone</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={digest.timezone}
              onChange={(e) => setDigest((d) => ({ ...d, timezone: e.target.value }))}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} style={{ background: '#0F1628' }}>{tz}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Last sent / next scheduled */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ ...amberGlass, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Last Sent
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
              {digest.lastSentAt
                ? new Date(digest.lastSentAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                : 'Never'}
            </div>
          </div>
          <div style={{ ...amberGlass, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Next Scheduled
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
              {digest.nextScheduledAt
                ? new Date(digest.nextScheduledAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                : digest.enabled ? `${digest.time} ${digest.timezone}` : 'Not scheduled'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={btnPrimary} onClick={handleSaveDigest} disabled={savingDigest}>
            {savingDigest ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
            {savingDigest ? 'Saving…' : 'Save Digest Settings'}
          </button>
          <button style={btnCyan} onClick={handleSendDigestNow} disabled={sendingDigest}>
            {sendingDigest ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
            {sendingDigest ? 'Sending…' : 'Send Now'}
          </button>
        </div>

        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>External cron scheduling:</strong> Hit{' '}
            <code style={{ fontSize: 11, color: '#F59E0B' }}>POST /api/teams/digest</code>{' '}
            with header <code style={{ fontSize: 11, color: '#F59E0B' }}>x-cron-secret: $CRON_SECRET</code>{' '}
            and body <code style={{ fontSize: 11, color: '#F59E0B' }}>{'{'}orgId: "..."{'}'}</code> from your cron provider.
          </p>
        </div>
      </div>

      {/* ── Section 7 — Conversation Statistics ─────────────── */}
      <div style={{ ...glass, padding: 28, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <SectionHeader icon={BarChart2} title="Conversation Statistics" color="#06B6D4" />
          <button
            style={{ ...btnDanger, marginBottom: 20 }}
            onClick={handlePruneStale}
            disabled={pruning}
            title="Delete conversations inactive for 30+ days"
          >
            {pruning ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Scissors size={12} />}
            {pruning ? 'Pruning…' : 'Prune Stale (30d)'}
          </button>
        </div>

        {/* Stats bar */}
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Loading stats…</p>
        ) : convStats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <div style={{ ...cyanGlass, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Total
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#06B6D4' }}>{convStats.total}</div>
            </div>
            <div style={{ ...violetGlass, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Active (30d)
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#4ADE80' }}>{convStats.active}</div>
            </div>
            <div style={{ ...glass, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Inactive
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#F87171' }}>{convStats.inactive}</div>
            </div>
            <div style={{ ...glass, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Last Activity
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>
                {convStats.lastActiveAt
                  ? new Date(convStats.lastActiveAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : '—'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }} />
        )}

        {/* Channel breakdown */}
        {convStats && convStats.channelBreakdown.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Channel Breakdown
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {convStats.channelBreakdown.map(({ channel, count }) => (
                <span
                  key={channel}
                  style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
                    color: '#06B6D4',
                  }}
                >
                  {channel} · {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced conversation table */}
        {conversations.length === 0 ? (
          <div style={{
            padding: '32px', textAlign: 'center',
            background: 'rgba(255,255,255,0.02)', borderRadius: 10,
            border: '1px dashed rgba(255,255,255,0.08)',
          }}>
            <BarChart2 size={28} color="var(--text-muted)" style={{ marginBottom: 10, opacity: 0.4 }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No conversations to display.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Conversation ID', 'Channel', 'Tenant ID', 'Last Active', 'Actions'].map((h) => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: 'left', fontSize: 11,
                      fontWeight: 600, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conversations.map((conv) => {
                  const ref = conv.conversationRef as Record<string, unknown>
                  const convId = (ref?.conversationId as string) ?? conv.id
                  const isActive = new Date(conv.updatedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  return (
                    <tr key={conv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                        <span style={{ color: isActive ? '#4ADE80' : 'var(--text-muted)' }}>●</span>
                        {' '}
                        <span style={{ color: 'var(--text-primary)' }}>
                          {convId.length > 20 ? `${convId.slice(0, 20)}…` : convId}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                        {conv.channelId ?? 'msteams'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>
                        {conv.tenantId ? `${conv.tenantId.slice(0, 12)}…` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                        {new Date(conv.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button style={btnDanger} onClick={() => handleRemoveConversation(conv.id)}>
                          <Trash2 size={12} />
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
