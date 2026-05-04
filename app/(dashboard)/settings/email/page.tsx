'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, ArrowLeft, Save, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type EmailProvider = 'resend' | 'sendgrid' | 'postmark' | 'smtp'

const providers: { value: EmailProvider; label: string; placeholder: string }[] = [
  { value: 'resend', label: 'Resend', placeholder: 're_...' },
  { value: 'sendgrid', label: 'SendGrid', placeholder: 'SG...' },
  { value: 'postmark', label: 'Postmark', placeholder: 'Server API token' },
  { value: 'smtp', label: 'SMTP', placeholder: 'Not needed for SMTP' },
]

export default function EmailSettingsPage() {
  const router = useRouter()
  const [provider, setProvider] = useState<EmailProvider>('resend')
  const [apiKey, setApiKey] = useState('')
  const [fromAddress, setFromAddress] = useState('')
  const [inboundEmail, setInboundEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/setup/step/5', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailProvider: provider, apiKey, fromAddress, inboundEmail }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const res = await fetch('/api/setup/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey, fromAddress }),
    })
    const data = await res.json()
    setTestResult(data)
    setTesting(false)
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }} className="animate-fade-in">
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
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Outbound notifications, invites, and evidence requests</p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Email provider</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {providers.map((p) => (
                <button key={p.value} type="button" onClick={() => setProvider(p.value)} style={{
                  padding: '8px 4px', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                  border: provider === p.value ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: provider === p.value ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                  color: provider === p.value ? '#C4B5FD' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}>{p.label}</button>
              ))}
            </div>
          </div>

          {provider !== 'smtp' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>API Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder={providers.find(p => p.value === provider)?.placeholder}
                className="glass-input" style={{ width: '100%' }} />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>From address</label>
            <input type="email" value={fromAddress} onChange={e => setFromAddress(e.target.value)}
              placeholder="compliance@yourcompany.com" className="glass-input" style={{ width: '100%' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Inbound email <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input type="email" value={inboundEmail} onChange={e => setInboundEmail(e.target.value)}
              placeholder="evidence@inbound.yourcompany.com" className="glass-input" style={{ width: '100%' }} />
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>Used for inbound evidence submissions via email reply</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button type="button" onClick={handleTest} disabled={testing || !fromAddress}
              style={{ fontSize: 13, color: '#06B6D4', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: (!fromAddress) ? 0.5 : 1 }}>
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
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, padding: '10px 14px', borderRadius: 8, background: testResult.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${testResult.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`, color: testResult.ok ? '#4ADE80' : '#F87171' }}>
              {testResult.ok ? <CheckCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} /> : <XCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />}
              {testResult.message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
