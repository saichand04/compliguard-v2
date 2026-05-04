'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CloudLightning, RefreshCw, Loader2, CheckCircle, XCircle,
  AlertTriangle, BarChart3, Bot, Clock, Calendar, Download,
  Settings, ShieldAlert,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SourceStats {
  checked: number
  passed: number
  failed: number
}

interface CMStats {
  score: number
  maxScore: number
}

interface ScanSummary {
  status: string
  scanId?: string
  totalFindings: number
  criticalFindings: number
  sources: string[]
  aiSummary?: string
}

interface ScanStatus {
  status: string
  lastScanAt?: string
  totalFindings?: number
  criticalFindings?: number
  sources?: string[]
  aiSummary?: string
}

interface HistoryEntry {
  id: string
  scannedAt: string
  status: string
  totalFindings: number
  criticalFindings: number
  sources: string[]
  scanId?: string
}

interface LastScan {
  id: string
  scannedAt: string
  summary: ScanSummary | null
  rawResults: {
    sources?: {
      entra?: SourceStats
      intune?: SourceStats
      defender?: SourceStats
      sentinel?: SourceStats
      purview?: SourceStats
      complianceManager?: CMStats
    }
    aiRemediationSummary?: string
    totalFindings?: number
    criticalFindings?: number
  } | null
}

interface ConfigState {
  configured: boolean
  running: boolean
  lastScan: LastScan | null
}

// ─── Source Bar Chart ─────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  entra: '#8B5CF6',
  intune: '#06B6D4',
  defender: '#f59e0b',
  sentinel: '#ef4444',
  purview: '#10b981',
}

const SOURCE_LABELS: Record<string, string> = {
  entra: 'Entra ID',
  intune: 'Intune',
  defender: 'Defender',
  sentinel: 'Sentinel',
  purview: 'Purview',
}

