'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Activity, RefreshCw, Zap, AlertTriangle, CheckCircle,
  XCircle, Info, ArrowLeft, ChevronRight, Shield,
  Database, Link2, Eye, Clock, FileText,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SentinelCheckResult {
  category: 'incidents' | 'analytics_rules' | 'watchlists' | 'threat_intel' | 'data_connectors'
  checkId: string
  title: string
  status: 'pass' | 'fail' | 'warn' | 'info'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  count?: number
  items?: Array<{ id: string; name: string; severity?: string; status?: string; tactics?: string[] }>
  recommendation: string
  nistControls: string[]
}

interface ScanData {
  ok: boolean
  total: number
  passed: number
  failed: number
  warned: number
  results: SentinelCheckResult[]
}

interface SentinelConfig {
  connected: boolean
  tenantId?: string
  clientId?: string
  subscriptionId?: string
  resourceGroup?: string
  workspaceName?: string
  lastSyncAt?: string
}

interface IngestResult {
  ok: boolean
  ingested: number
  total: number
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

const MITRE_TACTIC_COLORS: Record<string, string> = {
  Reconnaissance: '#8B5CF6',
  'Resource Development': '#7C3AED',
  'Initial Access': '#EF4444',
  Execution: '#F97316',
  Persistence: '#F59E0B',
  'Privilege Escalation': '#EF4444',
  'Defense Evasion': '#06B6D4',
  'Credential Access': '#EC4899',
  Discovery: '#10B981',
  'Lateral Movement': '#F97316',
  Collection: '#8B5CF6',
  'Command and Control': '#EF4444',
  Exfiltration: '#DC2626',
  Impact: '#991B1B',
}

function tacticColor(tactic: string): string {
  return MITRE_TACTIC_COLORS[tactic] ?? '#6B7280'
}

function StatusIcon({ status, size = 14 }: { status: string; size?: number }) {
  const color = STATUS_COLOR[status] ?? '#6B7280'
  if (status === 'pass') return <CheckCircle size={size} color={color} />
  if (status === 'fail') return <XCircle size={size} color={color} />
  if (status === 'warn') return <AlertTriangle size={size} color={color} />
  return <Info size={size} color={color} />
}

function SeverityBadge({ severity }: { severity?: string }) {
  if (!severity) return null
  const color = SEV_COLOR[severity.toLowerCase()] ?? '#6B7280'
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

function TacticChip({ tactic }: { tactic: string }) {
  const color = tacticColor(tactic)
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, color,
      background: `${color}18`, border: `1px solid ${color}30`,
      padding: '2px 8px', borderRadius: 100,
    }}>
      {tactic}
    </span>
  )
}

// ── Config Form ───────────────────────────────────────────────────────────────

