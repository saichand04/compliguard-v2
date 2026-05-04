'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Cloud, Shield, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Trash2, Save, Eye, EyeOff, Zap,
  Server, Database, Lock, Network, Monitor, Key,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AzureIntegration {
  id: string
  name: string
  status: string
  lastSyncAt: string | null
  errorMessage: string | null
  createdAt: string
  credentials: {
    tenantId?: string
    clientId?: string
    subscriptionId?: string
  }
}

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
  passed: number
  failed: number
  warned: number
  skipped: number
  total: number
}

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  aks:           { label: 'AKS (Kubernetes)',     icon: Server },
  appservice:    { label: 'App Service',           icon: Cloud },
  entraid:       { label: 'Entra ID',              icon: Shield },
  keyvault:      { label: 'Key Vault',             icon: Key },
  sql:           { label: 'SQL Database',          icon: Database },
  storage:       { label: 'Storage Accounts',      icon: Database },
  vm:            { label: 'Virtual Machines',      icon: Monitor },
  network:       { label: 'Network',               icon: Network },
  securitycenter:{ label: 'Security Center',       icon: Shield },
}

function getCategory(checkId: string): string {
  const parts = checkId.split('.')
  return parts[1] ?? 'other'
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_META = {
  pass: { label: 'Pass', color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: CheckCircle2 },
  fail: { label: 'Fail', color: '#EF4444', bg: 'rgba(239,68,68,0.1)',  icon: XCircle },
  warn: { label: 'Warn', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: AlertTriangle },
  skip: { label: 'Skip', color: '#6B7280', bg: 'rgba(107,114,128,0.1)', icon: AlertTriangle },
}

const SEVERITY_META = {
  critical: { label: 'Critical', color: '#EF4444' },
  high:     { label: 'High',     color: '#F97316' },
  medium:   { label: 'Medium',   color: '#EAB308' },
  low:      { label: 'Low',      color: '#3B82F6' },
  info:     { label: 'Info',     color: '#6B7280' },
}

// ── Components ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CheckResult['status'] }) {
  const meta = STATUS_META[status] ?? STATUS_META.skip
  const Icon = meta.icon
  return (
    <span
      style={{ color: meta.color, background: meta.bg }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
    >
      <Icon size={11} />
      {meta.label}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: CheckResult['severity'] }) {
  const meta = SEVERITY_META[severity] ?? SEVERITY_META.info
  return (
    <span
      style={{ color: meta.color, border: `1px solid ${meta.color}33` }}
      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
    >
      {meta.label}
    </span>
  )
}

function CategorySection({ category, checks }: { category: string; checks: CheckResult[] }) {
  const catMeta = CATEGORIES[category]
  const Icon = catMeta?.icon ?? Shield
  const label = catMeta?.label ?? category.toUpperCase()

  const passed = checks.filter((c) => c.status === 'pass').length
  const failed = checks.filter((c) => c.status === 'fail').length
  const warned = checks.filter((c) => c.status === 'warn').length

  return (
    <div
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      className="rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-violet-400" />
          <span className="font-medium text-white text-sm">{label}</span>
          <span className="text-xs text-slate-500">({checks.length} checks)</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {passed > 0 && <span className="text-emerald-400">{passed} pass</span>}
          {warned > 0 && <span className="text-amber-400">{warned} warn</span>}
          {failed > 0 && <span className="text-red-400">{failed} fail</span>}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5">
        {checks.map((check) => (
          <div key={check.checkId} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <StatusBadge status={check.status} />
                  <SeverityBadge severity={check.severity} />
                  <span className="text-sm text-white font-medium">{check.title}</span>
                </div>
                <p className="text-xs text-slate-400 mb-1">{check.description}</p>
                {check.resource && (
                  <p className="text-xs text-slate-500">
                    Resource: <code className="text-cyan-400">{check.resource}</code>
                  </p>
                )}
                {check.remediation && (check.status === 'fail' || check.status === 'warn') && (
                  <p className="text-xs text-amber-400/80 mt-1">
                    Fix: {check.remediation}
                  </p>
                )}
              </div>
              <code className="text-xs text-slate-600 whitespace-nowrap shrink-0">{check.checkId}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AzureIntegrationPage() {
  const [integration, setIntegration] = useState<AzureIntegration | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [testing, setTesting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [results, setResults] = useState<CheckResult[] | null>(null)
  const [summary, setSummary] = useState<ScanSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)
  const [showSecret, setShowSecret] = useState(false)

  // Form state
  const [tenantId, setTenantId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [subscriptionId, setSubscriptionId] = useState('')
  const [friendlyName, setFriendlyName] = useState('Azure')

  const fetchIntegration = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/integrations/azure')
      const data = await res.json() as { integration: AzureIntegration | null }
      if (data.integration) {
        setIntegration(data.integration)
        setTenantId(data.integration.credentials.tenantId ?? '')
        setClientId(data.integration.credentials.clientId ?? '')
        setSubscriptionId(data.integration.credentials.subscriptionId ?? '')
        setFriendlyName(data.integration.name ?? 'Azure')
      }
    } catch {
      setError('Failed to load Azure integration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchIntegration()
  }, [fetchIntegration])

  const handleSave = async () => {
    if (!tenantId || !clientId || !clientSecret || !subscriptionId) {
      setError('All fields are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/integrations/azure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, clientId, clientSecret, subscriptionId, name: friendlyName }),
      })
      const data = await res.json() as { success: boolean; error?: string }
      if (!data.success) throw new Error(data.error ?? 'Save failed')
      await fetchIntegration()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const body = clientSecret
        ? { tenantId, clientId, clientSecret, subscriptionId }
        : {}
      const res = await fetch('/api/integrations/azure/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { success: boolean; message?: string; error?: string }
      setTestResult(data)
    } catch (e) {
      setTestResult({ success: false, error: String(e) })
    } finally {
      setTesting(false)
    }
  }

  const handleScan = async () => {
    setScanning(true)
    setError(null)
    try {
      const res = await fetch('/api/integrations/azure/scan', { method: 'POST' })
      const data = await res.json() as {
        success: boolean
        results?: CheckResult[]
        summary?: ScanSummary
        error?: string
      }
      if (!data.success) throw new Error(data.error ?? 'Scan failed')
      setResults(data.results ?? null)
      setSummary(data.summary ?? null)
    } catch (e) {
      setError(String(e))
    } finally {
      setScanning(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Remove Azure integration? This will delete all credentials.')) return
    setDeleting(true)
    try {
      await fetch('/api/integrations/azure', { method: 'DELETE' })
      setIntegration(null)
      setResults(null)
      setSummary(null)
      setTenantId('')
      setClientId('')
      setClientSecret('')
      setSubscriptionId('')
    } catch (e) {
      setError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  // Group results by category
  const groupedResults = results
    ? results.reduce<Record<string, CheckResult[]>>((acc, r) => {
        const cat = getCategory(r.checkId)
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(r)
        return acc
      }, {})
    : null

  const categoryOrder = ['aks', 'appservice', 'entraid', 'keyvault', 'sql', 'storage', 'vm', 'network', 'securitycenter']

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw size={24} className="animate-spin text-violet-400" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
          >
            <Cloud size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Azure Integration</h1>
            <p className="text-sm text-slate-400">Configure and run compliance checks on your Azure subscription</p>
          </div>
        </div>
        {integration && (
          <div className="flex items-center gap-2">
            <span
              style={{
                background: integration.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)',
                color: integration.status === 'active' ? '#10B981' : '#6B7280',
                border: `1px solid ${integration.status === 'active' ? 'rgba(16,185,129,0.3)' : 'rgba(107,114,128,0.3)'}`,
              }}
              className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: integration.status === 'active' ? '#10B981' : '#6B7280' }}
              />
              {integration.status}
            </span>
          </div>
        )}
      </div>

      {/* Config card */}
      <div
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}
        className="rounded-xl p-6"
      >
        <h2 className="text-sm font-semibold text-white mb-4">Configuration</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Friendly Name</label>
            <input
              type="text"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="Azure Production"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Tenant ID</label>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Client ID (App Registration)</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Client Secret</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={integration ? '••••••••••••••••' : 'Enter client secret'}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-400 mb-1.5">Subscription ID</label>
            <input
              type="text"
              value={subscriptionId}
              onChange={(e) => setSubscriptionId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {testResult && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm flex items-start gap-2 ${
              testResult.success
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            {testResult.success ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <XCircle size={16} className="shrink-0 mt-0.5" />}
            {testResult.success ? testResult.message : testResult.error}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
          <button
            onClick={() => void handleTest()}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Zap size={14} />
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          {integration && (
            <>
              <button
                onClick={() => void handleScan()}
                disabled={scanning}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
              >
                <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
                {scanning ? 'Scanning…' : 'Run Scan'}
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="ml-auto flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 disabled:opacity-50 rounded-lg text-sm font-medium text-red-400 transition-colors"
              >
                <Trash2 size={14} />
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </>
          )}
        </div>

        {integration?.lastSyncAt && (
          <p className="mt-3 text-xs text-slate-500">
            Last scan: {new Date(integration.lastSyncAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total',   value: summary.total,   color: '#8B5CF6' },
            { label: 'Passed',  value: summary.passed,  color: '#10B981' },
            { label: 'Failed',  value: summary.failed,  color: '#EF4444' },
            { label: 'Warned',  value: summary.warned,  color: '#F59E0B' },
            { label: 'Skipped', value: summary.skipped, color: '#6B7280' },
          ].map((s) => (
            <div
              key={s.label}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              className="rounded-xl p-4 text-center"
            >
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Results grouped by category */}
      {groupedResults && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white">Scan Results</h2>
          {categoryOrder
            .filter((cat) => groupedResults[cat])
            .map((cat) => (
              <CategorySection key={cat} category={cat} checks={groupedResults[cat]!} />
            ))}
          {/* Any uncategorized */}
          {Object.entries(groupedResults)
            .filter(([cat]) => !categoryOrder.includes(cat))
            .map(([cat, checks]) => (
              <CategorySection key={cat} category={cat} checks={checks} />
            ))}
        </div>
      )}
    </div>
  )
}
