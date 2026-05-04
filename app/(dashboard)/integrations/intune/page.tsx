'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Monitor, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, AlertTriangle, Info, Download, Play, TestTube2,
  Shield, Lock, Smartphone, Settings, Plus
} from 'lucide-react'
import type { IntuneCheckResult } from '@/lib/microsoft/intune'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = IntuneCheckResult['category']

const CATEGORIES: { key: Category; label: string; icon: React.ReactNode }[] = [
  { key: 'devices', label: 'Devices', icon: <Monitor size={14} /> },
  { key: 'encryption', label: 'BitLocker / Encryption', icon: <Lock size={14} /> },
  { key: 'apps', label: 'App Protection', icon: <Smartphone size={14} /> },
  { key: 'os_version', label: 'OS Versions', icon: <Shield size={14} /> },
  { key: 'policies', label: 'Config Profiles', icon: <Settings size={14} /> },
]

const REQUIRED_PERMISSIONS = [
  'DeviceManagementConfiguration.Read.All',
  'DeviceManagementManagedDevices.Read.All',
  'DeviceManagementApps.Read.All',
]

const STATUS_ICON: Record<string, React.ReactNode> = {
  pass: <CheckCircle2 size={15} color="#10B981" />,
  fail: <XCircle size={15} color="#EF4444" />,
  warn: <AlertTriangle size={15} color="#F59E0B" />,
  info: <Info size={15} color="#06B6D4" />,
}

const STATUS_COLOR: Record<string, string> = {
  pass: '#10B981',
  fail: '#EF4444',
  warn: '#F59E0B',
  info: '#06B6D4',
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#10B981',
  info: '#06B6D4',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase', padding: '3px 8px', borderRadius: 100,
      background: `${STATUS_COLOR[status] ?? '#888'}18`,
      color: STATUS_COLOR[status] ?? '#888',
      border: `1px solid ${STATUS_COLOR[status] ?? '#888'}30`,
    }}>
      {STATUS_ICON[status]}
      {status.toUpperCase()}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', padding: '2px 7px', borderRadius: 100,
      background: `${SEVERITY_COLOR[severity] ?? '#888'}18`,
      color: SEVERITY_COLOR[severity] ?? '#888',
      border: `1px solid ${SEVERITY_COLOR[severity] ?? '#888'}28`,
    }}>
      {severity}
    </span>
  )
}

function NistBadge({ control }: { control: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
      padding: '2px 6px', borderRadius: 5,
      background: 'rgba(6,182,212,0.12)', color: '#06B6D4',
      border: '1px solid rgba(6,182,212,0.2)',
    }}>
      {control}
    </span>
  )
}

function ComplianceGauge({ rate, label }: { rate: number; label: string }) {
  const color = rate >= 85 ? '#10B981' : rate >= 70 ? '#F59E0B' : '#EF4444'
  const circumference = 2 * Math.PI * 28
  const offset = circumference - (rate / 100) * circumference
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={70} height={70} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={35} cy={35} r={28} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
        <circle
          cx={35} cy={35} r={28} fill="none"
          stroke={color} strokeWidth={5}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <text x={35} y={35} textAnchor="middle" dominantBaseline="middle"
          style={{ transform: 'rotate(90deg) translate(0px, -70px)', fontSize: 13, fontWeight: 700, fill: color, transformOrigin: '35px 35px' }}>
          {rate}%
        </text>
      </svg>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>{label}</span>
    </div>
  )
}

function CategoryPassRate({ results }: { results: IntuneCheckResult[] }) {
  const pass = results.filter((r) => r.status === 'pass').length
  const total = results.length
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0
  const color = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444'
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 100,
      background: `${color}18`, color, border: `1px solid ${color}30`,
    }}>
      {pass}/{total}
    </span>
  )
}

interface DeviceTableProps {
  result: IntuneCheckResult
  onCreateFinding: (result: IntuneCheckResult) => void
}

