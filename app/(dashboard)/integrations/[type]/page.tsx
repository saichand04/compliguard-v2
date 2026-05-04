'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Info, Clock, Trash2, TestTube2, Save, ShieldCheck, GitBranch, Cloud,
  Eye, EyeOff, ChevronRight, ExternalLink, Loader2, Shield,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CheckResult {
  checkId: string
  title: string
  description: string
  status: 'pass' | 'fail' | 'warn' | 'skip'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  resource?: string
  remediation?: string
  evidence?: string
}

interface ScanSummary {
  totalChecks: number
  passed: number
  failed: number
  warned: number
  skipped: number
  scannedAt: string
}

interface ScanHistoryItem {
  id: string
  scannedAt: string
  scanType: string
  passed: string | null
  failed: string | null
  summary: Record<string, unknown> | null
}

interface IntegrationData {
  connected: boolean
  integration: {
    id: string
    type: string
    name: string
    status: string
    lastSyncAt: string | null
    errorMessage: string | null
    config: Record<string, string>
  } | null
  scanHistory: ScanHistoryItem[]
}

// ── Integration meta ──────────────────────────────────────────────────────────

const INTEGRATION_META: Record<string, {
  name: string
  icon: React.ElementType
  color: string
  description: string
  configFields: Array<{ key: string; label: string; placeholder: string; type?: string; required?: boolean; hint?: string }>
  credentialKeys: string[]
  docsUrl?: string
}> = {
  github: {
    name: 'GitHub',
    icon: GitBranch,
    color: '#8B5CF6',
    description: 'Connect your GitHub organization to scan for security misconfigurations, branch protection gaps, secret exposure, and Dependabot alerts.',
    configFields: [
      {
        key: 'token',
        label: 'Personal Access Token',
        placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
        type: 'password',
        required: true,
        hint: 'Requires: repo, read:org, security_events scopes',
      },
      {
        key: 'owner',
        label: 'Organization / User',
        placeholder: 'your-org-or-username',
        required: false,
        hint: 'Optional — leave blank to auto-detect from token',
      },
    ],
    credentialKeys: ['token'],
    docsUrl: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token',
  },
  aws: {
    name: 'Amazon Web Services',
    icon: Cloud,
    color: '#F97316',
    description: 'Connect your AWS account to run 40+ security checks across IAM, S3, CloudTrail, GuardDuty, SecurityHub, VPC, EC2, RDS, KMS, and more.',
    configFields: [
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        placeholder: 'AKIAIOSFODNN7EXAMPLE',
        required: true,
        hint: 'IAM user access key — read-only permissions recommended',
      },
      {
        key: 'secretAccessKey',
        label: 'Secret Access Key',
        placeholder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        type: 'password',
        required: true,
      },
      {
        key: 'region',
        label: 'Primary Region',
        placeholder: 'us-east-1',
        required: true,
        hint: 'e.g. us-east-1, eu-west-1, ap-southeast-2',
      },
      {
        key: 'sessionToken',
        label: 'Session Token',
        placeholder: 'Optional — for STS temporary credentials',
        type: 'password',
        required: false,
      },
    ],
    credentialKeys: ['secretAccessKey', 'sessionToken'],
    docsUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html',
  },
}

