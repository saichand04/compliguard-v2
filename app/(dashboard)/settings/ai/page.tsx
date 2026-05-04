'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Brain, ArrowLeft, Save, CheckCircle, XCircle, Loader2, Server, Cpu } from 'lucide-react'

// ─── Model lists ──────────────────────────────────────────────────────────────
const OPENAI_MODELS    = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
const GEMINI_MODELS    = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash']
const CLAUDE_MODELS    = ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5', 'claude-3-opus-20240229']
const OLLAMA_DEFAULTS  = ['llama3.2', 'llama3.1', 'mistral', 'mistral-nemo', 'phi4', 'qwen2.5', 'deepseek-r1', 'gemma3']

type Provider = 'openai' | 'gemini' | 'claude' | 'ollama'

interface ProviderCard {
  id: Provider
  name: string
  tagline: string
  badge?: string
  badgeColor?: string
  requiresKey: boolean
  requiresEndpoint: boolean
  keyPlaceholder: string
  keyLabel: string
  defaultModel: string
  icon: string   // emoji stand-in — avoids RSC icon-prop issue
}

const PROVIDERS: ProviderCard[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'GPT-4o · best reasoning',
    requiresKey: true,
    requiresEndpoint: false,
    keyPlaceholder: 'sk-...',
    keyLabel: 'API Key',
    defaultModel: 'gpt-4o-mini',
    icon: '🤖',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    tagline: 'Gemini 2.0 Flash · fast & free tier',
    requiresKey: true,
    requiresEndpoint: false,
    keyPlaceholder: 'AIza...',
    keyLabel: 'API Key',
    defaultModel: 'gemini-2.0-flash',
    icon: '✨',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    tagline: 'Claude Opus · best for compliance writing',
    requiresKey: true,
    requiresEndpoint: false,
    keyPlaceholder: 'sk-ant-...',
    keyLabel: 'API Key',
    defaultModel: 'claude-sonnet-4-5',
    icon: '🧠',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    tagline: 'Self-hosted · fully private · no data leaves your infra',
    badge: 'Local',
    badgeColor: '#06B6D4',
    requiresKey: false,
    requiresEndpoint: true,
    keyPlaceholder: '',
    keyLabel: '',
    defaultModel: 'llama3.2',
    icon: '🏠',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function modelListFor(provider: Provider): string[] {
  if (provider === 'openai')  return OPENAI_MODELS
  if (provider === 'gemini')  return GEMINI_MODELS
  if (provider === 'claude')  return CLAUDE_MODELS
  if (provider === 'ollama')  return OLLAMA_DEFAULTS
  return []
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AISettingsPage() {
  const router = useRouter()

  const [provider, setProvider]           = useState<Provider>('openai')
  const [apiKey, setApiKey]               = useState('')
  const [model, setModel]                 = useState('gpt-4o-mini')
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434')
  const [customModel, setCustomModel]     = useState('')   // free-text for Ollama
  const [useCustomModel, setUseCustomModel] = useState(false)

  const [saving, setSaving]               = useState(false)
  const [testing, setTesting]             = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [testResult, setTestResult]       = useState<{ ok: boolean; message: string } | null>(null)
  const [loading, setLoading]             = useState(true)

  // Load saved config on mount
  useEffect(() => {
    fetch('/api/settings/ai')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.provider) {
          setProvider(data.provider as Provider)
          setModel(data.model || PROVIDERS.find(p => p.id === data.provider)?.defaultModel || 'gpt-4o-mini')
          if (data.provider === 'ollama') {
            setOllamaEndpoint(data.ollamaEndpoint || 'http://localhost:11434')
            if (!OLLAMA_DEFAULTS.includes(data.model)) {
              setUseCustomModel(true)
              setCustomModel(data.model)
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selectedCard = PROVIDERS.find(p => p.id === provider)!

  const handleProviderSwitch = (p: Provider) => {
    setProvider(p)
    setModel(PROVIDERS.find(x => x.id === p)!.defaultModel)
    setUseCustomModel(false)
    setCustomModel('')
    setTestResult(null)
  }

  const effectiveModel = (provider === 'ollama' && useCustomModel) ? customModel : model

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: selectedCard.requiresKey ? apiKey : undefined,
          model: effectiveModel,
          ollamaEndpoint: provider === 'ollama' ? ollamaEndpoint : undefined,
        }),
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
    try {
      const res = await fetch('/api/settings/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: selectedCard.requiresKey ? apiKey : undefined,
          model: effectiveModel,
          ollamaEndpoint: provider === 'ollama' ? ollamaEndpoint : undefined,
        }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, message: 'Connection failed — check your settings and try again.' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <Loader2 size={20} color="#8B5CF6" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }} className="animate-fade-in">
      {/* Back nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button onClick={() => router.push('/settings')} className="btn-ghost" style={{ fontSize: 13 }}>
          <ArrowLeft size={14} /> Settings
        </button>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Brain size={18} color="#8B5CF6" />
        </div>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>AI Provider</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Control mapping, risk analysis, compliance assistant, and AI chat</p>
        </div>
      </div>

      {/* Provider selector — 2×2 grid */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>AI Provider</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProviderSwitch(p.id)}
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                textAlign: 'left',
                cursor: 'pointer',
                border: provider === p.id ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                background: provider === p.id ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              {p.badge && (
                <span style={{
                  position: 'absolute', top: 8, right: 10,
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                  color: p.badgeColor, background: `${p.badgeColor}18`,
                  border: `1px solid ${p.badgeColor}40`,
                  borderRadius: 4, padding: '1px 6px',
                }}>
                  {p.badge}
                </span>
              )}
              <div style={{ fontSize: 18, marginBottom: 6 }}>{p.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: provider === p.id ? '#C4B5FD' : 'var(--text-primary)', marginBottom: 3 }}>
                {p.name}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {p.tagline}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Config card */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Ollama endpoint */}
        {provider === 'ollama' && (
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <Server size={13} /> Ollama Endpoint
            </label>
            <input
              type="url"
              value={ollamaEndpoint}
              onChange={e => setOllamaEndpoint(e.target.value)}
              placeholder="http://localhost:11434"
              className="glass-input"
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }}
            />
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
              Default port is 11434. For remote Ollama, use your server&apos;s IP/hostname.
              Ensure <code style={{ color: '#06B6D4' }}>OLLAMA_ORIGINS=*</code> is set if accessing cross-origin.
            </p>
          </div>
        )}

        {/* API Key (not for Ollama) */}
        {selectedCard.requiresKey && (
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {selectedCard.keyLabel}
              {provider === 'claude' && (
                <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                  (get from console.anthropic.com)
                </span>
              )}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={selectedCard.keyPlaceholder}
              className="glass-input"
              style={{ width: '100%', fontFamily: 'monospace' }}
              autoComplete="off"
            />
          </div>
        )}

        {/* Model selector */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
            <Cpu size={13} /> Model
          </label>

          {/* Ollama: preset list + custom toggle */}
          {provider === 'ollama' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!useCustomModel ? (
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="glass-input"
                  style={{ width: '100%' }}
                >
                  {OLLAMA_DEFAULTS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={customModel}
                  onChange={e => setCustomModel(e.target.value)}
                  placeholder="e.g. llama3.2:8b, codellama, mixtral:8x7b"
                  className="glass-input"
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }}
                />
              )}
              <button
                type="button"
                onClick={() => { setUseCustomModel(!useCustomModel); setCustomModel('') }}
                style={{ fontSize: 12, color: '#06B6D4', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start', padding: 0 }}
              >
                {useCustomModel ? '← Choose from list' : '+ Enter custom model name'}
              </button>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 0 }}>
                Make sure the model is pulled locally: <code style={{ color: '#06B6D4' }}>ollama pull {effectiveModel || 'llama3.2'}</code>
              </p>
            </div>
          ) : (
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="glass-input"
              style={{ width: '100%' }}
            >
              {modelListFor(provider).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>

        {/* Claude notes */}
        {provider === 'claude' && (
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Claude API notes:</strong> Claude Sonnet 4.5 is the recommended balance of speed and quality.
            Claude Opus 4.5 offers the highest quality for complex compliance writing tasks.
            Usage is billed per token at <a href="https://anthropic.com/pricing" target="_blank" rel="noreferrer" style={{ color: '#C4B5FD' }}>anthropic.com/pricing</a>.
          </div>
        )}

        {/* Ollama privacy note */}
        {provider === 'ollama' && (
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Privacy:</strong> All AI inference runs locally on your own hardware — no data leaves your infrastructure.
            Ideal for regulated environments where sending data to third-party AI APIs is restricted.
          </div>
        )}

        {/* Actions row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || (selectedCard.requiresKey && !apiKey)}
            style={{
              fontSize: 13, color: '#06B6D4', background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: (selectedCard.requiresKey && !apiKey) ? 0.5 : 1,
            }}
          >
            {testing
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <CheckCircle size={13} />
            }
            Test connection
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
            {saved ? 'Saved!' : 'Save changes'}
          </button>
        </div>

        {/* Test result */}
        {testResult && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13,
            padding: '10px 14px', borderRadius: 8,
            background: testResult.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
            border: `1px solid ${testResult.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
            color: testResult.ok ? '#4ADE80' : '#F87171',
          }}>
            {testResult.ok
              ? <CheckCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              : <XCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            }
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  )
}