function DeviceTable({ result, onCreateFinding }: DeviceTableProps) {
  const [expanded, setExpanded] = useState(false)
  const devices = result.affectedDevices ?? []
  if (devices.length === 0) return null

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {devices.length} non-compliant device{devices.length !== 1 ? 's' : ''}
      </button>
      {expanded && (
        <div style={{ marginTop: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Device Name', 'Owner', 'Detail'].map((h) => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '6px 10px',
                    background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map((d, i) => (
                <tr key={d.id ?? i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '7px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{d.deviceName}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{d.owner}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{d.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => onCreateFinding(result)}
          style={{
            fontSize: 11, fontWeight: 600, color: '#F59E0B',
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
            padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >
          <Plus size={11} /> Create Finding
        </button>
      </div>
    </div>
  )
}

interface CheckCardProps {
  result: IntuneCheckResult
  onExport: () => void
  onCreateFinding: (result: IntuneCheckResult) => void
}

function CheckCard({ result, onExport, onCreateFinding }: CheckCardProps) {
  const showGauge = result.complianceRate !== undefined && result.totalCount !== undefined && result.totalCount > 0

  return (
    <div style={{
      borderRadius: 12, background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${result.status === 'fail' ? 'rgba(239,68,68,0.2)' : result.status === 'warn' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)'}`,
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {showGauge && (
          <div style={{ flexShrink: 0 }}>
            <ComplianceGauge rate={result.complianceRate!} label="" />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <StatusBadge status={result.status} />
            <SeverityBadge severity={result.severity} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
              {result.title}
            </span>
          </div>
          {result.totalCount !== undefined && result.totalCount > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 12 }}>
              {result.compliantCount !== undefined && (
                <span style={{ color: '#10B981' }}>✓ {result.compliantCount} compliant</span>
              )}
              {result.nonCompliantCount !== undefined && result.nonCompliantCount > 0 && (
                <span style={{ color: '#EF4444' }}>✗ {result.nonCompliantCount} non-compliant</span>
              )}
              <span style={{ color: 'var(--text-muted)' }}>of {result.totalCount} total</span>
            </div>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>
            {result.recommendation}
          </p>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
            {result.nistControls.map((ctrl) => (
              <NistBadge key={ctrl} control={ctrl} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onExport}
              style={{
                padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
                color: '#06B6D4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Download size={11} /> Evidence
            </button>
          </div>
          <DeviceTable result={result} onCreateFinding={onCreateFinding} />
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IntuneScanPage() {
  const router = useRouter()
  const [tenantId, setTenantId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [friendlyName, setFriendlyName] = useState('Microsoft Intune')
  const [activeTab, setActiveTab] = useState<Category>('devices')
  const [results, setResults] = useState<IntuneCheckResult[]>([])
  const [scanId, setScanId] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ passed: number; failed: number; warned: number; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [findingMessage, setFindingMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTest = useCallback(async () => {
    if (!tenantId || !clientId || !clientSecret) return
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/integrations/intune/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, clientId, clientSecret }),
      })
      const data = (await res.json()) as { success: boolean; message?: string; error?: string }
      setTestResult(data)
    } catch {
      setTestResult({ success: false, error: 'Network error' })
    } finally {
      setTestLoading(false)
    }
  }, [tenantId, clientId, clientSecret])

  const handleSave = useCallback(async () => {
    if (!tenantId || !clientId || !clientSecret) return
    setSaveLoading(true)
    try {
      await fetch('/api/integrations/intune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, clientId, clientSecret, name: friendlyName }),
      })
    } finally {
      setSaveLoading(false)
    }
  }, [tenantId, clientId, clientSecret, friendlyName])

  const handleScan = useCallback(async () => {
    if (!tenantId || !clientId || !clientSecret) return
    setLoading(true)
    setError(null)
    setResults([])
    setSummary(null)
    try {
      const res = await fetch('/api/integrations/intune/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, clientId, clientSecret }),
      })
      const data = (await res.json()) as {
        success: boolean
        scanId?: string
        summary?: typeof summary
        results?: IntuneCheckResult[]
        error?: string
      }
      if (!data.success) {
        setError(data.error ?? 'Scan failed')
      } else {
        setResults(data.results ?? [])
        setSummary(data.summary ?? null)
        setScanId(data.scanId ?? null)
        setActiveTab('devices')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [tenantId, clientId, clientSecret])

  const handleExportEvidence = useCallback(async (category?: Category, result?: IntuneCheckResult) => {
    const key = category ?? result?.checkId ?? 'all'
    setExportLoading(key)
    setExportMessage(null)
    try {
      const res = await fetch('/api/integrations/intune/export-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId,
          category,
          summary,
          results: result ? [result] : results.filter((r) => !category || r.category === category),
          title: result ? `Intune: ${result.title}` : undefined,
        }),
      })
      const data = (await res.json()) as { success: boolean; title?: string }
      if (data.success) setExportMessage(`Evidence saved: ${data.title}`)
    } finally {
      setExportLoading(null)
    }
  }, [scanId, summary, results])

  const handleCreateFinding = useCallback(async (result: IntuneCheckResult) => {
    setFindingMessage(null)
    try {
      const res = await fetch('/api/findings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `[Intune] ${result.title}`,
          description: result.recommendation,
          severity: result.severity,
          source: 'azure',
          remediationGuidance: result.recommendation,
          rawData: result,
        }),
      })
      if (res.ok) {
        setFindingMessage(`Finding created for: ${result.title}`)
      }
    } catch { /* ignore */ }
  }, [])

  const tabResults = results.filter((r) => r.category === activeTab)

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 80 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => router.push('/settings/integrations')} className="btn-ghost" style={{ fontSize: 13 }}>
          <ArrowLeft size={14} /> Integrations
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Monitor size={22} color="#06B6D4" />
        </div>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            Microsoft Intune
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            19 compliance checks across Devices, BitLocker, App Protection, OS Versions, Config Profiles
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Config Panel */}
        <div>
          <div style={{
            borderRadius: 14, background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)', padding: 20,
          }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              Configuration
            </h2>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
              Intune uses the same Azure app registration as Entra ID. Enter the same credentials with Intune-specific permissions granted.
            </p>

            {[
              { label: 'Friendly Name', val: friendlyName, set: setFriendlyName, type: 'text', placeholder: 'Microsoft Intune' },
              { label: 'Tenant ID', val: tenantId, set: setTenantId, type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
              { label: 'Client ID', val: clientId, set: setClientId, type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
              { label: 'Client Secret', val: clientSecret, set: setClientSecret, type: 'password', placeholder: '••••••••••••••••' },
            ].map(({ label, val, set, type, placeholder }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {label}
                </label>
                <input
                  type={type}
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                onClick={handleTest}
                disabled={testLoading || !tenantId || !clientId || !clientSecret}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
                  color: '#06B6D4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: testLoading || !tenantId || !clientId || !clientSecret ? 0.5 : 1,
                }}
              >
                <TestTube2 size={13} /> {testLoading ? 'Testing…' : 'Test'}
              </button>
              <button
                onClick={handleSave}
                disabled={saveLoading || !tenantId || !clientId || !clientSecret}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  opacity: saveLoading || !tenantId || !clientId || !clientSecret ? 0.5 : 1,
                }}
              >
                {saveLoading ? 'Saving…' : 'Save'}
              </button>
            </div>

            {testResult && (
              <div style={{
                padding: '9px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14,
                background: testResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${testResult.success ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                color: testResult.success ? '#10B981' : '#EF4444',
              }}>
                {testResult.success ? testResult.message : testResult.error}
              </div>
            )}

            <button
              onClick={handleScan}
              disabled={loading || !tenantId || !clientId || !clientSecret}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 9, fontSize: 13, fontWeight: 700,
                background: loading ? 'rgba(6,182,212,0.3)' : 'rgba(6,182,212,0.8)',
                border: '1px solid rgba(6,182,212,0.4)', color: '#fff',
                cursor: loading || !tenantId || !clientId || !clientSecret ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: !tenantId || !clientId || !clientSecret ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              <Play size={14} />
              {loading ? 'Running Scan…' : 'Run Intune Scan'}
            </button>
          </div>

          {/* Required Permissions */}
          <div style={{
            marginTop: 16, borderRadius: 14, background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)', padding: 20,
          }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              Required Graph Permissions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {REQUIRED_PERMISSIONS.map((perm) => (
                <div key={perm} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={13} color="#06B6D4" />
                  <code style={{ fontSize: 11, color: '#06B6D4', background: 'rgba(6,182,212,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                    {perm}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div>
          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#EF4444', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {exportMessage && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
              color: '#10B981', fontSize: 12,
            }}>
              {exportMessage}
            </div>
          )}

          {findingMessage && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
              color: '#F59E0B', fontSize: 12,
            }}>
              {findingMessage}
            </div>
          )}

          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Total', val: summary.total, color: '#06B6D4' },
                { label: 'Passed', val: summary.passed, color: '#10B981' },
                { label: 'Failed', val: summary.failed, color: '#EF4444' },
                { label: 'Warnings', val: summary.warned, color: '#F59E0B' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{
                  padding: '14px', borderRadius: 10, textAlign: 'center',
                  background: `${color}10`, border: `1px solid ${color}25`,
                }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color }}>{val}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <>
              {/* Category Tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {CATEGORIES.map(({ key, label, icon }) => {
                  const catResults = results.filter((r) => r.category === key)
                  if (catResults.length === 0) return null
                  const isActive = activeTab === key
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      style={{
                        padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                        background: isActive ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.04)',
                        border: isActive ? '1px solid rgba(6,182,212,0.4)' : '1px solid rgba(255,255,255,0.07)',
                        color: isActive ? '#06B6D4' : 'var(--text-muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {icon} {label}
                      <CategoryPassRate results={catResults} />
                    </button>
                  )
                })}
              </div>

              {/* Export Category Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button
                  onClick={() => handleExportEvidence(activeTab)}
                  disabled={exportLoading === activeTab}
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
                    color: '#06B6D4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    opacity: exportLoading === activeTab ? 0.5 : 1,
                  }}
                >
                  <Download size={12} />
                  {exportLoading === activeTab ? 'Exporting…' : 'Export Category as Evidence'}
                </button>
              </div>

              {/* Check Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tabResults.map((result) => (
                  <CheckCard
                    key={result.checkId}
                    result={result}
                    onExport={() => handleExportEvidence(undefined, result)}
                    onCreateFinding={handleCreateFinding}
                  />
                ))}
                {tabResults.length === 0 && (
                  <div style={{
                    padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
                    background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    No results for this category
                  </div>
                )}
              </div>
            </>
          )}

          {results.length === 0 && !loading && (
            <div style={{
              padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14,
              background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <Monitor size={36} color="rgba(6,182,212,0.3)" style={{ display: 'block', margin: '0 auto 12px' }} />
              Enter your Azure credentials and run a scan to check Intune device compliance.
            </div>
          )}

          {loading && (
            <div style={{
              padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14,
              background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ marginBottom: 12, fontSize: 13 }}>Running 19 Intune compliance checks…</div>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(6,182,212,0.2)', borderTopColor: '#06B6D4', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
