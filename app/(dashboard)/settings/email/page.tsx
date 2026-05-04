'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, ArrowLeft, Save, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react'

type EmailProviderType = 'postmark' | 'smtp' | 'disabled'

interface PostmarkConfig {
  serverToken: string
  fromEmail: string
  fromName: string
}

interface SmtpConfig {
  host: string
  port: string
  secure: boolean
  user: string
  pass: string
  fromEmail: string
  fromName: string
}

interface EmailSettings {
  provider: EmailProviderType
  postmark: PostmarkConfig
  smtp: SmtpConfig
  lastSendAt?: string
  lastError?: string
}

const DEFAULT_SETTINGS: EmailSettings = {
  provider: 'disabled',
  postmark: { serverToken: '', fromEmail: '', fromName: 'CompliGuard' },
  smtp: { host: '', port: '587', secure: false, user: '', pass: '', fromEmail: '', fromName: 'CompliGuard' },
}

function PasswordInput({ value, onChange, placeholder, className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className || 'glass-input'}
        style={{ width: '100%', paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center' }}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

export default function EmailSettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<EmailSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/email/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.provider) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data,
            postmark: { ...DEFAULT_SETTINGS.postmark, ...(data.postmark || {}) },
            smtp: { ...DEFAULT_SETTINGS.smtp, ...(data.smtp || {}) },
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const updatePostmark = (key: keyof PostmarkConfig, value: string) =>
    setSettings((s) => ({ ...s, postmark: { ...s.postmark, [key]: value } }))

  const updateSmtp = (key: keyof SmtpConfig, value: string | boolean) =>
    setSettings((s) => ({ ...s, smtp: { ...s.smtp, [key]: value } }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/email/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json() as { ok: boolean; message: string }
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, message: 'Network error — could not reach API.' })
    } finally {
      setTesting(false)
    }
  }

  const fieldLabel = (text: string, hint?: string) => (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
      {text}
      {hint && <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>({hint})</span>}
    </label>
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button onClick={() => router.push('/settings')} className="btn-ghost" style={{ fontSize: 13 }}>
          <ArrowLeft size={14} /> Settings
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mail size={18} color="#8B5CF6" />
        </div>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Email</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Outbound email provider for notifications and evidence requests</p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Provider selector */}
        <div>
          {fieldLabel('Provider')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {(['postmark', 'smtp', 'disabled'] as EmailProviderType[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSettings((s) => ({ ...s, provider: p }))}
                style={{
                  padding: '10px 4px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  border: settings.provider === p ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: settings.provider === p ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                  color: settings.provider === p ? '#C4B5FD' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                  textTransform: 'capitalize',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          {settings.provider === 'disabled' && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Emails will be logged to <code style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>/tmp/compliguard-emails.json</code> (development mode).
            </p>
          )}
        </div>

        {/* Postmark config */}
        {settings.provider === 'postmark' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>Postmark Configuration</p>
            <div>
              {fieldLabel('Server API Token')}
              <PasswordInput
                value={settings.postmark.serverToken}
                onChange={(v) => updatePostmark('serverToken', v)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>
                Found in Postmark Dashboard → Servers → [Your Server] → API Tokens
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {fieldLabel('From Email')}
                <input
                  type="email"
                  value={settings.postmark.fromEmail}
                  onChange={(e) => updatePostmark('fromEmail', e.target.value)}
                  placeholder="compliance@yourcompany.com"
                  className="glass-input"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                {fieldLabel('From Name')}
                <input
                  type="text"
                  value={settings.postmark.fromName}
                  onChange={(e) => updatePostmark('fromName', e.target.value)}
                  placeholder="CompliGuard"
                  className="glass-input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* SMTP config */}
        {settings.provider === 'smtp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>SMTP Configuration</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                {fieldLabel('Host')}
                <input
                  type="text"
                  value={settings.smtp.host}
                  onChange={(e) => updateSmtp('host', e.target.value)}
                  placeholder="smtp.yourprovider.com"
                  className="glass-input"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ minWidth: 90 }}>
                {fieldLabel('Port')}
                <input
                  type="number"
                  value={settings.smtp.port}
                  onChange={(e) => updateSmtp('port', e.target.value)}
                  placeholder="587"
                  className="glass-input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => updateSmtp('secure', !settings.smtp.secure)}
                style={{
                  width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative',
                  background: settings.smtp.secure ? '#7C3AED' : 'rgba(255,255,255,0.12)',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: settings.smtp.secure ? 18 : 2, width: 16, height: 16,
                  borderRadius: '50%', background: 'white', transition: 'left 0.2s',
                }} />
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Use TLS/SSL (secure connection)
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {fieldLabel('Username', 'optional')}
                <input
                  type="text"
                  value={settings.smtp.user}
                  onChange={(e) => updateSmtp('user', e.target.value)}
                  placeholder="smtp-user"
                  className="glass-input"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                {fieldLabel('Password', 'optional')}
                <PasswordInput
                  value={settings.smtp.pass}
                  onChange={(v) => updateSmtp('pass', v)}
                  placeholder="smtp-password"
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {fieldLabel('From Email')}
                <input
                  type="email"
                  value={settings.smtp.fromEmail}
                  onChange={(e) => updateSmtp('fromEmail', e.target.value)}
                  placeholder="compliance@yourcompany.com"
                  className="glass-input"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                {fieldLabel('From Name')}
                <input
                  type="text"
                  value={settings.smtp.fromName}
                  onChange={(e) => updateSmtp('fromName', e.target.value)}
                  placeholder="CompliGuard"
                  className="glass-input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Status info */}
        {(settings.lastSendAt || settings.lastError) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {settings.lastSendAt && (
              <div style={{ fontSize: 12.5, color: '#4ADE80', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={12} />
                Last successful send: {new Date(settings.lastSendAt).toLocaleString()}
              </div>
            )}
            {settings.lastError && (
              <div style={{ fontSize: 12.5, color: '#F87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                <XCircle size={12} />
                Last error: {settings.lastError}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || settings.provider === 'disabled'}
            style={{
              fontSize: 13, color: '#06B6D4', background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: settings.provider === 'disabled' ? 0.4 : 1,
            }}
          >
            {testing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            Send test email
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
            {saved ? 'Saved!' : 'Save changes'}
          </button>
        </div>

        {testResult && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, padding: '10px 14px', borderRadius: 8,
            background: testResult.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
            border: `1px solid ${testResult.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
            color: testResult.ok ? '#4ADE80' : '#F87171',
          }}>
            {testResult.ok ? <CheckCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} /> : <XCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />}
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  )
}