// ── Status styling ────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  pass: { icon: CheckCircle2, color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', label: 'PASS' },
  fail: { icon: XCircle, color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', label: 'FAIL' },
  warn: { icon: AlertTriangle, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', label: 'WARN' },
  skip: { icon: Info, color: '#94A3B8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)', label: 'SKIP' },
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#3B82F6',
  info: '#94A3B8',
}

// ── Check result row ──────────────────────────────────────────────────────────

function CheckRow({ check }: { check: CheckResult }) {
  const [expanded, setExpanded] = useState(false)
  const sm = STATUS_META[check.status] ?? STATUS_META.skip
  const StatusIcon = sm.icon

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${sm.border}20`,
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Status badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
          color: sm.color, background: sm.bg, border: `1px solid ${sm.border}`,
          borderRadius: 4, padding: '2px 6px',
        }}>
          <StatusIcon size={9} />
          {sm.label}
        </span>

        {/* Severity dot */}
        <div style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: SEVERITY_COLOR[check.severity] ?? '#94A3B8',
        }} />

        {/* Title */}
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          {check.title}
        </span>

        {/* Resource */}
        {check.resource && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {check.resource}
          </span>
        )}

        <ChevronRight size={13} color="var(--text-muted)" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '10px 0 0' }}>
            {check.description}
          </p>
          {check.evidence && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {check.evidence}
            </div>
          )}
          {check.remediation && check.status === 'fail' && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#EF4444', letterSpacing: '0.04em', marginBottom: 4 }}>REMEDIATION</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{check.remediation}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ type: string }>
}

export default function IntegrationDetailPage({ params }: PageProps) {
  const { type } = use(params)
  const router = useRouter()
  const meta = INTEGRATION_META[type]

  const [data, setData] = useState<IntegrationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [scanResults, setScanResults] = useState<CheckResult[] | null>(null)
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'fail' | 'warn' | 'pass'>('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/integrations/${type}`)
      if (res.ok) {
        const json = await res.json() as IntegrationData
        setData(json)
        // Pre-fill non-secret fields
        if (json.integration?.config) {
          const safe: Record<string, string> = {}
          meta?.configFields.forEach((f) => {
            if (!meta.credentialKeys.includes(f.key) && json.integration?.config[f.key]) {
              safe[f.key] = json.integration.config[f.key]
            }
          })
          setFormValues(safe)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [type, meta])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  if (!meta) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Integration type "{type}" not found.
        <br />
        <Link href="/integrations" style={{ color: '#8B5CF6', marginTop: 12, display: 'inline-block' }}>← Back to Integrations</Link>
      </div>
    )
  }

  const Icon = meta.icon
  const connected = data?.connected ?? false

  const handleSave = async () => {
    setSaving(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/integrations/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues),
      })
      const json = await res.json() as { success?: boolean; error?: string }
      if (json.success) {
        setTestResult({ success: true, message: 'Configuration saved successfully.' })
        await fetchData()
      } else {
        setTestResult({ success: false, message: json.error ?? 'Failed to save' })
      }
    } catch {
      setTestResult({ success: false, message: 'Network error saving configuration' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/integrations/${type}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues),
      })
      const json = await res.json() as { success?: boolean; error?: string; user?: { login: string }; identity?: { accountId: string; arn: string } }
      if (json.success) {
        const details = json.user ? `Connected as ${json.user.login}` :
          json.identity ? `Account: ${json.identity.accountId}` : 'Connection successful'
        setTestResult({ success: true, message: details })
      } else {
        setTestResult({ success: false, message: json.error ?? 'Connection test failed' })
      }
    } catch {
      setTestResult({ success: false, message: 'Network error during test' })
    } finally {
      setTesting(false)
    }
  }

  const handleScan = async () => {
    setScanning(true)
    setScanResults(null)
    setScanSummary(null)
    try {
      const res = await fetch(`/api/integrations/${type}/scan`, { method: 'POST' })
      const json = await res.json() as { success?: boolean; results?: CheckResult[]; summary?: ScanSummary; error?: string }
      if (json.success && json.results) {
        setScanResults(json.results)
        setScanSummary(json.summary ?? null)
        await fetchData()
      } else {
        setTestResult({ success: false, message: json.error ?? 'Scan failed' })
      }
    } catch {
      setTestResult({ success: false, message: 'Network error during scan' })
    } finally {
      setScanning(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm(`Disconnect ${meta.name} integration? This will delete stored credentials.`)) return
    setDisconnecting(true)
    try {
      await fetch(`/api/integrations/${type}`, { method: 'DELETE' })
      router.push('/integrations')
    } finally {
      setDisconnecting(false)
    }
  }

  const displayedResults = scanResults?.filter((r) => {
    if (statusFilter === 'all') return true
    return r.status === statusFilter
  }) ?? []

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }} className="animate-fade-in">
      {/* ── Back ──────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push('/integrations')} className="btn-ghost" style={{ fontSize: 13 }}>
          <ArrowLeft size={13} /> Integrations
        </button>
      </div>

      {/* ── Page header ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${meta.color}18`, border: `1px solid ${meta.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={22} color={meta.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {meta.name}
            </h1>
            {connected ? (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                color: '#10B981', background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '2px 8px',
              }}>CONNECTED</span>
            ) : (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                color: '#94A3B8', background: 'rgba(148,163,184,0.08)',
                border: '1px solid rgba(148,163,184,0.15)', borderRadius: 20, padding: '2px 8px',
              }}>NOT CONNECTED</span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{meta.description}</p>
        </div>

        {meta.docsUrl && (
          <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-muted)', textDecoration: 'none' }}>
            Docs <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* ── Two column layout ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Left: Config form ───────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: 20,
          }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, letterSpacing: '-0.01em' }}>
              Configuration
            </h2>

            {meta.configFields.map((field) => {
              const isSecret = field.type === 'password'
              const showSecret = showSecrets[field.key]

              return (
                <div key={field.key} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    {field.label}
                    {field.required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={isSecret && !showSecret ? 'password' : 'text'}
                      value={formValues[field.key] ?? ''}
                      onChange={(e) => setFormValues({ ...formValues, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 7, padding: isSecret ? '8px 36px 8px 12px' : '8px 12px',
                        fontSize: 12.5, color: 'var(--text-primary)', outline: 'none',
                        fontFamily: isSecret ? 'monospace' : 'inherit',
                      }}
                    />
                    {isSecret && (
                      <button
                        type="button"
                        onClick={() => setShowSecrets({ ...showSecrets, [field.key]: !showSecret })}
                        style={{
                          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)',
                        }}
                      >
                        {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    )}
                  </div>
                  {field.hint && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{field.hint}</p>
                  )}
                </div>
              )
            })}

            {/* Test result */}
            {testResult && (
              <div style={{
                padding: '9px 12px', borderRadius: 7, marginBottom: 14,
                background: testResult.success ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${testResult.success ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                color: testResult.success ? '#10B981' : '#EF4444',
                fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {testResult.success ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                {testResult.message}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => void handleTest()}
                  disabled={testing}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontSize: 12.5, fontWeight: 500, padding: '8px 12px', borderRadius: 8, cursor: testing ? 'not-allowed' : 'pointer',
                    background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)', color: '#06B6D4',
                    opacity: testing ? 0.7 : 1,
                  }}
                >
                  {testing ? <Loader2 size={12} className="animate-spin" /> : <TestTube2 size={12} />}
                  Test Connection
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontSize: 12.5, fontWeight: 500, padding: '8px 12px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                    background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', color: '#8B5CF6',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
              </div>

              {connected && (
                <button
                  onClick={() => void handleDisconnect()}
                  disabled={disconnecting}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontSize: 12.5, fontWeight: 500, padding: '8px 12px', borderRadius: 8, cursor: disconnecting ? 'not-allowed' : 'pointer',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444',
                    opacity: disconnecting ? 0.7 : 1,
                  }}
                >
                  <Trash2 size={12} />
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {/* Scan history */}
          {data?.scanHistory && data.scanHistory.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: 20,
            }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14, letterSpacing: '-0.01em' }}>
                Scan History
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.scanHistory.map((scan) => {
                  const summary = scan.summary as { failed?: number; passed?: number; totalChecks?: number } | null
                  const failedCount = summary?.failed ?? parseInt(scan.failed ?? '0', 10)
                  const passedCount = summary?.passed ?? parseInt(scan.passed ?? '0', 10)
                  return (
                    <div key={scan.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 7,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={11} color="var(--text-muted)" />
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {new Date(scan.scannedAt).toLocaleDateString()} {new Date(scan.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                        <span style={{ color: '#10B981' }}>{passedCount} pass</span>
                        <span style={{ color: '#EF4444' }}>{failedCount} fail</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* View Findings link */}
          {connected && (
            <Link
              href={`/findings?source=${type}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 16px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none',
                transition: 'all 0.15s',
              }}
            >
              <Shield size={13} />
              View Findings from {meta.name}
              <ChevronRight size={13} />
            </Link>
          )}
        </div>

        {/* ── Right: Scan results ─────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Run scan button */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
                Security Scan
              </h2>
              {connected && (
                <button
                  onClick={() => void handleScan()}
                  disabled={scanning}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12.5, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: scanning ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                    border: 'none', color: '#fff',
                    opacity: scanning ? 0.7 : 1, transition: 'all 0.15s',
                  }}
                >
                  {scanning ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {scanning ? 'Scanning…' : 'Run Scan Now'}
                </button>
              )}
            </div>

            {!connected && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Configure and save your credentials to run security scans.
              </div>
            )}

            {/* Scan summary stats */}
            {scanSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Passed', value: scanSummary.passed, color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
                  { label: 'Failed', value: scanSummary.failed, color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
                  { label: 'Warned', value: scanSummary.warned, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
                  { label: 'Skipped', value: scanSummary.skipped, color: '#94A3B8', bg: 'rgba(148,163,184,0.08)' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} style={{ background: bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Filter tabs */}
            {scanResults && scanResults.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {(['all', 'fail', 'warn', 'pass'] as const).map((f) => {
                  const count = f === 'all' ? scanResults.length : scanResults.filter((r) => r.status === f).length
                  return (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      style={{
                        fontSize: 11.5, fontWeight: 500, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: statusFilter === f ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${statusFilter === f ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        color: statusFilter === f ? '#8B5CF6' : 'var(--text-muted)',
                      }}
                    >
                      {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                    </button>
                  )
                })}
              </div>
            )}

            {/* Check results list */}
            {displayedResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {displayedResults.map((check) => (
                  <CheckRow key={check.checkId} check={check} />
                ))}
              </div>
            ) : scanResults && scanResults.length > 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                No checks match this filter.
              </div>
            ) : null}

            {/* Initial scan prompt */}
            {connected && !scanning && !scanResults && (
              <div style={{
                textAlign: 'center', padding: '28px 0',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
                <ShieldCheck size={28} color="rgba(139,92,246,0.4)" />
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                  Click "Run Scan Now" to check your {meta.name} security posture
                </p>
                {data?.integration?.lastSyncAt && (
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>
                    Last scan: {new Date(data.integration.lastSyncAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {scanning && (
              <div style={{
                textAlign: 'center', padding: '28px 0',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              }}>
                <Loader2 size={28} color="#8B5CF6" className="animate-spin" />
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                  Running security checks against {meta.name}…
                </p>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>
                  This may take 30–60 seconds depending on resource count.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
