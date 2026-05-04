'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Shield, RefreshCw, Zap, AlertTriangle, CheckCircle,
  XCircle, Info, ArrowLeft, ChevronRight, Activity,
  Server, Lock, Network, Database, Eye,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DefenderCheckResult {
  category: 'secure_score' | 'recommendations' | 'alerts' | 'xdr_incidents' | 'coverage'
  checkId: string
  title: string
  status: 'pass' | 'fail' | 'warn' | 'info'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  score?: number
  maxScore?: number
  count?: number
  items?: Array<{ id: string; title: string; severity: string; resource?: string; description: string }>
  recommendation: string
  nistControls: string[]
}

interface ScanData {
  ok: boolean
  total: number
  passed: number
  failed: number
  warned: number
  results: DefenderCheckResult[]
}

interface Config {
  connected: boolean
  tenantId?: string
  clientId?: string
  subscriptionId?: string
  lastSyncAt?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pass: '#10B981',
  fail: '#EF4444',
  warn: '#F59E0B',
  info: '#06B6D4',
}

const SEV_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#10B981',
  info: '#06B6D4',
}

function StatusIcon({ status, size = 14 }: { status: string; size?: number }) {
  const color = STATUS_COLOR[status] ?? '#6B7280'
  if (status === 'pass') return <CheckCircle size={size} color={color} />
  if (status === 'fail') return <XCircle size={size} color={color} />
  if (status === 'warn') return <AlertTriangle size={size} color={color} />
  return <Info size={size} color={color} />
}

function SeverityBadge({ severity }: { severity: string }) {
  const color = SEV_COLOR[severity] ?? '#6B7280'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      color, background: `${color}18`, border: `1px solid ${color}35`,
      padding: '2px 8px', borderRadius: 100,
    }}>
      {severity}
    </span>
  )
}

function SecureScoreGauge({ score, maxScore = 100 }: { score: number; maxScore?: number }) {
  const pct = Math.min(100, Math.round((score / maxScore) * 100))
  const color = pct < 50 ? '#EF4444' : pct < 70 ? '#F59E0B' : '#10B981'
  const circumference = 2 * Math.PI * 54
  const dashOffset = circumference - (pct / 100) * circumference

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        <svg width={140} height={140} viewBox="0 0 140 140">
          <circle cx={70} cy={70} r={54} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={12} />
          <circle
            cx={70} cy={70} r={54}
            fill="none"
            stroke={color}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 70 70)"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{pct}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>/ 100</div>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Secure Score</div>
        <div style={{ fontSize: 11, color }}>
          {pct >= 70 ? 'Healthy' : pct >= 50 ? 'Needs Attention' : 'Critical'}
        </div>
      </div>
    </div>
  )
}

// ── Category icon ─────────────────────────────────────────────────────────────

function CategoryIcon({ category }: { category: string }) {
  const style = { opacity: 0.7 }
  if (category === 'secure_score') return <Shield size={14} style={style} />
  if (category === 'recommendations') return <Eye size={14} style={style} />
  if (category === 'alerts') return <AlertTriangle size={14} style={style} />
  if (category === 'xdr_incidents') return <Activity size={14} style={style} />
  if (category === 'coverage') return <Server size={14} style={style} />
  return <Info size={14} style={style} />
}

// ── Config Form ───────────────────────────────────────────────────────────────

function ConfigForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({ tenantId: '', clientId: '', clientSecret: '', subscriptionId: '' })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null)
  const [error, setError] = useState('')

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/integrations/defender/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json() as { ok: boolean; message?: string; error?: string }
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, error: 'Network error' })
    }
    setTesting(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/integrations/defender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        onSaved()
      } else {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Failed to save')
      }
    } catch {
      setError('Network error')
    }
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
        Connect Defender for Cloud using an Azure AD service principal with <strong>Security Reader</strong> and <strong>Reader</strong> roles on the subscription.
      </p>

      {[
        { label: 'Tenant ID', key: 'tenantId', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
        { label: 'Client ID (App ID)', key: 'clientId', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
        { label: 'Client Secret', key: 'clientSecret', placeholder: '••••••••••••••••', type: 'password' },
        { label: 'Subscription ID', key: 'subscriptionId', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      ].map(({ label, key, placeholder, type }) => (
        <div key={key}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
            {label}
          </label>
          <input
            type={type ?? 'text'}
            value={form[key as keyof typeof form]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            placeholder={placeholder}
            style={inputStyle}
          />
        </div>
      ))}

      {testResult && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: testResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${testResult.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          fontSize: 13,
          color: testResult.ok ? '#10B981' : '#EF4444',
        }}>
          {testResult.ok ? `✓ ${testResult.message}` : `✗ ${testResult.error}`}
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13, color: '#EF4444' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleTest}
          disabled={testing || !form.tenantId}
          style={{
            padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
            color: '#06B6D4', cursor: 'pointer', flex: 1,
          }}
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !form.tenantId || !form.clientId || !form.clientSecret || !form.subscriptionId}
          style={{
            padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
            border: 'none', color: '#fff', cursor: 'pointer', flex: 1,
          }}
        >
          {saving ? 'Saving…' : 'Save & Connect'}
        </button>
      </div>
    </div>
  )
}

