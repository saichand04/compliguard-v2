'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Brain, ArrowLeft, Save, CheckCircle, XCircle, Loader2 } from 'lucide-react'

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro']

export default function AISettingsPage() {
  const router = useRouter()
  const [aiProvider, setAiProvider] = useState<'openai' | 'gemini'>('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/setup/step/7', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProvider, apiKey, model }),
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
    const res = await fetch('/api/setup/test-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiProvider, apiKey, model }),
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
          <Brain size={18} color="#8B5CF6" />
        </div>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>AI Provider</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Control mapping, risk analysis, and compliance assistant</p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>AI Provider</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(['openai', 'gemini'] as const).map((p) => (
                <button key={p} type="button" onClick={() => { setAiProvider(p); setModel(p === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash') }}
                  style={{
                    padding: '14px 16px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    border: aiProvider === p ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    background: aiProvider === p ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: aiProvider === p ? '#C4B5FD' : 'var(--text-primary)', marginBottom: 3 }}>
                    {p === 'openai' ? 'OpenAI' : 'Google Gemini'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {p === 'openai' ? 'GPT-4o recommended' : 'Gemini 2.0 Flash recommended'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>API Key</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={aiProvider === 'openai' ? 'sk-...' : 'AI...'} className="glass-input" style={{ width: '100%', fontFamily: 'monospace' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Model</label>
            <select value={model} onChange={e => setModel(e.target.value)} className="glass-input" style={{ width: '100%' }}>
              {(aiProvider === 'openai' ? OPENAI_MODELS : GEMINI_MODELS).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button type="button" onClick={handleTest} disabled={testing || !apiKey}
              style={{ fontSize: 13, color: '#06B6D4', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: !apiKey ? 0.5 : 1 }}>
              {testing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              Test connection
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