function ConfigForm({ initial, onSaved }: { initial?: SentinelConfig; onSaved: () => void }) {
  const [form, setForm] = useState({
    tenantId: initial?.tenantId ?? '',
    clientId: initial?.clientId ?? '',
    clientSecret: '',
    subscriptionId: initial?.subscriptionId ?? '',
    resourceGroup: initial?.resourceGroup ?? '',
    workspaceName: initial?.workspaceName ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null)
  const [error, setError] = useState('')

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/integrations/sentinel/test', {
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
      const res = await fetch('/api/integrations/sentinel', {
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

  const fields: Array<{ label: string; key: keyof typeof form; placeholder: string; type?: string }> = [
    { label: 'Tenant ID', key: 'tenantId', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    { label: 'Client ID (App ID)', key: 'clientId', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    { label: 'Client Secret', key: 'clientSecret', placeholder: '••••••••••••••••', type: 'password' },
    { label: 'Subscription ID', key: 'subscriptionId', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    { label: 'Resource Group', key: 'resourceGroup', placeholder: 'my-sentinel-rg' },
    { label: 'Log Analytics Workspace Name', key: 'workspaceName', placeholder: 'my-sentinel-workspace' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
        Connect using an Azure AD service principal with <strong>Microsoft Sentinel Reader</strong> role on the Log Analytics workspace.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {fields.map(({ label, key, placeholder, type }) => (
          <div key={key} style={{ gridColumn: key === 'workspaceName' || key === 'clientSecret' ? 'span 2' : undefined }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              {label}
            </label>
            <input
              type={type ?? 'text'}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              style={inputStyle}
            />
          </div>
        ))}
      </div>

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
          style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)', color: '#06B6D4', cursor: 'pointer', flex: 1 }}
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !form.tenantId || !form.clientId || !form.clientSecret || !form.subscriptionId || !form.resourceGroup || !form.workspaceName}
          style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)', border: 'none', color: '#fff', cursor: 'pointer', flex: 1 }}
        >
          {saving ? 'Saving…' : 'Save & Connect'}
        </button>
      </div>
    </div>
  )
}

// ── Incidents Table ───────────────────────────────────────────────────────────

function IncidentsTable({ results }: { results: SentinelCheckResult[] }) {
  const openCritical = results.find((r) => r.checkId === 'sentinel.incidents.open_critical')
  const openHigh = results.find((r) => r.checkId === 'sentinel.incidents.open_high')
  const allItems = [...(openCritical?.items ?? []), ...(openHigh?.items ?? [])]

  if (allItems.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>No open critical/high incidents</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {allItems.slice(0, 15).map((item) => (
        <div key={item.id} style={{
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{item.name}</span>
            <SeverityBadge severity={item.severity} />
            <span style={{ fontSize: 11, color: item.status === 'New' ? '#F59E0B' : '#06B6D4' }}>{item.status}</span>
          </div>
          {item.tactics && item.tactics.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {item.tactics.map((t) => <TacticChip key={t} tactic={t} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Rules Coverage ────────────────────────────────────────────────────────────

function RulesCoverage({ results }: { results: SentinelCheckResult[] }) {
  const ruleChecks = results.filter((r) => r.category === 'analytics_rules')
  if (ruleChecks.length === 0) return null

  const totalEnabled = ruleChecks.find((r) => r.checkId === 'sentinel.rules.total_enabled')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {totalEnabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <Shield size={18} color="#8B5CF6" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{totalEnabled.count ?? 0} Enabled Rules</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalEnabled.status === 'warn' ? 'Below recommended threshold of 10' : 'Coverage adequate'}</div>
          </div>
          <StatusIcon status={totalEnabled.status} size={18} />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {ruleChecks.filter((r) => r.checkId !== 'sentinel.rules.total_enabled').map((rule) => (
          <div key={rule.checkId} style={{
            padding: '10px 14px', borderRadius: 9,
            background: rule.status === 'pass' ? 'rgba(16,185,129,0.06)' : rule.status === 'fail' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
            border: `1px solid ${rule.status === 'pass' ? 'rgba(16,185,129,0.15)' : rule.status === 'fail' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <StatusIcon status={rule.status} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{rule.title}</div>
              {rule.count !== undefined && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rule.count} rules</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Data Connectors Grid ──────────────────────────────────────────────────────

function ConnectorsGrid({ results }: { results: SentinelCheckResult[] }) {
  const connectorChecks = results.filter((r) => r.category === 'data_connectors')
  if (connectorChecks.length === 0) return null

  const LABELS: Record<string, string> = {
    'sentinel.connectors.aad_enabled': 'Azure Active Directory',
    'sentinel.connectors.defender_enabled': 'Microsoft Defender',
    'sentinel.connectors.office365_enabled': 'Office 365',
    'sentinel.connectors.syslog_enabled': 'Syslog / CEF',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
      {connectorChecks.map((c) => {
        const connected = c.status === 'pass'
        return (
          <div key={c.checkId} style={{
            padding: '14px 16px', borderRadius: 10,
            background: connected ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${connected ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)'}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Link2 size={16} color={connected ? '#10B981' : '#EF4444'} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{LABELS[c.checkId] ?? c.title}</div>
              <div style={{ fontSize: 11, color: connected ? '#10B981' : '#EF4444' }}>{connected ? 'Connected' : 'Not Connected'}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Watchlists Panel ──────────────────────────────────────────────────────────

function WatchlistsPanel({ results }: { results: SentinelCheckResult[] }) {
  const countCheck = results.find((r) => r.checkId === 'sentinel.watchlists.count')
  if (!countCheck?.items?.length) {
    return <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>No watchlists configured</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {countCheck.items.map((wl) => (
        <div key={wl.id} style={{
          padding: '10px 14px', borderRadius: 9,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <FileText size={14} color="#8B5CF6" />
          <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{wl.name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{wl.status}</span>
        </div>
      ))}
    </div>
  )
}

// ── Threat Intelligence ───────────────────────────────────────────────────────

function ThreatIntelPanel({ results }: { results: SentinelCheckResult[] }) {
  const countCheck = results.find((r) => r.checkId === 'sentinel.ti.indicators_count')
  const activeCheck = results.find((r) => r.checkId === 'sentinel.ti.active_indicators')
  const typesCheck = results.find((r) => r.checkId === 'sentinel.ti.ioc_types')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#8B5CF6', marginBottom: 4 }}>{countCheck?.count ?? 0}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Indicators</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981', marginBottom: 4 }}>{activeCheck?.count ?? 0}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</div>
        </div>
      </div>
      {typesCheck?.items && typesCheck.items.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>IoC Types</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {typesCheck.items.map((t) => (
              <span key={t.id} style={{ fontSize: 11, fontWeight: 600, color: '#06B6D4', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', padding: '3px 10px', borderRadius: 100 }}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Check Row ─────────────────────────────────────────────────────────────────

function CheckRow({ check }: { check: SentinelCheckResult }) {
  const [open, setOpen] = useState(check.status === 'fail')

  return (
    <div style={{ borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
        <StatusIcon status={check.status} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{check.title}</span>
        {check.count !== undefined && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>{check.count}</span>}
        <SeverityBadge severity={check.severity} />
        <ChevronRight size={14} color="var(--text-muted)" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0 8px' }}>{check.recommendation}</p>
          {check.nistControls.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {check.nistControls.map((c) => (
                <span key={c} style={{ fontSize: 10, fontWeight: 600, color: '#8B5CF6', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', padding: '2px 8px', borderRadius: 100 }}>{c}</span>
              ))}
            </div>
          )}
          {check.items && check.items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {check.items.slice(0, 8).map((item) => (
                <div key={item.id} style={{ padding: '8px 12px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: item.tactics?.length ? 4 : 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{item.name}</span>
                    {item.severity && <SeverityBadge severity={item.severity} />}
                    {item.status && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.status}</span>}
                  </div>
                  {item.tactics && item.tactics.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {item.tactics.map((t) => <TacticChip key={t} tactic={t} />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Audit Trail Preview ───────────────────────────────────────────────────────

interface AuditEntry {
  id: string
  action: string
  resourceTitle?: string
  description?: string
  createdAt: string
  after?: Record<string, unknown>
}

function AuditTrailPreview() {
  const [entries, setEntries] = useState<AuditEntry[]>([])

  useEffect(() => {
    fetch('/api/audit-logs?action=sentinel_incident_ingested&limit=5')
      .then((r) => r.json())
      .then((d: unknown) => {
        const data = d as { logs?: AuditEntry[] }
        if (data.logs) setEntries(data.logs)
      })
      .catch(() => {/* ignore */})
  }, [])

  if (entries.length === 0) return (
    <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
      No ingested incidents yet. Click &ldquo;Ingest Incidents&rdquo; to begin.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map((entry) => (
        <div key={entry.id} style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <Activity size={13} color="#8B5CF6" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{entry.resourceTitle ?? 'Incident'}</span>
            <Clock size={11} color="var(--text-muted)" />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(entry.createdAt).toLocaleString()}</span>
          </div>
          {entry.description && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{entry.description}</div>}
          {entry.after && typeof entry.after === 'object' && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {((entry.after as Record<string, unknown>)['tactics'] as string[] | undefined)?.map((t) => <TacticChip key={t} tactic={t} />)}
              {!!((entry.after as Record<string, unknown>)['severity']) && <SeverityBadge severity={String((entry.after as Record<string, unknown>)['severity'])} />}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

const TABS = [
  { key: 'incidents' as const, label: 'Incidents', icon: <AlertTriangle size={13} /> },
  { key: 'analytics_rules' as const, label: 'Analytics Rules', icon: <Shield size={13} /> },
  { key: 'watchlists' as const, label: 'Watchlists', icon: <FileText size={13} /> },
  { key: 'data_connectors' as const, label: 'Data Connectors', icon: <Link2 size={13} /> },
  { key: 'threat_intel' as const, label: 'Threat Intel', icon: <Eye size={13} /> },
]

type TabKey = (typeof TABS)[number]['key']

export default function SentinelDashboardPage() {
  const [config, setConfig] = useState<SentinelConfig | null>(null)
  const [scanData, setScanData] = useState<ScanData | null>(null)
  const [scanning, setScanning] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('incidents')
  const [showConfig, setShowConfig] = useState(false)

  const loadConfig = useCallback(async () => {
    const res = await fetch('/api/integrations/sentinel')
    const data = await res.json() as SentinelConfig
    setConfig(data)
    if (!data.connected) setShowConfig(true)
  }, [])

  useEffect(() => { void loadConfig() }, [loadConfig])

  async function handleScan() {
    setScanning(true)
    setScanData(null)
    try {
      const res = await fetch('/api/integrations/sentinel/scan', { method: 'POST' })
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
      const res = await fetch('/api/integrations/sentinel/ingest-incidents', { method: 'POST' })
      const data = await res.json() as IngestResult
      setIngestResult(data)
    } finally {
      setIngesting(false)
    }
  }

  async function handleDisconnect() {
    await fetch('/api/integrations/sentinel', { method: 'DELETE' })
    setConfig(null)
    setScanData(null)
    setShowConfig(true)
  }

  const results = scanData?.results ?? []

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
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={20} color="#06B6D4" />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Azure Sentinel SIEM
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Incidents · Analytics Rules · Watchlists · Threat Intelligence
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {config?.connected && (
              <>
                <button onClick={() => setShowConfig((s) => !s)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {showConfig ? 'Hide Config' : 'Edit Config'}
                </button>
                <button onClick={handleDisconnect} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', cursor: 'pointer' }}>
                  Disconnect
                </button>
                <button
                  onClick={handleIngest}
                  disabled={ingesting || !scanData}
                  style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#8B5CF6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <Zap size={12} /> {ingesting ? 'Ingesting…' : 'Ingest Incidents as Findings'}
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
        <div style={{ ...glassCard, marginBottom: 20, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', padding: '12px 20px' }}>
          <span style={{ fontSize: 13, color: '#8B5CF6' }}>
            ✓ Ingested {ingestResult.ingested} of {ingestResult.total} open incident(s) as findings.
          </span>
        </div>
      )}

      {/* Config form */}
      {showConfig && (
        <div style={{ ...glassCard, marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 20px' }}>
            {config?.connected ? 'Update Credentials' : 'Connect Azure Sentinel'}
          </h2>
          <ConfigForm initial={config ?? undefined} onSaved={() => { void loadConfig(); setShowConfig(false) }} />
        </div>
      )}

      {/* Summary stats */}
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

      {/* Workspace info */}
      {config?.connected && config.workspaceName && (
        <div style={{ ...glassCard, marginBottom: 20, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Database size={14} color="#06B6D4" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Workspace: <strong style={{ color: 'var(--text-primary)' }}>{config.workspaceName}</strong>
            {config.resourceGroup && <> · RG: <strong style={{ color: 'var(--text-primary)' }}>{config.resourceGroup}</strong></>}
          </span>
          {config.lastSyncAt && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Last scan: {new Date(config.lastSyncAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Main content: Tabs */}
      {config?.connected && scanData && (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>

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
                    background: activeTab === tab.key ? 'rgba(6,182,212,0.1)' : 'transparent',
                    border: activeTab === tab.key ? '1px solid rgba(6,182,212,0.25)' : '1px solid transparent',
                    color: activeTab === tab.key ? '#06B6D4' : 'var(--text-muted)',
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

            {/* Audit trail preview in sidebar */}
            <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Audit Trail
              </div>
              <AuditTrailPreview />
            </div>
          </div>

          {/* Tab content */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {TABS.find((t) => t.key === activeTab)?.label}
              </h2>
            </div>

            {/* Specialized views */}
            {activeTab === 'incidents' && <IncidentsTable results={results} />}
            {activeTab === 'analytics_rules' && <RulesCoverage results={results} />}
            {activeTab === 'watchlists' && <WatchlistsPanel results={results} />}
            {activeTab === 'data_connectors' && <ConnectorsGrid results={results} />}
            {activeTab === 'threat_intel' && <ThreatIntelPanel results={results} />}

            {/* All checks for the tab */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                All Checks
              </div>
              {results.filter((r) => r.category === activeTab).map((check) => (
                <CheckRow key={check.checkId} check={check} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {config?.connected && !scanData && !scanning && (
        <div style={{ ...glassCard, textAlign: 'center', padding: 48 }}>
          <Activity size={40} color="rgba(6,182,212,0.4)" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            Sentinel Connected
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px' }}>
            Run a scan to assess your Sentinel SIEM configuration and incident posture.
          </p>
          <button
            onClick={handleScan}
            style={{ padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            Run Scan
          </button>
        </div>
      )}

      {scanning && (
        <div style={{ ...glassCard, textAlign: 'center', padding: 48 }}>
          <RefreshCw size={32} color="#06B6D4" style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }} />
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Running Sentinel checks…</p>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
