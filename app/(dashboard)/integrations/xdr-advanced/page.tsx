'use client'

/**
 * app/(dashboard)/integrations/xdr-advanced/page.tsx
 * XDR Advanced page — real-time incidents, MITRE coverage heatmap,
 * threat intelligence panel, enriched audit trail.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Shield, Activity, RefreshCw, AlertTriangle, Zap,
  Globe, Hash, Mail, Link2, ArrowLeft, ChevronRight,
  Server, Eye, CheckCircle, Clock, Database,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MitreTacticCoverage {
  [tactic: string]: number
}

interface TiSummary {
  total: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
  sources: string[]
}

interface EnrichedFinding {
  id: string
  title: string
  severity: string
  status: string
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown> | null
}

interface AuditEntry {
  id: string
  action: string
  resourceTitle: string | null
  description: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

interface PageData {
  findings: EnrichedFinding[]
  auditEntries: AuditEntry[]
  tacticCoverage: MitreTacticCoverage
  tiSummary: TiSummary | null
  connected: boolean
}

interface TickerItem {
  id: string
  kind: 'incident' | 'alert'
  title: string
  severity: string
  time: string
  tactic?: string
  techniqueId?: string
  animating: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_TACTICS = [
  'InitialAccess', 'Execution', 'Persistence', 'PrivilegeEscalation',
  'DefenseEvasion', 'CredentialAccess', 'Discovery', 'LateralMovement',
  'Collection', 'CommandAndControl', 'Exfiltration', 'Impact',
]

const TACTIC_LABELS: Record<string, string> = {
  InitialAccess: 'Initial Access',
  Execution: 'Execution',
  Persistence: 'Persistence',
  PrivilegeEscalation: 'Privilege Escalation',
  DefenseEvasion: 'Defense Evasion',
  CredentialAccess: 'Credential Access',
  Discovery: 'Discovery',
  LateralMovement: 'Lateral Movement',
  Collection: 'Collection',
  CommandAndControl: 'C2',
  Exfiltration: 'Exfiltration',
  Impact: 'Impact',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityColor(sev: string): string {
  const s = (sev ?? '').toLowerCase()
  if (s === 'critical') return '#f43f5e'
  if (s === 'high') return '#f59e0b'
  if (s === 'medium') return '#8B5CF6'
  if (s === 'low') return '#06B6D4'
  return '#6b7280'
}

function tacticHeatColor(count: number): string {
  if (count === 0) return 'rgba(255,255,255,0.03)'
  if (count === 1) return 'rgba(139,92,246,0.15)'
  if (count <= 3) return 'rgba(139,92,246,0.30)'
  if (count <= 6) return 'rgba(139,92,246,0.50)'
  return 'rgba(139,92,246,0.75)'
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(iso).toLocaleDateString()
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function XDRAdvancedPage() {
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([])
  const [sseConnected, setSseConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const mountedRef = useRef(true)

  // Fetch page data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/integrations/sentinel/enrich-incidents')
      if (res.ok) {
        const d = await res.json() as PageData
        setData(d)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchData()
    return () => { mountedRef.current = false }
  }, [fetchData])

  // SSE connection
  useEffect(() => {
    mountedRef.current = true

    function connect() {
      if (!mountedRef.current) return
      if (esRef.current) esRef.current.close()

      const es = new EventSource('/api/integrations/xdr-relay')
      esRef.current = es

      es.onopen = () => {
        if (mountedRef.current) setSseConnected(true)
      }

      es.onmessage = (e) => {
        if (!mountedRef.current) return
        try {
          const event = JSON.parse(e.data as string) as {
            type: string
            isNew?: boolean
            data?: { id: string; title: string; severity: string; status: string; tactics?: string[]; category?: string; createdAt?: string; createdDateTime?: string }
            mitre?: Array<{ techniqueId: string; tacticName: string }>
            timestamp: string
          }

          if (event.type === 'heartbeat') return
          if (event.type === 'status') {
            const se = event as unknown as { type: string; connected: boolean }
            setSseConnected(se.connected)
            return
          }

          if ((event.type === 'incident' || event.type === 'alert') && event.data) {
            const item: TickerItem = {
              id: `${event.type}-${event.data.id}`,
              kind: event.type as 'incident' | 'alert',
              title: event.data.title,
              severity: event.data.severity,
              time: formatTime(event.timestamp),
              tactic: event.mitre?.[0]?.tacticName ?? event.data.tactics?.[0] ?? event.data.category,
              techniqueId: event.mitre?.[0]?.techniqueId,
              animating: true,
            }

            setTickerItems((prev) => {
              const filtered = prev.filter((p) => p.id !== item.id)
              return [item, ...filtered].slice(0, 20)
            })

            setTimeout(() => {
              if (!mountedRef.current) return
              setTickerItems((prev) =>
                prev.map((p) => p.id === item.id ? { ...p, animating: false } : p),
              )
            }, 600)
          }
        } catch { /* ignore */ }
      }

      es.onerror = () => {
        if (!mountedRef.current) return
        setSseConnected(false)
        es.close()
        setTimeout(() => { if (mountedRef.current) connect() }, 10_000)
      }
    }

    connect()
    return () => {
      mountedRef.current = false
      esRef.current?.close()
    }
  }, [])

  // Re-enrich action
  async function handleEnrich() {
    setEnriching(true)
    try {
      await fetch('/api/integrations/sentinel/enrich-incidents', { method: 'POST' })
      await fetchData()
    } finally {
      setEnriching(false)
    }
  }

  // Sync TI feed action
  async function handleSyncTI() {
    setSyncing(true)
    try {
      await fetchData() // fetchData already syncs TI internally
    } finally {
      setSyncing(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const tacticCoverage = data?.tacticCoverage ?? {}
  const tiSummary = data?.tiSummary
  const findings = data?.findings ?? []
  const auditEntries = data?.auditEntries ?? []

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* Page header */}
      <div className="animate-fade-up" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Link href="/integrations" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, textDecoration: 'none' }}>
            <ArrowLeft size={13} /> Integrations
          </Link>
          <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>XDR Advanced</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 3 }}>
              Sentinel/Defender <span className="text-gradient-violet">XDR Advanced</span>
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Real-time incident feed · MITRE ATT&amp;CK heatmap · Threat intelligence · Enriched audit trail
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSyncTI}
              disabled={syncing || !data?.connected}
              className="btn-ghost"
              style={{ fontSize: 12.5, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Database size={13} />
              {syncing ? 'Syncing…' : 'Sync TI Feed'}
            </button>
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="btn-primary"
              style={{ fontSize: 12.5, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <RefreshCw size={13} style={enriching ? { animation: 'spin 1s linear infinite' } : {}} />
              {enriching ? 'Enriching…' : 'Re-Enrich All Incidents'}
            </button>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="glass-card animate-fade-up" style={{ padding: '10px 14px', marginBottom: 18, display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: data?.connected ? '#10b981' : '#6b7280',
            boxShadow: data?.connected ? '0 0 5px #10b981' : 'none',
          }} />
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Sentinel: {data?.connected ? 'Connected' : 'Not configured'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: sseConnected ? '#10b981' : '#f59e0b',
            boxShadow: sseConnected ? '0 0 5px #10b981' : 'none',
            animation: sseConnected ? 'pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Live Relay: {sseConnected ? 'Active' : 'Connecting…'}
          </span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? 'Loading data…' : `${findings.length} enriched findings`}
        </div>
      </div>

      {/* Main grid: SSE Feed + MITRE heatmap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Real-time incident feed */}
        <div className="glass-card animate-fade-up delay-50" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Activity size={14} style={{ color: '#8B5CF6' }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
              Real-Time Incident Feed
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 600, padding: '2px 7px',
              borderRadius: 99, background: sseConnected ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
              color: sseConnected ? '#10b981' : '#f59e0b',
              border: `1px solid ${sseConnected ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
            }}>
              {sseConnected ? 'LIVE' : 'CONNECTING'}
            </span>
          </div>

          <div style={{ height: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {tickerItems.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
                <Zap size={24} style={{ color: 'var(--text-muted)', opacity: 0.35 }} />
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {data?.connected ? 'Waiting for incidents…' : 'Configure XDR to see live feed'}
                </span>
              </div>
            ) : (
              tickerItems.map((item) => (
                <div key={item.id} style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: item.animating ? `${severityColor(item.severity)}10` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${severityColor(item.severity)}22`,
                  transition: 'background 0.4s',
                  animation: item.animating ? 'slideDown 0.3s ease' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', flex: 1, marginRight: 8 }}>
                      {item.title}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{item.time}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: `${severityColor(item.severity)}18`, color: severityColor(item.severity), border: `1px solid ${severityColor(item.severity)}30`, textTransform: 'uppercase' }}>
                      {item.severity}
                    </span>
                    <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: item.kind === 'incident' ? 'rgba(139,92,246,0.12)' : 'rgba(6,182,212,0.12)', color: item.kind === 'incident' ? '#8B5CF6' : '#06B6D4', border: `1px solid ${item.kind === 'incident' ? 'rgba(139,92,246,0.25)' : 'rgba(6,182,212,0.25)'}` }}>
                      {item.kind}
                    </span>
                    {item.tactic && (
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {item.techniqueId ? `${item.techniqueId} · ` : ''}{item.tactic}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MITRE ATT&CK Heatmap */}
        <div className="glass-card animate-fade-up delay-100" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Shield size={14} style={{ color: '#06B6D4' }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
              MITRE ATT&amp;CK Coverage
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
              {Object.keys(tacticCoverage).length}/{ALL_TACTICS.length} tactics detected
            </span>
          </div>

          {/* Heatmap grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
            {ALL_TACTICS.map((tactic) => {
              const count = tacticCoverage[tactic] ?? 0
              return (
                <div key={tactic} style={{
                  padding: '9px 8px',
                  borderRadius: 7,
                  background: tacticHeatColor(count),
                  border: `1px solid ${count > 0 ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)'}`,
                  textAlign: 'center',
                  cursor: count > 0 ? 'default' : 'not-allowed',
                  transition: 'background 0.2s',
                }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: count > 0 ? '#8B5CF6' : 'var(--text-muted)', marginBottom: 2 }}>
                    {count}
                  </div>
                  <div style={{ fontSize: 9, color: count > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', lineHeight: 1.3 }}>
                    {TACTIC_LABELS[tactic] ?? tactic}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Coverage:</span>
            {[
              { label: 'None', bg: 'rgba(255,255,255,0.03)' },
              { label: 'Low', bg: 'rgba(139,92,246,0.15)' },
              { label: 'Med', bg: 'rgba(139,92,246,0.40)' },
              { label: 'High', bg: 'rgba(139,92,246,0.75)' },
            ].map(({ label, bg }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: bg, border: '1px solid rgba(139,92,246,0.2)' }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Threat Intelligence Panel + Audit Trail */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, marginBottom: 16 }}>

        {/* Threat Intelligence Panel */}
        <div className="glass-card animate-fade-up delay-150" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Eye size={14} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
              Threat Intelligence
            </span>
          </div>

          {!tiSummary ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
              {data?.connected
                ? 'No TI indicators synced yet.'
                : 'Connect Sentinel to sync TI.'}
            </div>
          ) : (
            <>
              {/* Total */}
              <div style={{ textAlign: 'center', padding: '12px 0 16px', borderBottom: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#f59e0b', lineHeight: 1 }}>{tiSummary.total}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Total Indicators</div>
              </div>

              {/* By Type */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>By Type</div>
                {[
                  { key: 'ip', label: 'IP Address', Icon: Server },
                  { key: 'domain', label: 'Domain', Icon: Globe },
                  { key: 'url', label: 'URL', Icon: Link2 },
                  { key: 'file_hash', label: 'File Hash', Icon: Hash },
                  { key: 'email', label: 'Email', Icon: Mail },
                ].map(({ key, label, Icon }) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon size={11} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: (tiSummary.byType[key] ?? 0) > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                      {tiSummary.byType[key] ?? 0}
                    </span>
                  </div>
                ))}
              </div>

              {/* By Severity */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>By Severity</div>
                {(['high', 'medium', 'low'] as const).map((sev) => {
                  const count = tiSummary.bySeverity[sev] ?? 0
                  const total = tiSummary.total || 1
                  return (
                    <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: severityColor(sev), width: 44, textTransform: 'capitalize', fontWeight: 600 }}>{sev}</span>
                      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
                        <div style={{ width: `${(count / total) * 100}%`, height: '100%', background: severityColor(sev), borderRadius: 3, transition: 'width 0.5s ease' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 24, textAlign: 'right' }}>{count}</span>
                    </div>
                  )
                })}
              </div>

              {tiSummary.sources.length > 0 && (
                <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 3 }}>Sources</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{tiSummary.sources.join(', ')}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Enriched Audit Trail */}
        <div className="glass-card animate-fade-up delay-200" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Clock size={14} style={{ color: '#06B6D4' }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
              Enriched Audit Trail
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
              Last 20 entries
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
            {auditEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
                No enriched audit entries yet. Run "Re-Enrich All Incidents" to populate.
              </div>
            ) : (
              auditEntries.map((entry) => {
                const meta = entry.metadata as Record<string, unknown> | null
                const tactics = (meta?.tactics as string[]) ?? []
                const nistControls = (meta?.nistControls as string[]) ?? []
                const sev = meta?.severity as string | undefined

                return (
                  <div key={entry.id} style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                      <div style={{ flex: 1, marginRight: 8 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 2 }}>
                          {entry.resourceTitle ?? entry.action}
                        </div>
                        {entry.description && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            {entry.description.slice(0, 180)}{entry.description.length > 180 ? '…' : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{formatTime(entry.createdAt)}</div>
                        {sev && (
                          <div style={{ marginTop: 3 }}>
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: `${severityColor(sev)}15`, color: severityColor(sev), textTransform: 'uppercase' }}>
                              {sev}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {(tactics.length > 0 || nistControls.length > 0) && (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                        {tactics.slice(0, 3).map((t) => (
                          <span key={t} style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}>
                            {t}
                          </span>
                        ))}
                        {nistControls.slice(0, 3).map((c) => (
                          <span key={c} style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: 'rgba(6,182,212,0.08)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.18)' }}>
                            {c}
                          </span>
                        ))}
                        {(tactics.length > 3 || nistControls.length > 3) && (
                          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', padding: '1px 4px' }}>
                            +{Math.max(0, tactics.length - 3) + Math.max(0, nistControls.length - 3)} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Enriched Findings Table */}
      <div className="glass-card animate-fade-up delay-250" style={{ padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <AlertTriangle size={14} style={{ color: '#f43f5e' }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
            Enriched Sentinel Findings
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
            {findings.length} finding{findings.length !== 1 ? 's' : ''}
          </span>
        </div>

        {findings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
            {data?.connected
              ? 'No Sentinel findings ingested yet. Run a scan from the Sentinel integration page.'
              : <span>Configure <Link href="/integrations/sentinel" style={{ color: '#8B5CF6' }}>Sentinel integration</Link> to start ingesting incidents.</span>
            }
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['Title', 'Severity', 'Tactics', 'NIST Controls', 'Status', 'Enriched'].map((h) => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {findings.slice(0, 25).map((f) => {
                  const meta = f.metadata as Record<string, unknown> | null
                  const tactics = (meta?.tactics as string[]) ?? []
                  const nistControls = (meta?.nistControls as string[]) ?? []
                  const enrichedAt = meta?.enrichedAt as string | undefined

                  return (
                    <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.12s' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.title}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${severityColor(f.severity)}15`, color: severityColor(f.severity), textTransform: 'uppercase' }}>
                          {f.severity}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {tactics.slice(0, 2).map((t) => (
                            <span key={t} style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.18)' }}>
                              {t}
                            </span>
                          ))}
                          {tactics.length > 2 && <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>+{tactics.length - 2}</span>}
                          {tactics.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {nistControls.slice(0, 3).map((c) => (
                            <span key={c} style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: 'rgba(6,182,212,0.08)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.15)' }}>
                              {c}
                            </span>
                          ))}
                          {nistControls.length > 3 && <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>+{nistControls.length - 3}</span>}
                          {nistControls.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {f.status === 'open' ? (
                            <AlertTriangle size={11} style={{ color: '#f59e0b' }} />
                          ) : (
                            <CheckCircle size={11} style={{ color: '#10b981' }} />
                          )}
                          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                            {f.status.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)' }}>
                        {enrichedAt ? formatTime(enrichedAt) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
