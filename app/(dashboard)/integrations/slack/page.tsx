'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquare, CheckCircle, XCircle, Copy, Check, Eye, EyeOff } from 'lucide-react'

interface SlackConfig {
  connected: boolean
  status: string
  lastSyncAt: string | null
  defaultChannelId: string
  channels: Record<string, string>
  notificationPreferences: Record<string, boolean>
}

const CHANNEL_TYPES = [
  { key: 'findings_critical', label: 'Critical Findings', description: 'New critical severity findings' },
  { key: 'findings_high', label: 'High Findings', description: 'New high severity findings' },
  { key: 'evidence_requests', label: 'Evidence Requests', description: 'New evidence request notifications' },
  { key: 'daily_digest', label: 'Daily Digest', description: 'Daily compliance summary' },
  { key: 'general', label: 'General', description: 'Default channel for all other notifications' },
]

const NOTIFICATION_PREFS = [
  { key: 'findings_critical', label: 'Critical findings' },
  { key: 'findings_high', label: 'High findings' },
  { key: 'findings_medium', label: 'Medium findings' },
  { key: 'evidence_requests', label: 'Evidence requests' },
  { key: 'daily_digest', label: 'Daily digest' },
]

export default function SlackIntegrationPage() {
  const router = useRouter()

  const [config, setConfig] = useState<SlackConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const [botToken, setBotToken] = useState('')
  const [signingSecret, setSigningSecret] = useState('')
  const [defaultChannelId, setDefaultChannelId] = useState('')
  const [channels, setChannels] = useState<Record<string, string>>({})
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({})

  const [showToken, setShowToken] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/slack/commands`
      : '/api/webhooks/slack/commands'

  useEffect(() => {
    fetch('/api/integrations/slack')
      .then((r) => r.json())
      .then((data: SlackConfig) => {
        setConfig(data)
        setDefaultChannelId(data.defaultChannelId || '')
        setChannels(data.channels || {})
        setNotifPrefs(data.notificationPreferences || {})
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (!botToken && !signingSecret && config?.connected) {
      // Only saving channels/prefs — send without secrets
      setSaving(true)
      const res = await fetch('/api/integrations/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: '••••••••', // placeholder — backend won't overwrite masked values
          signingSecret: '••••••••',
          defaultChannelId,
          channels,
          notificationPreferences: notifPrefs,
        }),
      })
      const data = await res.json() as { ok: boolean }
      setSaveMsg(data.ok ? 'Saved successfully' : 'Save failed')
      setSaving(false)
      return
    }

    if (!botToken || !signingSecret) {
      setSaveMsg('Bot Token and Signing Secret are required')
      return
    }

    setSaving(true)
    const res = await fetch('/api/integrations/slack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken,
        signingSecret,
        defaultChannelId,
        channels,
        notificationPreferences: notifPrefs,
      }),
    })
    const data = await res.json() as { ok: boolean }
    setSaveMsg(data.ok ? 'Saved successfully' : 'Save failed')
    if (data.ok) {
      const updated = await fetch('/api/integrations/slack').then((r) => r.json()) as SlackConfig
      setConfig(updated)
    }
    setSaving(false)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const body: Record<string, unknown> = { defaultChannelId, channels }
    if (botToken) body.botToken = botToken
    if (signingSecret) body.signingSecret = signingSecret

    const res = await fetch('/api/integrations/slack/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json() as { ok: boolean; error?: string }
    setTestResult(data)
    setTesting(false)
  }

  async function handleDelete() {
    if (!confirm('Disconnect Slack integration?')) return
    await fetch('/api/integrations/slack', { method: 'DELETE' })
    setConfig({ connected: false, status: 'inactive', lastSyncAt: null, defaultChannelId: '', channels: {}, notificationPreferences: {} })
    setBotToken('')
    setSigningSecret('')
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)' }}>
        Loading...
      </div>
    )
  }

  const card: React.CSSProperties = {
    padding: '20px 24px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    marginBottom: 20,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
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
    letterSpacing: '0.03em',
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }} className="animate-fade-in">
      {/* Back button */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => router.push('/settings/integrations')}
          className="btn-ghost"
          style={{ fontSize: 13 }}
        >
          <ArrowLeft size={14} /> Integrations
        </button>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={20} color="#8B5CF6" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
              Slack
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Receive compliance notifications in Slack channels</p>
          </div>
        </div>

        {/* Connection badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 100,
          background: config?.connected ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)',
          border: `1px solid ${config?.connected ? 'rgba(16,185,129,0.3)' : 'rgba(107,114,128,0.3)'}`,
        }}>
          {config?.connected
            ? <CheckCircle size={13} color="#10B981" />
            : <XCircle size={13} color="#6B7280" />}
          <span style={{ fontSize: 12, fontWeight: 600, color: config?.connected ? '#10B981' : '#6B7280' }}>
            {config?.connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
      </div>

      {/* Credentials */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>Bot Configuration</h2>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Bot Token</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showToken ? 'text' : 'password'}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder={config?.connected ? '••••••••••••••••' : 'xoxb-...'}
              style={{ ...inputStyle, paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
            Create a Slack app at api.slack.com → Install → Bot User OAuth Token
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Signing Secret</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showSecret ? 'text' : 'password'}
              value={signingSecret}
              onChange={(e) => setSigningSecret(e.target.value)}
              placeholder={config?.connected ? '••••••••••••••••' : 'Your app signing secret'}
              style={{ ...inputStyle, paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
            >
              {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
            Found at api.slack.com → Your App → Basic Information → App Credentials
          </p>
        </div>
      </div>

      {/* Channel Configuration */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>Channel Configuration</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
          Set a Slack channel ID for each notification type. You can find a channel ID by right-clicking a channel in Slack → View channel details.
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Default Channel ID</label>
          <input
            type="text"
            value={defaultChannelId}
            onChange={(e) => setDefaultChannelId(e.target.value)}
            placeholder="C0123456789"
            style={inputStyle}
          />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>Fallback channel when no specific channel is configured</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CHANNEL_TYPES.map((ct) => (
            <div key={ct.key} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{ct.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ct.description}</div>
              </div>
              <input
                type="text"
                value={channels[ct.key] || ''}
                onChange={(e) => setChannels((prev) => ({ ...prev, [ct.key]: e.target.value }))}
                placeholder="C0123456789"
                style={{ ...inputStyle, width: 160, flex: 'none' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Notification Preferences */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>Notification Preferences</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {NOTIFICATION_PREFS.map((pref) => (
            <div key={pref.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{pref.label}</span>
              <button
                type="button"
                onClick={() => setNotifPrefs((prev) => ({ ...prev, [pref.key]: !(prev[pref.key] ?? true) }))}
                style={{
                  width: 40, height: 22, borderRadius: 100, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                  background: (notifPrefs[pref.key] ?? true) ? '#8B5CF6' : 'rgba(255,255,255,0.1)',
                  position: 'relative',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%',
                  background: 'white', transition: 'all 0.2s',
                  left: (notifPrefs[pref.key] ?? true) ? 21 : 3,
                }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Slash Commands Setup */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
          Slash Commands Setup
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          To enable <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>/compliguard</code> slash commands,
          go to your Slack App → Slash Commands → Create New Command and set this Request URL:
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <code style={{ flex: 1, fontSize: 12, color: '#A78BFA', wordBreak: 'break-all' }}>{webhookUrl}</code>
          <button
            onClick={copyWebhookUrl}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0 }}
          >
            {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
          Available commands: <code style={{ fontSize: 11 }}>/compliguard status</code> · <code style={{ fontSize: 11 }}>/compliguard findings</code> · <code style={{ fontSize: 11 }}>/compliguard tasks</code> · <code style={{ fontSize: 11 }}>/compliguard help</code>
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: '#8B5CF6', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>

        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'rgba(6,182,212,0.12)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.3)',
            cursor: testing ? 'not-allowed' : 'pointer', opacity: testing ? 0.7 : 1,
          }}
        >
          {testing ? 'Sending...' : 'Send Test Message'}
        </button>

        {config?.connected && (
          <button
            onClick={handleDelete}
            style={{
              padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)',
              cursor: 'pointer', marginLeft: 'auto',
            }}
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Feedback messages */}
      {saveMsg && (
        <div style={{ marginTop: 14, padding: '10px 16px', borderRadius: 8, fontSize: 13, background: saveMsg.includes('success') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${saveMsg.includes('success') ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, color: saveMsg.includes('success') ? '#10B981' : '#EF4444' }}>
          {saveMsg}
        </div>
      )}

      {testResult && (
        <div style={{ marginTop: 10, padding: '10px 16px', borderRadius: 8, fontSize: 13, background: testResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${testResult.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, color: testResult.ok ? '#10B981' : '#EF4444' }}>
          {testResult.ok ? '✅ Test message sent successfully!' : `❌ ${testResult.error}`}
        </div>
      )}
    </div>
  )
}
