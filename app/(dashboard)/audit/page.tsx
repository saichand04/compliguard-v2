'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, ChevronDown, Download, FileText,
  Clock, AlertTriangle, Link2, RefreshCw, Package,
  CheckCircle2, XCircle, Circle, AlertCircle, Eye,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Framework {
  id: string
  name: string
  shortName: string | null
}

interface ControlItem {
  id: string
  controlId: string | null
  title: string
  category: string | null
  status: string
  evidenceCount: number
}

interface EvidenceItem {
  id: string
  title: string
  evidenceType: string
  status: string
  storageProvider: string | null
  createdAt: string
  expiresAt: string | null
  downloadUrl: string | null
}

interface AuditLogItem {
  id: string
  action: string
  description: string | null
  createdAt: string
  userId: string | null
  userDisplay: string | null
}

interface MappingItem {
  frameworkName: string
  controlRef: string
  mappingType: string
  confidence: number
}

interface ControlDetail {
  control: {
    id: string
    controlId: string | null
    title: string
    description: string | null
    category: string | null
    status: string
  }
  evidence: EvidenceItem[]
  auditLogs: AuditLogItem[]
  mappings: MappingItem[]
}

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    implemented:   { label: 'Implemented',  color: 'var(--emerald)', icon: CheckCircle2 },
    in_progress:   { label: 'In Progress',  color: 'var(--amber)',   icon: AlertCircle },
    not_started:   { label: 'Not Started',  color: 'var(--text-muted)', icon: Circle },
    needs_review:  { label: 'Needs Review', color: 'var(--rose)',    icon: AlertTriangle },
    not_applicable:{ label: 'N/A',          color: 'var(--text-muted)', icon: XCircle },
  }
  const cfg = map[status] ?? { label: status, color: 'var(--text-muted)', icon: Circle }
  const Icon = cfg.icon
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10.5,
        fontWeight: 500,
        color: cfg.color,
        padding: '2px 7px',
        borderRadius: 20,
        background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${cfg.color} 22%, transparent)`,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={9} />
      {cfg.label}
    </span>
  )
}

function EvidenceStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    approved: '#10B981',
    pending: '#F59E0B',
    rejected: '#EF4444',
    expired: '#64748B',
  }
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: colors[status] ?? '#64748B',
        flexShrink: 0,
      }}
    />
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string>('')
  const [controls, setControls] = useState<ControlItem[]>([])
  const [selectedControl, setSelectedControl] = useState<ControlItem | null>(null)
  const [detail, setDetail] = useState<ControlDetail | null>(null)
  const [loadingControls, setLoadingControls] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Load frameworks
  useEffect(() => {
    fetch('/api/frameworks')
      .then((r) => r.json())
      .then((data) => {
        const fws: Framework[] = data.frameworks ?? data ?? []
        setFrameworks(fws)
        if (fws.length > 0) setSelectedFrameworkId(fws[0].id)
      })
      .catch(() => {})
  }, [])

  // Load controls when framework changes
  useEffect(() => {
    if (!selectedFrameworkId) return
    setLoadingControls(true)
    setControls([])
    setSelectedControl(null)
    setDetail(null)

    fetch(`/api/audit/controls?frameworkId=${selectedFrameworkId}`)
      .then((r) => r.json())
      .then((data) => setControls(data.controls ?? []))
      .catch(() => setControls([]))
      .finally(() => setLoadingControls(false))
  }, [selectedFrameworkId])

  // Load detail when control selected
  useEffect(() => {
    if (!selectedControl) return
    setLoadingDetail(true)
    setDetail(null)

    // Fetch detail from evidence + audit APIs
    Promise.all([
      fetch(`/api/evidence?controlId=${selectedControl.id}`).then((r) => r.json()).catch(() => ({ evidence: [] })),
      fetch(`/api/audit-logs?resourceId=${selectedControl.id}`).then((r) => r.json()).catch(() => ({ logs: [] })),
    ]).then(([evidenceData, auditData]) => {
      setDetail({
        control: {
          id: selectedControl.id,
          controlId: selectedControl.controlId,
          title: selectedControl.title,
          description: null,
          category: selectedControl.category,
          status: selectedControl.status,
        },
        evidence: (evidenceData.evidence ?? []).slice(0, 20),
        auditLogs: (auditData.logs ?? []).slice(0, 10),
        mappings: [],
      })
    }).finally(() => setLoadingDetail(false))
  }, [selectedControl])

  const handleExportZip = useCallback(async () => {
    setExporting(true)
    try {
      const url = selectedFrameworkId
        ? `/api/audit/export-zip?frameworkId=${selectedFrameworkId}`
        : '/api/audit/export-zip'
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const today = new Date().toISOString().split('T')[0]
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `audit-package-${today}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } catch {
      alert('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }, [selectedFrameworkId])

  return (
    <div
      className="animate-fade-in"
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}
    >
      {/* ── Page header ──────────────────────────────────── */}
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: 5,
              }}
            >
              Auditor View
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Read-only control and evidence overview for external audit review
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {/* Framework selector */}
            <div style={{ position: 'relative' }}>
              <select
                value={selectedFrameworkId}
                onChange={(e) => setSelectedFrameworkId(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 8,
                  padding: '7px 32px 7px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  cursor: 'pointer',
                  appearance: 'none',
                  outline: 'none',
                }}
              >
                <option value="" style={{ background: '#0F1729' }}>All frameworks</option>
                {frameworks.map((f) => (
                  <option key={f.id} value={f.id} style={{ background: '#0F1729' }}>
                    {f.shortName ?? f.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            <button
              className="btn-primary"
              style={{
                fontSize: 12,
                padding: '7px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: exporting ? 0.7 : 1,
                cursor: exporting ? 'not-allowed' : 'pointer',
              }}
              onClick={handleExportZip}
              disabled={exporting}
            >
              {exporting ? (
                <>
                  <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  Exporting…
                </>
              ) : (
                <>
                  <Package size={13} />
                  Export Package
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flex: 1, overflow: 'hidden' }}>

        {/* Left: control list (40%) */}
        <div
          className="glass-card"
          style={{
            width: '38%',
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--border-glass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Controls
            </span>
            <span
              className="badge"
              style={{
                background: 'rgba(139,92,246,0.12)',
                color: 'var(--violet)',
                border: '1px solid rgba(139,92,246,0.22)',
                fontSize: 10,
              }}
            >
              {controls.length} total
            </span>
          </div>

          <div style={{ overflow: 'auto', flex: 1 }}>
            {loadingControls ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                Loading…
              </div>
            ) : controls.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                <ShieldCheck size={28} style={{ opacity: 0.25 }} />
                <span>No controls found</span>
              </div>
            ) : (
              controls.map((ctrl) => {
                const isActive = selectedControl?.id === ctrl.id
                return (
                  <button
                    key={ctrl.id}
                    onClick={() => setSelectedControl(ctrl)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: '10px 14px',
                      width: '100%',
                      background: isActive ? 'rgba(139,92,246,0.1)' : 'none',
                      border: 'none',
                      borderBottom: '1px solid var(--border-glass)',
                      borderLeft: isActive ? '2px solid var(--violet)' : '2px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.025)' }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10.5, color: 'var(--text-muted)' }}>
                        {ctrl.controlId ?? '—'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 20,
                            background: ctrl.evidenceCount > 0 ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.05)',
                            color: ctrl.evidenceCount > 0 ? 'var(--cyan)' : 'var(--text-muted)',
                            border: `1px solid ${ctrl.evidenceCount > 0 ? 'rgba(6,182,212,0.2)' : 'var(--border-glass)'}`,
                            fontWeight: 500,
                          }}
                        >
                          {ctrl.evidenceCount} ev.
                        </span>
                        <StatusPill status={ctrl.status} />
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {ctrl.title}
                    </span>
                    {ctrl.category && (
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{ctrl.category}</span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right: detail panel (60%) */}
        <div
          className="glass-card"
          style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}
        >
          {!selectedControl ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, color: 'var(--text-muted)' }}>
              <Eye size={32} style={{ opacity: 0.25 }} />
              <p style={{ fontSize: 13 }}>Select a control to view details</p>
            </div>
          ) : loadingDetail ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
              Loading details…
            </div>
          ) : (
            <div style={{ overflow: 'auto', flex: 1, padding: 20 }}>
              {/* Control header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      {selectedControl.controlId && (
                        <code style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 5 }}>
                          {selectedControl.controlId}
                        </code>
                      )}
                      <StatusPill status={selectedControl.status} />
                    </div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                      {selectedControl.title}
                    </h2>
                    {selectedControl.category && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedControl.category}</span>
                    )}
                    {detail?.control.description && (
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 10 }}>
                        {detail.control.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Evidence section */}
              <Section
                title="Evidence Items"
                icon={FileText}
                count={detail?.evidence.length ?? 0}
                iconColor="var(--cyan)"
              >
                {!detail?.evidence.length ? (
                  <EmptyState message="No evidence attached to this control" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {detail.evidence.map((ev) => (
                      <div
                        key={ev.id}
                        className="glass-card"
                        style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}
                      >
                        <EvidenceStatusDot status={ev.status} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ev.title}
                          </div>
                          <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ev.evidenceType}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {new Date(ev.createdAt).toLocaleDateString()}
                            </span>
                            {ev.expiresAt && (
                              <span style={{ fontSize: 11, color: 'var(--amber)' }}>
                                Expires {new Date(ev.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        {ev.storageProvider && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
                            {ev.storageProvider}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Audit trail section */}
              <Section
                title="Audit Trail"
                icon={Clock}
                count={detail?.auditLogs.length ?? 0}
                iconColor="var(--violet)"
              >
                {!detail?.auditLogs.length ? (
                  <EmptyState message="No audit activity recorded for this control" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {detail.auditLogs.map((log, i) => (
                      <div
                        key={log.id}
                        style={{
                          display: 'flex',
                          gap: 12,
                          padding: '9px 0',
                          borderBottom: i < detail.auditLogs.length - 1 ? '1px solid var(--border-glass)' : 'none',
                        }}
                      >
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--violet)', marginTop: 5, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <code style={{ fontSize: 11, color: 'var(--violet)' }}>{log.action}</code>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {log.description && (
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{log.description}</p>
                          )}
                          {log.userDisplay && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>by {log.userDisplay}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Mapping coverage section */}
              <Section
                title="Framework Mapping Coverage"
                icon={Link2}
                count={detail?.mappings.length ?? 0}
                iconColor="var(--emerald)"
              >
                {!detail?.mappings.length ? (
                  <EmptyState message="No cross-framework mappings found" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detail.mappings.map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                        <code style={{ color: 'var(--cyan)', fontSize: 11 }}>{m.controlRef}</code>
                        <span style={{ color: 'var(--text-muted)' }}>{m.frameworkName}</span>
                        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 10 }}>
                          {m.mappingType} · {m.confidence}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  count,
  iconColor,
  children,
}: {
  title: string
  icon: React.ElementType
  count: number
  iconColor: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border-glass)',
        }}
      >
        <Icon size={14} style={{ color: iconColor }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</span>
        <span
          style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-glass)',
          }}
        >
          {count}
        </span>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
      {message}
    </p>
  )
}