function SourcesChart({ sources }: { sources: Record<string, SourceStats | CMStats> }) {
  const checkSources = Object.entries(sources)
    .filter(([, v]) => 'checked' in v)
    .map(([key, v]) => ({ key, ...(v as SourceStats) }))

  if (checkSources.length === 0) {
    return <div className="text-sm text-slate-500">No source data available</div>
  }

  const maxFailed = Math.max(...checkSources.map(s => s.failed), 1)

  return (
    <div className="space-y-3">
      {checkSources.map(source => {
        const color = SOURCE_COLORS[source.key] ?? '#6b7280'
        const label = SOURCE_LABELS[source.key] ?? source.key
        const pct = Math.round((source.failed / maxFailed) * 100)
        return (
          <div key={source.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">{label}</span>
              <span className="text-slate-500">
                {source.passed} passed · <span style={{ color }} className="font-medium">{source.failed} failed</span>
                {' '}/ {source.checked} total
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              {source.checked > 0 && (
                <div
                  className="flex h-full rounded-full overflow-hidden"
                >
                  <div
                    style={{
                      width: `${Math.round((source.passed / source.checked) * 100)}%`,
                      backgroundColor: '#10b981',
                    }}
                  />
                  <div
                    style={{
                      width: `${Math.round((source.failed / source.checked) * 100)}%`,
                      backgroundColor: color,
                      opacity: 0.9,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Schedule Modal ───────────────────────────────────────────────────────────

function ScheduleModal({ onClose }: { onClose: () => void }) {
  const [preset, setPreset] = useState<string>('')
  const [cron, setCron] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const body = preset ? { preset } : cron ? { cron } : { cron: null }
      await fetch('/api/integrations/azure-scan/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setSaved(true)
      setTimeout(onClose, 1200)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1021] p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-white">Schedule Automatic Scans</h2>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-slate-300">Preset</label>
          <div className="grid grid-cols-2 gap-2">
            {['hourly', 'daily', 'weekly', 'monthly'].map(p => (
              <button
                key={p}
                onClick={() => { setPreset(p); setCron('') }}
                className={`rounded-lg border px-3 py-2 text-sm capitalize transition-all ${
                  preset === p
                    ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                    : 'border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-1 block text-sm text-slate-300">Custom Cron Expression</label>
          <input
            type="text"
            value={cron}
            onChange={e => { setCron(e.target.value); setPreset('') }}
            placeholder="0 2 * * *"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-mono text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">Format: minute hour day month weekday</p>
        </div>

        {saved && <p className="mb-3 text-sm text-emerald-400">Schedule saved!</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-slate-300 hover:bg-white/5">Cancel</button>
          <button
            onClick={() => void save()}
            disabled={saving || (!preset && !cron)}
            className="flex-1 rounded-lg bg-violet-600 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AzureScanPage() {
  const [configData, setConfigData] = useState<ConfigState | null>(null)
  const [status, setStatus] = useState<ScanStatus | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [scanning, setScanning] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = useCallback(async () => {
    const [configRes, historyRes] = await Promise.all([
      fetch('/api/integrations/azure-scan'),
      fetch('/api/integrations/azure-scan/history'),
    ])
    if (configRes.ok) {
      const data = await configRes.json() as ConfigState
      setConfigData(data)
    }
    if (historyRes.ok) {
      const data = await historyRes.json() as { history: HistoryEntry[] }
      setHistory(data.history)
    }
  }, [])

  const pollStatus = useCallback(async () => {
    const res = await fetch('/api/integrations/azure-scan/status')
    if (res.ok) {
      const data = await res.json() as ScanStatus
      setStatus(data)
      if (data.status === 'completed' || data.status === 'failed') {
        setScanning(false)
        if (pollingRef.current) clearInterval(pollingRef.current)
        await loadData()
      }
    }
  }, [loadData])

  useEffect(() => { void loadData() }, [loadData])

  const triggerScan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/integrations/azure-scan', { method: 'POST' })
      if (res.ok || res.status === 202) {
        // Start polling
        pollingRef.current = setInterval(() => { void pollStatus() }, 3000)
      } else {
        const err = await res.json() as { error?: string }
        console.error(err.error)
        setScanning(false)
      }
    } catch {
      setScanning(false)
    }
  }

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const lastScan = configData?.lastScan
  const sources = lastScan?.rawResults?.sources ?? {}
  const aiSummary = lastScan?.rawResults?.aiRemediationSummary
  const totalFindings = lastScan?.rawResults?.totalFindings ?? lastScan?.summary?.totalFindings ?? 0
  const criticalFindings = lastScan?.rawResults?.criticalFindings ?? lastScan?.summary?.criticalFindings ?? 0

  const exportReport = () => {
    if (!lastScan) return
    const data = JSON.stringify(lastScan.rawResults, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `azure-compliance-scan-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#080B18] p-6 text-white">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600/20">
              <CloudLightning className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Azure Compliance Scan</h1>
              <p className="text-sm text-slate-400">Unified Microsoft 365 &amp; Azure security assessment</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSchedule(true)}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
            >
              <Calendar className="h-4 w-4" />
              Schedule
            </button>
            {lastScan && (
              <button
                onClick={exportReport}
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            )}
            <button
              onClick={() => void triggerScan()}
              disabled={scanning || !configData?.configured}
              className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {scanning ? 'Scanning…' : 'Run Full Scan'}
            </button>
          </div>
        </div>

        {/* Not configured */}
        {!configData?.configured && (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
            <Settings className="mx-auto mb-3 h-10 w-10 text-slate-500" />
            <h3 className="mb-2 font-medium text-slate-200">Azure Integration Required</h3>
            <p className="mb-4 text-sm text-slate-400">
              Configure your Azure integration credentials to enable compliance scanning across all Microsoft services.
            </p>
            <a href="/integrations" className="rounded-lg bg-cyan-600 px-5 py-2 text-sm text-white hover:bg-cyan-500">
              Go to Integrations
            </a>
          </div>
        )}

        {/* Scanning progress */}
        {scanning && (
          <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6">
            <div className="mb-3 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              <span className="font-medium text-cyan-300">Scanning in progress…</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full animate-pulse rounded-full bg-cyan-500" style={{ width: '60%' }} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Running checks across Entra ID, Defender, Purview, and Compliance Manager
            </p>
          </div>
        )}

        {/* Summary stats */}
        {lastScan && (
          <div className="mb-6 grid grid-cols-4 gap-4">
            {[
              {
                label: 'Total Findings',
                value: totalFindings,
                color: 'text-white',
                icon: BarChart3,
              },
              {
                label: 'Critical',
                value: criticalFindings,
                color: 'text-red-400',
                icon: ShieldAlert,
              },
              {
                label: 'Sources Scanned',
                value: Object.keys(sources).length,
                color: 'text-cyan-400',
                icon: CloudLightning,
              },
              {
                label: 'Last Scan',
                value: lastScan.scannedAt
                  ? new Date(lastScan.scannedAt).toLocaleDateString()
                  : '—',
                color: 'text-slate-300',
                icon: Clock,
              },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{s.label}</span>
                  <s.icon className="h-4 w-4 text-slate-600" />
                </div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Two-column layout */}
        {lastScan && (
          <div className="mb-6 grid grid-cols-2 gap-4">
            {/* Findings by source */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <BarChart3 className="h-4 w-4 text-cyan-400" />
                Findings by Source
              </h3>
              <SourcesChart sources={sources as Record<string, SourceStats | CMStats>} />
            </div>

            {/* AI Remediation Summary */}
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Bot className="h-4 w-4 text-violet-400" />
                AI Remediation Summary
              </h3>
              {aiSummary ? (
                <div className="space-y-2">
                  {aiSummary.split('\n').filter(Boolean).map((line, i) => (
                    <p key={i} className="text-sm text-slate-300 leading-relaxed">{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No AI summary available for this scan.</p>
              )}
            </div>
          </div>
        )}

        {/* Scan History */}
        {history.length > 0 && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Clock className="h-4 w-4 text-slate-400" />
                Scan History
              </h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Findings</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Critical</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Sources</th>
                </tr>
              </thead>
              <tbody>
                {history.map(entry => (
                  <tr key={entry.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {new Date(entry.scannedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex w-fit items-center gap-1 rounded px-2 py-0.5 text-xs ${
                        entry.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : entry.status === 'failed'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {entry.status === 'completed' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{entry.totalFindings}</td>
                    <td className="px-4 py-3">
                      {entry.criticalFindings > 0 ? (
                        <span className="flex items-center gap-1 text-sm text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          {entry.criticalFindings}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{entry.sources.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {configData?.configured && !lastScan && !scanning && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center">
            <CloudLightning className="mx-auto mb-3 h-10 w-10 text-slate-500" />
            <h3 className="mb-2 font-medium text-slate-200">No Scans Yet</h3>
            <p className="mb-4 text-sm text-slate-400">
              Run your first Azure compliance scan to assess security across all connected Microsoft services.
            </p>
            <button onClick={() => void triggerScan()} className="rounded-lg bg-cyan-600 px-5 py-2 text-sm text-white hover:bg-cyan-500">
              Run First Scan
            </button>
          </div>
        )}
      </div>

      {showSchedule && <ScheduleModal onClose={() => setShowSchedule(false)} />}
    </div>
  )
}
