'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Shield, ShieldCheck, AlertTriangle, Info, RefreshCw,
  CheckCircle, XCircle, AlertCircle, FileSearch, BookOpen,
  Database, ClipboardList, ChevronRight, Settings, Loader2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurviewCheckResult {
  category: 'dlp' | 'information_protection' | 'data_catalog' | 'audit'
  checkId: string
  title: string
  status: 'pass' | 'fail' | 'warn' | 'info'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  count?: number
  items?: Array<{ id: string; name: string; severity?: string; description: string }>
  recommendation: string
  nistControls: string[]
}

interface ScanResponse {
  success: boolean
  totalChecks: number
  passed: number
  failed: number
  results: PurviewCheckResult[]
}

interface ConfigState {
  configured: boolean
  status?: string
  lastSyncAt?: string
  tenantId?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_ICON = {
  pass: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  fail: <XCircle className="w-4 h-4 text-red-400" />,
  warn: <AlertCircle className="w-4 h-4 text-amber-400" />,
  info: <Info className="w-4 h-4 text-cyan-400" />,
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  low: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  info: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
}

const CATEGORY_TABS = [
  { id: 'all', label: 'All', icon: Shield },
  { id: 'dlp', label: 'DLP Policies', icon: ShieldCheck },
  { id: 'information_protection', label: 'Sensitivity Labels', icon: BookOpen },
  { id: 'data_catalog', label: 'Sensitive Data', icon: Database },
  { id: 'audit', label: 'Audit', icon: ClipboardList },
]

// ─── Configure Modal ──────────────────────────────────────────────────────────

function ConfigureModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ tenantId: '', clientId: '', clientSecret: '' })
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/integrations/purview/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json() as { success: boolean; message?: string; error?: string }
      setTestResult(data)
    } finally {
      setTesting(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/integrations/purview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1021] p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-white">Configure Microsoft Purview</h2>
        <p className="mb-5 text-sm text-slate-400">
          Purview uses your Azure App Registration credentials. Required scopes:
          <span className="ml-1 font-mono text-violet-400">InformationProtectionPolicy.Read.All</span>,{' '}
          <span className="font-mono text-violet-400">DLP.Distribution.Read</span>
        </p>

        {(['tenantId', 'clientId', 'clientSecret'] as const).map(field => (
          <div key={field} className="mb-4">
            <label className="mb-1 block text-sm text-slate-300 capitalize">
              {field.replace(/([A-Z])/g, ' $1').trim()}
            </label>
            <input
              type={field === 'clientSecret' ? 'password' : 'text'}
              value={form[field]}
              onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              placeholder={field === 'tenantId' ? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' : ''}
            />
          </div>
        ))}

        {testResult && (
          <div className={`mb-4 rounded-lg p-3 text-sm ${testResult.success ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
            {testResult.success ? testResult.message : testResult.error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-slate-300 hover:bg-white/5">
            Cancel
          </button>
          <button onClick={test} disabled={testing} className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50">
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <button onClick={save} disabled={saving || !form.tenantId} className="flex-1 rounded-lg bg-violet-600 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save & Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Check Row ────────────────────────────────────────────────────────────────

function CheckRow({ check }: { check: PurviewCheckResult }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] transition-all">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {STATUS_ICON[check.status]}
        <span className="flex-1 text-sm text-slate-200">{check.title}</span>
        {check.count !== undefined && (
          <span className="text-xs text-slate-500">Count: {check.count}</span>
        )}
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[check.severity]}`}>
          {check.severity}
        </span>
        <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3">
          <p className="mb-2 text-sm text-slate-400">{check.recommendation}</p>
          {check.nistControls.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {check.nistControls.map(c => (
                <span key={c} className="rounded bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">
                  NIST {c}
                </span>
              ))}
            </div>
          )}
          {check.items && check.items.length > 0 && (
            <div className="mt-3 space-y-1">
              {check.items.map(item => (
                <div key={item.id} className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">
                  <span className="font-medium text-white">{item.name}</span>
                  {item.description && <span className="ml-2 text-slate-500">— {item.description}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PurviewPage() {
  const [config, setConfig] = useState<ConfigState | null>(null)
  const [scanData, setScanData] = useState<ScanResponse | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [scanning, setScanning] = useState(false)
  const [showConfigure, setShowConfigure] = useState(false)

  const loadConfig = useCallback(async () => {
    const res = await fetch('/api/integrations/purview')
    if (res.ok) {
      const data = await res.json() as ConfigState
      setConfig(data)
    }
  }, [])

  useEffect(() => { void loadConfig() }, [loadConfig])

  const runScan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/integrations/purview/scan', { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as ScanResponse
        setScanData(data)
        await loadConfig()
      }
    } finally {
      setScanning(false)
    }
  }

  const filtered = scanData?.results.filter(r =>
    activeTab === 'all' ? true : r.category === activeTab
  ) ?? []

  const passCount = scanData?.results.filter(r => r.status === 'pass').length ?? 0
  const failCount = scanData?.results.filter(r => r.status === 'fail').length ?? 0
  const warnCount = scanData?.results.filter(r => r.status === 'warn').length ?? 0

  return (
    <div className="min-h-screen bg-[#080B18] p-6 text-white">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20">
              <Shield className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Microsoft Purview</h1>
              <p className="text-sm text-slate-400">DLP policies, sensitivity labels, and audit compliance</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfigure(true)}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
            >
              <Settings className="h-4 w-4" />
              Configure
            </button>
            <button
              onClick={runScan}
              disabled={scanning || !config?.configured}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {scanning ? 'Scanning…' : 'Run Scan'}
            </button>
          </div>
        </div>

        {/* Not configured state */}
        {!config?.configured && (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
            <FileSearch className="mx-auto mb-3 h-10 w-10 text-slate-500" />
            <h3 className="mb-2 font-medium text-slate-200">Purview Not Connected</h3>
            <p className="mb-4 text-sm text-slate-400">
              Connect your Microsoft Azure tenant to start scanning DLP policies, sensitivity labels, and audit settings.
            </p>
            <button
              onClick={() => setShowConfigure(true)}
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm text-white hover:bg-violet-500"
            >
              Connect Purview
            </button>
          </div>
        )}

        {/* Stats */}
        {scanData && (
          <div className="mb-6 grid grid-cols-4 gap-4">
            {[
              { label: 'Total Checks', value: scanData.totalChecks, color: 'text-white' },
              { label: 'Passed', value: passCount, color: 'text-emerald-400' },
              { label: 'Failed', value: failCount, color: 'text-red-400' },
              { label: 'Warnings', value: warnCount, color: 'text-amber-400' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Last sync */}
        {config?.configured && config.lastSyncAt && (
          <p className="mb-4 text-xs text-slate-500">
            Last scan: {new Date(config.lastSyncAt).toLocaleString()}
          </p>
        )}

        {/* Tabs */}
        {scanData && (
          <>
            <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-white/5 bg-white/[0.02] p-1">
              {CATEGORY_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-all ${
                    activeTab === tab.id
                      ? 'bg-violet-600/30 text-violet-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                  <span className="ml-0.5 text-xs text-slate-500">
                    ({(tab.id === 'all' ? scanData.results : scanData.results.filter(r => r.category === tab.id)).length})
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filtered.map(check => (
                <CheckRow key={check.checkId} check={check} />
              ))}
              {filtered.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-500">No checks in this category</div>
              )}
            </div>
          </>
        )}

        {/* Empty state after configure */}
        {config?.configured && !scanData && !scanning && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-slate-500" />
            <h3 className="mb-2 font-medium text-slate-200">Ready to Scan</h3>
            <p className="mb-4 text-sm text-slate-400">
              Purview is connected. Run a scan to check DLP policies, sensitivity labels, and audit configuration.
            </p>
            <button onClick={runScan} className="rounded-lg bg-violet-600 px-5 py-2 text-sm text-white hover:bg-violet-500">
              Run First Scan
            </button>
          </div>
        )}
      </div>

      {showConfigure && (
        <ConfigureModal
          onClose={() => setShowConfigure(false)}
          onSaved={loadConfig}
        />
      )}
    </div>
  )
}
