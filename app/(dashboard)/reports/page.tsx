'use client'

import { useState, useCallback } from 'react'
import {
  AlertTriangle, Clock, ShieldCheck, FileText,
  GitBranch, BookOpen, Download, ExternalLink,
  BarChart3, Loader2, CheckCircle2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportStatus = 'idle' | 'generating' | 'ready' | 'error'

interface ReportCard {
  id: string
  title: string
  description: string
  icon: React.ElementType
  iconColor: string
  endpoint?: string
  filename?: string
  href?: string
  lastGenerated?: string
}

// ── Report definitions ────────────────────────────────────────────────────────

const REPORTS: ReportCard[] = [
  {
    id: 'risk-assessment',
    title: 'Risk Assessment Report',
    description:
      'Summary of all risks by severity, category, and mitigation status. Includes inherent and residual scores, owners, and review dates.',
    icon: AlertTriangle,
    iconColor: 'var(--amber)',
    endpoint: '/api/reports/risk-assessment',
    filename: 'risk-assessment',
  },
  {
    id: 'audit-trail',
    title: 'Audit Trail Report',
    description:
      'Complete timeline of all platform actions — who did what, when. Includes user, action type, entity references, and IP addresses.',
    icon: Clock,
    iconColor: 'var(--cyan)',
    endpoint: '/api/reports/audit-trail',
    filename: 'audit-trail',
  },
  {
    id: 'compliance-status',
    title: 'Compliance Status Report',
    description:
      'Per-framework progress snapshot: controls implemented vs total, in-progress count, and evidence gap percentage.',
    icon: ShieldCheck,
    iconColor: 'var(--emerald)',
    endpoint: '/api/reports/compliance-status',
    filename: 'compliance-status',
  },
  {
    id: 'evidence-summary',
    title: 'Evidence Summary Report',
    description:
      'All evidence items with status, type, control reference, uploader, creation date, expiry date, and storage provider.',
    icon: FileText,
    iconColor: 'var(--violet)',
    endpoint: '/api/reports/evidence-summary',
    filename: 'evidence-summary',
  },
  {
    id: 'control-gaps',
    title: 'Control Gap Analysis',
    description:
      'Controls across active frameworks that have no evidence attached. Highlights compliance gaps for remediation prioritisation.',
    icon: GitBranch,
    iconColor: 'var(--rose)',
    endpoint: '/api/reports/control-gaps',
    filename: 'control-gaps',
  },
  {
    id: 'soa',
    title: 'SOA Report',
    description:
      'Statement of Applicability per framework — control inclusion/exclusion status, justifications, and implementation progress.',
    icon: BookOpen,
    iconColor: 'var(--violet)',
    href: '/soa',
  },
]

// ── Helper ────────────────────────────────────────────────────────────────────

function formatAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [statuses, setStatuses] = useState<Record<string, ReportStatus>>({})
  const [generatedAt, setGeneratedAt] = useState<Record<string, Date>>({})

  const handleGenerate = useCallback(async (report: ReportCard) => {
    if (!report.endpoint) return
    if (statuses[report.id] === 'generating') return

    setStatuses((prev) => ({ ...prev, [report.id]: 'generating' }))

    try {
      const res = await fetch(report.endpoint)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const today = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `${report.filename}-${today}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const now = new Date()
      setGeneratedAt((prev) => ({ ...prev, [report.id]: now }))
      setStatuses((prev) => ({ ...prev, [report.id]: 'ready' }))
    } catch {
      setStatuses((prev) => ({ ...prev, [report.id]: 'error' }))
      setTimeout(() => {
        setStatuses((prev) => ({ ...prev, [report.id]: 'idle' }))
      }, 3000)
    }
  }, [statuses])

  const getStatusBadge = (report: ReportCard) => {
    const status = statuses[report.id] ?? 'idle'
    if (status === 'generating') {
      return (
        <span
          className="badge"
          style={{
            background: 'rgba(245,158,11,0.15)',
            color: 'var(--amber)',
            border: '1px solid rgba(245,158,11,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        >
          <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
          Generating…
        </span>
      )
    }
    if (status === 'ready') {
      const at = generatedAt[report.id]
      return (
        <span
          className="badge"
          style={{
            background: 'rgba(16,185,129,0.12)',
            color: 'var(--emerald)',
            border: '1px solid rgba(16,185,129,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <CheckCircle2 size={10} />
          {at ? `Generated ${formatAgo(at)}` : 'Ready'}
        </span>
      )
    }
    if (status === 'error') {
      return (
        <span
          className="badge"
          style={{
            background: 'rgba(239,68,68,0.12)',
            color: 'var(--rose)',
            border: '1px solid rgba(239,68,68,0.25)',
          }}
        >
          Export failed
        </span>
      )
    }
    return (
      <span
        className="badge"
        style={{
          background: 'rgba(255,255,255,0.06)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border-glass)',
        }}
      >
        Ready to generate
      </span>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* ── Page header ─────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: 6,
              }}
            >
              Reports &amp; Exports
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', maxWidth: 480 }}>
              Generate and download compliance reports as CSV. All exports reflect live data
              from your organisation.
            </p>
          </div>

          <div
            className="glass-card"
            style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--text-muted)',
            }}
          >
            <BarChart3 size={13} style={{ color: 'var(--violet)' }} />
            <span>6 report types available</span>
          </div>
        </div>
      </div>

      {/* ── Report cards grid ────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: 16,
        }}
      >
        {REPORTS.map((report) => {
          const Icon = report.icon
          const status = statuses[report.id] ?? 'idle'
          const isGenerating = status === 'generating'

          return (
            <div
              key={report.id}
              className="glass-card"
              style={{
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                transition: 'border-color 0.2s',
              }}
            >
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Icon */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `color-mix(in srgb, ${report.iconColor} 12%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${report.iconColor} 25%, transparent)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={17} style={{ color: report.iconColor }} />
                </div>

                {/* Title + badge */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: 6,
                    }}
                  >
                    {report.title}
                  </div>
                  {getStatusBadge(report)}
                </div>
              </div>

              {/* Description */}
              <p
                style={{
                  fontSize: 12.5,
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                  flex: 1,
                }}
              >
                {report.description}
              </p>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                {report.href ? (
                  <a
                    href={report.href}
                    className="btn-primary"
                    style={{
                      fontSize: 12,
                      padding: '7px 14px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <ExternalLink size={12} />
                    Open SOA
                  </a>
                ) : (
                  <button
                    className="btn-primary"
                    style={{
                      fontSize: 12,
                      padding: '7px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      opacity: isGenerating ? 0.7 : 1,
                      cursor: isGenerating ? 'not-allowed' : 'pointer',
                    }}
                    onClick={() => handleGenerate(report)}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Download size={12} />
                        Generate CSV
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Info strip ──────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          marginTop: 24,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 12,
          color: 'var(--text-muted)',
          borderColor: 'rgba(139,92,246,0.15)',
        }}
      >
        <FileText size={13} style={{ color: 'var(--violet)', flexShrink: 0 }} />
        <span>
          All CSV exports are scoped to your organisation. Reports include headers even when
          no data is available. For audit packages with attached evidence files, use the{' '}
          <a href="/audit" style={{ color: 'var(--violet)', textDecoration: 'none' }}>
            Auditor View
          </a>
          .
        </span>
      </div>
    </div>
  )
}
