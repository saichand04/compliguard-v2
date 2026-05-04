'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Target, RefreshCw, CheckCircle, Clock, AlertCircle,
  ArrowUpRight, Loader2, Settings, BarChart3, Info,
  ChevronRight, Zap,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Framework {
  id: string
  name: string
  score: number
  maxScore: number
  certificationStatus: string
}

interface ImprovementAction {
  id: string
  title: string
  description: string
  score: number
  category: string
  status: 'None' | 'NotInScope' | 'Completed' | 'InProgress' | 'PartiallyTested' | 'Risk Accepted'
  testDate?: string
  implementationGuide?: string
  nistMappings?: string[]
}

interface SyncResult {
  success: boolean
  currentScore: number
  maxScore: number
  percentageScore: number
  frameworkCount: number
  improvementActionsCount: number
  tasksCreated: number
  syncedAt: string
  error?: string
}

interface ConfigState {
  configured: boolean
  lastSyncAt?: string
  tenantId?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  Completed: { label: 'Completed', classes: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30', icon: CheckCircle },
  InProgress: { label: 'In Progress', classes: 'bg-blue-500/20 text-blue-300 border border-blue-500/30', icon: Clock },
  PartiallyTested: { label: 'Partial', classes: 'bg-amber-500/20 text-amber-300 border border-amber-500/30', icon: AlertCircle },
  None: { label: 'Not Started', classes: 'bg-slate-500/20 text-slate-300 border border-slate-500/30', icon: Info },
  NotInScope: { label: 'Not In Scope', classes: 'bg-slate-500/20 text-slate-400 border border-slate-500/30', icon: Info },
  'Risk Accepted': { label: 'Risk Accepted', classes: 'bg-orange-500/20 text-orange-300 border border-orange-500/30', icon: AlertCircle },
}

// ─── Radial Score Gauge ───────────────────────────────────────────────────────

function ScoreGauge({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  const r = 54
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference - (pct / 100) * circumference
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="-mt-24 text-center">
        <div className="text-4xl font-bold" style={{ color }}>{pct}</div>
        <div className="text-xs text-slate-500">/ 100</div>
        <div className="mt-1 text-xs text-slate-400">
          {score} / {max} pts
        </div>
      </div>
    </div>
  )
}

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
      const res = await fetch('/api/integrations/compliance-manager/test', {
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
      await fetch('/api/integrations/compliance-manager', {
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
        <h2 className="mb-2 text-lg font-semibold text-white">Configure Compliance Manager</h2>
        <p className="mb-5 text-sm text-slate-400">
          Requires scope: <span className="font-mono text-violet-400">ComplianceManager.Read.All</span>
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
            {testing ? 'Testing…' : 'Test'}
          </button>
          <button onClick={save} disabled={saving || !form.tenantId} className="flex-1 rounded-lg bg-violet-600 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save & Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ComplianceManagerPage() {
  const [config, setConfig] = useState<ConfigState | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [actions, setActions] = useState<ImprovementAction[]>([])
  const [syncing, setSyncing] = useState(false)
  const [showConfigure, setShowConfigure] = useState(false)
  const [creatingTask, setCreatingTask] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'frameworks' | 'actions'>('frameworks')

  const loadConfig = useCallback(async () => {
    const res = await fetch('/api/integrations/compliance-manager')
    if (res.ok) {
      const data = await res.json() as ConfigState
      setConfig(data)
    }
  }, [])

  useEffect(() => { void loadConfig() }, [loadConfig])

  const runSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/integrations/compliance-manager/sync', { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as SyncResult
        setSyncResult(data)
        await loadConfig()
      } else {
        const err = await res.json() as { error?: string }
        setSyncResult({ success: false, error: err.error ?? 'Sync failed' } as SyncResult)
      }
    } finally {
      setSyncing(false)
    }
  }

  const createTask = async (action: ImprovementAction) => {
    setCreatingTask(action.id)
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: action.title,
          description: action.description + `\n\nPoints: ${action.score}`,
          priority: action.score >= 5 ? 'urgent' : action.score >= 3 ? 'high' : 'medium',
          metadata: { source: 'compliance_manager', actionId: action.id },
        }),
      })
    } finally {
      setCreatingTask(null)
    }
  }

  const pct = syncResult
    ? Math.round((syncResult.currentScore / (syncResult.maxScore || 100)) * 100)
    : 0

  return (
    <div className="min-h-screen bg-[#080B18] p-6 text-white">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20">
              <Target className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Compliance Manager</h1>
              <p className="text-sm text-slate-400">Microsoft compliance scores and improvement actions</p>
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
              onClick={runSync}
              disabled={syncing || !config?.configured}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Syncing…' : 'Sync All'}
            </button>
          </div>
        </div>

        {/* Not configured */}
        {!config?.configured && (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
            <Target className="mx-auto mb-3 h-10 w-10 text-slate-500" />
            <h3 className="mb-2 font-medium text-slate-200">Compliance Manager Not Connected</h3>
            <p className="mb-4 text-sm text-slate-400">
              Connect your Microsoft Azure tenant to sync compliance scores and improvement actions.
            </p>
            <button onClick={() => setShowConfigure(true)} className="rounded-lg bg-violet-600 px-5 py-2 text-sm text-white hover:bg-violet-500">
              Connect Now
            </button>
          </div>
        )}

        {/* Sync error */}
        {syncResult && !syncResult.success && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {syncResult.error}
          </div>
        )}

        {/* Score overview */}
        {syncResult?.success && (
          <>
            <div className="mb-6 grid grid-cols-3 gap-4">
              {/* Gauge */}
              <div className="col-span-1 flex items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                <ScoreGauge score={syncResult.currentScore} max={syncResult.maxScore} />
              </div>

              {/* Summary stats */}
              <div className="col-span-2 grid grid-cols-2 gap-4">
                {[
                  { label: 'Compliance Score', value: `${pct}%`, sub: `${syncResult.currentScore} / ${syncResult.maxScore} points` },
                  { label: 'Frameworks', value: syncResult.frameworkCount, sub: 'assessed' },
                  { label: 'Improvement Actions', value: syncResult.improvementActionsCount, sub: 'total' },
                  { label: 'Tasks Created', value: syncResult.tasksCreated, sub: 'from this sync' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                    <div className="text-2xl font-bold text-white">{s.value}</div>
                    <div className="text-sm font-medium text-slate-300">{s.label}</div>
                    <div className="text-xs text-slate-500">{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Last sync */}
            <p className="mb-4 text-xs text-slate-500">
              Last synced: {new Date(syncResult.syncedAt).toLocaleString()}
            </p>
          </>
        )}

        {/* Tabs */}
        {syncResult?.success && (
          <>
            <div className="mb-4 flex gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1 w-fit">
              {[
                { id: 'frameworks', label: 'Frameworks', icon: BarChart3 },
                { id: 'actions', label: 'Improvement Actions', icon: Zap },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'frameworks' | 'actions')}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm transition-all ${
                    activeTab === tab.id ? 'bg-violet-600/30 text-violet-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Frameworks table */}
            {activeTab === 'frameworks' && (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Framework</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Progress</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Certification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {frameworks.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-sm text-slate-500">
                          No framework data. Run a sync to load data.
                        </td>
                      </tr>
                    ) : (
                      frameworks.map(f => {
                        const fpct = f.maxScore > 0 ? Math.round((f.score / f.maxScore) * 100) : 0
                        return (
                          <tr key={f.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-sm font-medium text-white">{f.name}</td>
                            <td className="px-4 py-3 text-sm text-slate-300">{f.score} / {f.maxScore}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${fpct}%`,
                                      backgroundColor: fpct >= 70 ? '#10b981' : fpct >= 40 ? '#f59e0b' : '#ef4444',
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-slate-400">{fpct}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">{f.certificationStatus}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Improvement actions */}
            {activeTab === 'actions' && (
              <div className="space-y-2">
                {actions.length === 0 ? (
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] py-12 text-center text-sm text-slate-500">
                    No improvement actions loaded. Run a sync to fetch data.
                  </div>
                ) : (
                  actions.map(action => {
                    const statusConfig = STATUS_CONFIG[action.status] ?? STATUS_CONFIG.None
                    const StatusIcon = statusConfig.icon
                    return (
                      <div key={action.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs ${statusConfig.classes}`}>
                                <StatusIcon className="h-3 w-3" />
                                {statusConfig.label}
                              </span>
                              <span className="text-xs text-slate-500">{action.category}</span>
                            </div>
                            <p className="text-sm font-medium text-white">{action.title}</p>
                            {action.description && (
                              <p className="mt-1 text-xs text-slate-400 line-clamp-2">{action.description}</p>
                            )}
                            {action.nistMappings && action.nistMappings.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {action.nistMappings.slice(0, 4).map(n => (
                                  <span key={n} className="rounded bg-violet-500/10 px-1.5 py-0.5 text-xs text-violet-400">
                                    NIST {n}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="text-sm font-bold text-cyan-400">{action.score} pts</span>
                            <button
                              onClick={() => void createTask(action)}
                              disabled={creatingTask === action.id}
                              className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
                            >
                              {creatingTask === action.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpRight className="h-3 w-3" />}
                              Create Task
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {config?.configured && !syncResult && !syncing && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center">
            <Target className="mx-auto mb-3 h-10 w-10 text-slate-500" />
            <h3 className="mb-2 font-medium text-slate-200">Ready to Sync</h3>
            <p className="mb-4 text-sm text-slate-400">
              Click &quot;Sync All&quot; to fetch your compliance score, framework status, and improvement actions.
            </p>
            <button onClick={runSync} className="rounded-lg bg-violet-600 px-5 py-2 text-sm text-white hover:bg-violet-500">
              Sync Now
            </button>
          </div>
        )}
      </div>

      {showConfigure && (
        <ConfigureModal onClose={() => setShowConfigure(false)} onSaved={loadConfig} />
      )}
    </div>
  )
}