// ── Plans Coverage Grid ───────────────────────────────────────────────────────

function PlansCoverageGrid({ results }: { results: DefenderCheckResult[] }) {
  const coverage = results.find((r) => r.checkId === 'defender.plans.coverage')
  if (!coverage?.items?.length) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
      {coverage.items.map((item) => {
        const isActive = item.severity === 'info'
        return (
          <div key={item.id} style={{
            padding: '12px 14px', borderRadius: 10,
            background: isActive ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${isActive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? '#10B981' : '#EF4444', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.description}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Check Row ─────────────────────────────────────────────────────────────────

function CheckRow({ check, defaultOpen = false }: { check: DefenderCheckResult; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{
      borderRadius: 10,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', padding: '12px 16px', background: 'transparent', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        }}
      >
        <StatusIcon status={check.status} />
        <CategoryIcon category={check.category} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{check.title}</span>
        {check.count !== undefined && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>{check.count}</span>
        )}
        <SeverityBadge severity={check.severity} />
        <ChevronRight size={14} color="var(--text-muted)" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0 8px' }}>
            {check.recommendation}
          </p>
          {check.nistControls.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {check.nistControls.map((c) => (
                <span key={c} style={{ fontSize: 10, fontWeight: 600, color: '#8B5CF6', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', padding: '2px 8px', borderRadius: 100 }}>
                  {c}
                </span>
              ))}
            </div>
          )}
          {check.items && check.items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {check.items.slice(0, 8).map((item) => (
                <div key={item.id} style={{
                  padding: '8px 12px', borderRadius: 7,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{item.title}</span>
                    <SeverityBadge severity={item.severity} />
                  </div>
                  {item.resource && <div style={{ fontSize: 11, color: '#06B6D4' }}>{item.resource}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DefenderDashboardPage() {
  const [config, setConfig] = useState<Config | null>(null)
  const [scanData, setScanData] = useState<ScanData | null>(null)
  const [scanning, setScanning] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [ingestResult, setIngestResult] = useState<{ ingested: number } | null>(null)
  const [activeTab, setActiveTab] = useState<'secure_score' | 'recommendations' | 'alerts' | 'xdr_incidents' | 'coverage'>('secure_score')
  const [showConfig, setShowConfig] = useState(false)

  const loadConfig = useCallback(async () => {
    const res = await fetch('/api/integrations/defender')
    const data = await res.json() as Config
    setConfig(data)
    if (!data.connected) setShowConfig(true)
  }, [])

  useEffect(() => { void loadConfig() }, [loadConfig])

  async function handleScan() {
    setScanning(true)
    setScanData(null)
    try {
      const res = await fetch('/api/integrations/defender/scan', { method: 'POST' })
      const data = await res.json() as ScanData
      setScanData(data)
    } finally {
      setScanning(false)
    }
  }

  async function handleIngest() {
    setIngesting(true)
    setIngestResult(null)
    try {
      const res = await fetch('/api/integrations/defender/ingest-alerts', { method: 'POST' })
      const data = await res.json() as { ingested: number }
      setIngestResult(data)
    } finally {
      setIngesting(false)
    }
  }

  async function handleDisconnect() {
    await fetch('/api/integrations/defender', { method: 'DELETE' })
    setConfig(null)
    setScanData(null)
    setShowConfig(true)
  }

  const results = scanData?.results ?? []
  const tabResults = results.filter((r) => r.category === activeTab)

  const secureScoreResult = results.find((r) => r.checkId === 'defender.secure_score.overall')

  const TABS: Array<{ key: typeof activeTab; label: string; icon: React.ReactNode }> = [
    { key: 'secure_score', label: 'Secure Score', icon: <Shield size={13} /> },
    { key: 'recommendations', label: 'Recommendations', icon: <Eye size={13} /> },
    { key: 'alerts', label: 'Alerts', icon: <AlertTriangle size={13} /> },
    { key: 'xdr_incidents', label: 'XDR Incidents', icon: <Activity size={13} /> },
    { key: 'coverage', label: 'Plans', icon: <Server size={13} /> },
  ]

  const glassCard: React.CSSProperties = {
    padding: 24, borderRadius: 16,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }} className="animate-fade-in">

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/settings/integrations" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 16 }}>
          <ArrowLeft size={13} /> Integrations
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} color="#8B5CF6" />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Microsoft Defender for Cloud
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Secure Score · Recommendations · Alerts · XDR Incidents
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {config?.connected && (
              <>
                <button
                  onClick={() => setShowConfig((s) => !s)}
                  style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showConfig ? 'Hide Config' : 'Edit Config'}
                </button>
                <button
                  onClick={handleDisconnect}
                  style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', cursor: 'pointer' }}
                >
                  Disconnect
                </button>
                <button
                  onClick={handleIngest}
                  disabled={ingesting || !scanData}
                  style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)', color: '#06B6D4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <Zap size={12} /> {ingesting ? 'Ingesting…' : 'Ingest Alerts as Findings'}
                </button>
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={13} style={{ animation: scanning ? 'spin 1s linear infinite' : 'none' }} />
                  {scanning ? 'Scanning…' : 'Run Scan'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ingest result banner */}
      {ingestResult && (
        <div style={{ ...glassCard, marginBottom: 20, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', padding: '12px 20px' }}>
          <span style={{ fontSize: 13, color: '#06B6D4' }}>
            ✓ Ingested {ingestResult.ingested} alert(s) as findings.
          </span>
        </div>
      )}

      {/* Config form */}
      {showConfig && (
        <div style={{ ...glassCard, marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 20px' }}>
            {config?.connected ? 'Update Credentials' : 'Connect Defender for Cloud'}
          </h2>
          <ConfigForm onSaved={() => { void loadConfig(); setShowConfig(false) }} />
        </div>
      )}

      {/* Status / Summary */}
      {config?.connected && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Checks', value: scanData?.total ?? '—', color: '#8B5CF6' },
            { label: 'Passed', value: scanData?.passed ?? '—', color: '#10B981' },
            { label: 'Failed', value: scanData?.failed ?? '—', color: '#EF4444' },
            { label: 'Warnings', value: scanData?.warned ?? '—', color: '#F59E0B' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...glassCard, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      {config?.connected && scanData && (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>

          {/* Left: Secure Score Gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...glassCard, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
              <SecureScoreGauge score={secureScoreResult?.score ?? 0} />
            </div>

            {/* Tab nav */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {TABS.map((tab) => {
                const tabRes = results.filter((r) => r.category === tab.key)
                const hasFail = tabRes.some((r) => r.status === 'fail')
                const hasWarn = tabRes.some((r) => r.status === 'warn')
                const dot = hasFail ? '#EF4444' : hasWarn ? '#F59E0B' : tabRes.length ? '#10B981' : undefined
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '9px 14px', borderRadius: 9, fontSize: 13, fontWeight: 500,
                      background: activeTab === tab.key ? 'rgba(139,92,246,0.12)' : 'transparent',
                      border: activeTab === tab.key ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                      color: activeTab === tab.key ? '#8B5CF6' : 'var(--text-muted)',
                      cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {tab.icon}
                    <span style={{ flex: 1 }}>{tab.label}</span>
                    {dot && <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {TABS.find((t) => t.key === activeTab)?.label}
              </h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({tabResults.length} checks)</span>
            </div>

            {activeTab === 'coverage' && <PlansCoverageGrid results={results} />}

            {tabResults.map((check) => (
              <CheckRow
                key={check.checkId}
                check={check}
                defaultOpen={check.status === 'fail'}
              />
            ))}

            {tabResults.length === 0 && (
              <div style={{ ...glassCard, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 32 }}>
                No checks in this category yet. Run a scan first.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {config?.connected && !scanData && !scanning && (
        <div style={{ ...glassCard, textAlign: 'center', padding: 48 }}>
          <Shield size={40} color="rgba(139,92,246,0.4)" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            Ready to Scan
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px' }}>
            Click &ldquo;Run Scan&rdquo; to assess your Defender for Cloud security posture.
          </p>
          <button
            onClick={handleScan}
            disabled={scanning}
            style={{ padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            Run Scan
          </button>
        </div>
      )}

      {scanning && (
        <div style={{ ...glassCard, textAlign: 'center', padding: 48 }}>
          <RefreshCw size={32} color="#8B5CF6" style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }} />
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Running Defender for Cloud checks…</p>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
