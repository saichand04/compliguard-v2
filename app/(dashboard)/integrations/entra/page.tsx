'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Shield, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, AlertTriangle, Info, Download, Play, TestTube2,
  Users, Lock, Key, UserCheck, Activity, Eye
} from 'lucide-react'
import type { EntraCheckResult } from '@/lib/microsoft/entra'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = EntraCheckResult['category']

const CATEGORIES: { key: Category; label: string; icon: React.ReactNode }[] = [
  { key: 'mfa', label: 'MFA', icon: <Lock size={14} /> },
  { key: 'conditional_access', label: 'Conditional Access', icon: <Shield size={14} /> },
  { key: 'privileged_roles', label: 'Privileged Roles', icon: <Key size={14} /> },
  { key: 'users', label: 'Users', icon: <Users size={14} /> },
  { key: 'groups', label: 'Groups', icon: <UserCheck size={14} /> },
  { key: 'sign_in_risk', label: 'Sign-in Risk', icon: <Activity size={14} /> },
]

const REQUIRED_PERMISSIONS = [
  'User.Read.All',
  'Group.Read.All',
  'Policy.Read.All',
  'RoleManagement.Read.Directory',
  'IdentityRiskyUser.Read.All',
  'Reports.Read.All',
  'AuditLog.Read.All',
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
      background: 'rgba(139,92,246,0.12)', color: '#8B5CF6',
      border: '1px solid rgba(139,92,246,0.2)',
    }}>
      {control}
    </span>
  )
}

function CheckCard({ result, onExport }: { result: EntraCheckResult; onExport: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const hasItems = (result.items?.length ?? 0) > 0

  return (
    <div style={{
      borderRadius: 12, background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${result.status === 'fail' ? 'rgba(239,68,68,0.2)' : result.status === 'warn' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)'}`,
      overflow: 'hidden', transition: 'border-color 0.15s',
    }}>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <StatusBadge status={result.status} />
              <SeverityBadge severity={result.severity} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                {result.title}
              </span>
              {result.count !== undefined && result.count > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: 100 }}>
                  {result.count} affected
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {result.recommendation}
            </p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
              {result.nistControls.map((ctrl) => (
                <NistBadge key={ctrl} control={ctrl} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={onExport}
              title="Export as evidence"
              style={{
                padding: '6px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
                color: '#06B6D4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Download size={11} /> Evidence
            </button>
            {hasItems && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  padding: '6px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Eye size={11} /> Affected {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            )}
          </div>
        </div>
      </div>
      {expanded && hasItems && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 18px', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.items!.map((item, i) => (
              <div key={item.id ?? i} style={{
                display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', minWidth: 120 }}>
                  {item.displayName}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryPassRate({ results }: { results: EntraCheckResult[] }) {
  const pass = results.filter((r) => r.status === 'pass').length
  const total = results.length
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0
  const color = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444'
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 100,
      background: `${color}18`, color, border: `1px solid ${color}30`,
    }}>
      {pass}/{total} passed
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EntraDeepScanPage() {
  const router = useRouter()
  const [tenantId, setTenantId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [friendlyName, setFriendlyName] = useState('Entra ID')
  const [activeTab, setActiveTab] = useState<Category>('mfa')
  const [results, setResults] = useState<EntraCheckResult[]>([])
  const [scanId, setScanId] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ passed: number; failed: number; warned: number; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTest = useCallback(async () => {
    if (!tenantId || !clientId || !clientSecret) return
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/integrations/entra/test', {
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
      await fetch('/api/integrations/entra', {
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
      const res = await fetch('/api/integrations/entra/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, clientId, clientSecret }),
      })
      const data = (await res.json()) as {
        success: boolean
        scanId?: string
        summary?: typeof summary
        results?: EntraCheckResult[]
        error?: string
      }
      if (!data.success) {
        setError(data.error ?? 'Scan failed')
      } else {
        setResults(data.results ?? [])
        setSummary(data.summary ?? null)
        setScanId(data.scanId ?? null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [tenantId, clientId, clientSecret])

  const handleExportEvidence = useCallback(async (category?: string, result?: EntraCheckResult) => {
    const key = category ?? result?.checkId ?? 'all'
    setExportLoading(key)
    setExportMessage(null)
    try {
      const res = await fetch('/api/integrations/entra/export-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId,
          category,
          summary,
          results: result ? [result] : results.filter((r) => !category || r.category === category),
          title: result ? `Entra ID: ${result.title}` : undefined,
        }),
      })
      const data = (await res.json()) as { success: boolean; title?: string }
      if (data.success) setExportMessage(`Evidence saved: ${data.title}`)
    } finally {
      setExportLoading(null)
    }
  }, [scanId, summary, results])

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
          background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={22} color="#8B5CF6" />
        </div>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            Entra ID Deep Scan
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            20 compliance checks across MFA, Conditional Access, Privileged Roles, Users &amp; Groups, Sign-in Risk
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

            {[
              { label: 'Friendly Name', val: friendlyName, set: setFriendlyName, type: 'text', placeholder: 'My Azure Tenant' },
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
                background: loading ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.85)',
                border: '1px solid rgba(139,92,246,0.5)', color: '#fff',
                cursor: loading || !tenantId || !clientId || !clientSecret ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: !tenantId || !clientId || !clientSecret ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              <Play size={14} />
              {loading ? 'Running Scan…' : 'Run Full Scan'}
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
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              Grant these application permissions in Azure portal → App registrations → API permissions:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {REQUIRED_PERMISSIONS.map((perm) => (
                <div key={perm} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={13} color="#8B5CF6" />
                  <code style={{ fontSize: 11, color: '#8B5CF6', background: 'rgba(139,92,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>
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

          {summary && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20,
            }}>
              {[
                { label: 'Total', val: summary.total, color: '#8B5CF6' },
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
                        background: isActive ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                        border: isActive ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.07)',
                        color: isActive ? '#8B5CF6' : 'var(--text-muted)',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tabResults.map((result) => (
                  <CheckCard
                    key={result.checkId}
                    result={result}
                    onExport={() => handleExportEvidence(undefined, result)}
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
              <Shield size={36} color="rgba(139,92,246,0.3)" style={{ display: 'block', margin: '0 auto 12px' }} />
              Enter your Azure credentials and run a scan to see compliance results.
            </div>
          )}

          {loading && (
            <div style={{
              padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14,
              background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ marginBottom: 12, fontSize: 13 }}>Running 20 Entra ID compliance checks…</div>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(139,92,246,0.2)', borderTopColor: '#8B5CF6', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
