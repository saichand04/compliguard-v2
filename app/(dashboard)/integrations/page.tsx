'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plug, Cloud, Code2, ShieldCheck, AlertTriangle, CheckCircle2,
  Clock, RefreshCw, ChevronRight, Activity, Zap, Server,
  MessageSquare, Ticket, Building2, Lock, Wifi, WifiOff,
  FlaskConical, Calendar, ChevronDown, Loader2, Target, Link2,
  Eye, EyeOff,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

interface IntegrationStatus {
  type: string
  connected: boolean
  status: string
  lastSyncAt: string | null
  errorMessage: string | null
  syncSchedule?: string | null
}

interface ScanAllResult {
  scanned: number
  totalFindings: number
  integrations: Array<{
    type: string
    status: 'success' | 'error' | 'skipped'
    findingsCount: number
    error?: string
  }>
}

// ── Integration catalog ───────────────────────────────────────────────────────

const INTEGRATION_CATALOG = [
  {
    category: 'Cloud Providers',
    icon: Cloud,
    color: '#8B5CF6',
    items: [
      {
        type: 'github',
        name: 'GitHub',
        description: 'Repository scanning, branch protection, secret detection, Dependabot alerts',
        icon: Code2,
        color: '#8B5CF6',
        phase: 'available',
        checks: 10,
      },
      {
        type: 'aws',
        name: 'Amazon Web Services',
        description: 'IAM, S3, CloudTrail, GuardDuty, SecurityHub, VPC, EC2, RDS, KMS',
        icon: Cloud,
        color: '#F97316',
        phase: 'available',
        checks: 40,
      },
      {
        type: 'azure',
        name: 'Microsoft Azure',
        description: 'Entra ID, Defender, Sentinel, Policy — coming in Phase 3B',
        icon: Cloud,
        color: '#3B82F6',
        phase: 'coming_soon',
        checks: 35,
      },
      {
        type: 'gcp',
        name: 'Google Cloud Platform',
        description: 'IAM, SCC, Audit Logs — coming in Phase 3B',
        icon: Cloud,
        color: '#10B981',
        phase: 'coming_soon',
        checks: 30,
      },
    ],
  },
  {
    category: 'Communication & Ticketing',
    icon: MessageSquare,
    color: '#06B6D4',
    items: [
      {
        type: 'slack',
        name: 'Slack',
        description: 'Compliance alerts, finding notifications, approval workflows',
        icon: MessageSquare,
        color: '#06B6D4',
        phase: 'coming_soon',
        checks: 0,
      },
      {
        type: 'jira',
        name: 'Jira',
        description: 'Risk tickets, remediation tracking, audit task management',
        icon: Ticket,
        color: '#0052CC',
        phase: 'coming_soon',
        checks: 0,
      },
    ],
  },
  {
    category: 'Microsoft 365',
    icon: Building2,
    color: '#8B5CF6',
    items: [
      {
        type: 'intune',
        name: 'Microsoft Intune',
        description: 'Device compliance and MDM policy assessment — Phase 4',
        icon: Server,
        color: '#0078D4',
        phase: 'phase_4',
        checks: 0,
      },
      {
        type: 'defender',
        name: 'Microsoft Defender',
        description: 'Endpoint detection and threat intelligence — Phase 4',
        icon: ShieldCheck,
        color: '#0078D4',
        phase: 'phase_4',
        checks: 0,
      },
    ],
  },
]

const SCHEDULE_LABELS: Record<string, string> = {
  '': 'Manual',
  'manual': 'Manual',
  'daily': 'Daily at 9am',
  'weekly': 'Weekly (Mon)',
  'monthly': 'Monthly (1st)',
  '0 9 * * *': 'Daily at 9am',
  '0 9 * * 1': 'Weekly Mon',
  '0 9 1 * *': 'Monthly 1st',
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ connected, status }: { connected: boolean; status?: string }) {
  if (!connected) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
        color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '2px 8px',
      }}>
        <WifiOff size={10} />
        DISCONNECTED
      </span>
    )
  }

  const isError = status === 'error'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
      color: isError ? '#EF4444' : '#10B981',
      background: isError ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
      border: `1px solid ${isError ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
      borderRadius: 20, padding: '2px 8px',
    }}>
      <Wifi size={10} />
      {isError ? 'ERROR' : 'CONNECTED'}
    </span>
  )
}

// ── Schedule dropdown ────────────────────────────────────────────────────────

function SchedulePill({ type, schedule, onUpdate }: { type: string; schedule: string | null; onUpdate: (s: string) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const options = [
    { value: 'manual', label: 'Manual' },
    { value: 'daily', label: 'Daily at 9am' },
    { value: 'weekly', label: 'Weekly (Mon 9am)' },
    { value: 'monthly', label: 'Monthly (1st)' },
  ]

  async function handleSelect(val: string) {
    setSaving(true)
    setOpen(false)
    try {
      await fetch(`/api/integrations/${type}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: val }),
      })
      onUpdate(val)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 6,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11,
        }}
      >
        {saving ? <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} /> : <Calendar size={9} />}
        {SCHEDULE_LABELS[schedule ?? ''] ?? schedule ?? 'Manual'}
        <ChevronDown size={9} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: 4,
            background: '#0E1221', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, overflow: 'hidden', minWidth: 160,
          }}>
            {options.map((o) => (
              <button
                key={o.value}
                onClick={(e) => { e.stopPropagation(); void handleSelect(o.value) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', fontSize: 12.5, color: 'var(--text-secondary)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Integration card ──────────────────────────────────────────────────────────

interface IntegrationCardProps {
  type: string
  name: string
  description: string
  icon: React.ElementType
  color: string
  phase: string
  checks: number
  status: IntegrationStatus | null
  onRunScan: (type: string) => void
  scanning: boolean
  scanInfo?: ScanAllResult['integrations'][number]
  onScheduleUpdate: (type: string, schedule: string) => void
}

function IntegrationCard({
  type, name, description, icon: Icon, color, phase, checks,
  status, onRunScan, scanning, scanInfo, onScheduleUpdate,
}: IntegrationCardProps) {
  const available = phase === 'available'
  const connected = status?.connected ?? false
  const lastSync = status?.lastSyncAt ? new Date(status.lastSyncAt) : null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${connected ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      transition: 'border-color 0.2s, transform 0.15s',
      position: 'relative',
      overflow: 'hidden',
    }}
      className={available ? 'card-hover' : ''}
    >
      {/* Top glow for connected integrations */}
      {connected && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${color}18`, border: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={18} color={color} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {name}
            </div>
            {available && checks > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {checks} security checks
              </div>
            )}
          </div>
        </div>

        {available ? (
          <StatusBadge connected={connected} status={status?.status} />
        ) : (
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
            color: '#8B5CF6', background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.25)', borderRadius: 20, padding: '2px 8px',
          }}>
            {phase === 'phase_4' ? 'PHASE 4' : 'COMING SOON'}
          </span>
        )}
      </div>

      {/* Description */}
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
        {description}
      </p>

      {/* Schedule indicator */}
      {available && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SchedulePill
            type={type}
            schedule={status?.syncSchedule ?? null}
            onUpdate={(s) => onScheduleUpdate(type, s)}
          />
          {lastSync && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
              <Clock size={10} />
              {lastSync.toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* Scan result badge */}
      {scanInfo && (
        <div style={{
          padding: '6px 10px', borderRadius: 7, fontSize: 11.5,
          background: scanInfo.status === 'success'
            ? 'rgba(16,185,129,0.08)'
            : scanInfo.status === 'error'
            ? 'rgba(239,68,68,0.08)'
            : 'rgba(255,255,255,0.03)',
          color: scanInfo.status === 'success' ? '#10B981' : scanInfo.status === 'error' ? '#EF4444' : 'var(--text-muted)',
          border: `1px solid ${scanInfo.status === 'success' ? 'rgba(16,185,129,0.2)' : scanInfo.status === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
        }}>
          {scanInfo.status === 'success'
            ? `${scanInfo.findingsCount} finding${scanInfo.findingsCount !== 1 ? 's' : ''} detected`
            : scanInfo.status === 'error'
            ? `Scan error: ${scanInfo.error ?? 'unknown'}`
            : 'Skipped'
          }
        </div>
      )}

      {/* Actions */}
      {available && (
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
          <Link
            href={`/integrations/${type}`}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12.5, fontWeight: 500, padding: '8px 12px', borderRadius: 8,
              background: connected ? `${color}15` : 'rgba(255,255,255,0.06)',
              border: `1px solid ${connected ? `${color}30` : 'rgba(255,255,255,0.1)'}`,
              color: connected ? color : 'var(--text-secondary)',
              textDecoration: 'none', transition: 'all 0.15s',
            }}
          >
            {connected ? 'Configure' : 'Connect'}
            <ChevronRight size={12} />
          </Link>

          {connected && (
            <button
              onClick={() => onRunScan(type)}
              disabled={scanning}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12.5, fontWeight: 500, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)',
                color: '#8B5CF6', cursor: scanning ? 'not-allowed' : 'pointer',
                opacity: scanning ? 0.6 : 1, transition: 'all 0.15s',
              }}
            >
              <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} />
              Scan
            </button>
          )}
        </div>
      )}
    </div>
  )
}


// ── ITSM Platforms section ────────────────────────────────────────────

interface ItsmConfig {
  baseUrl: string
  username: string
  password: string
  project: string
  pat: string
}

const ITSM_PLATFORMS_CONFIG = [
  {
    type: 'jira',
    name: 'JIRA',
    color: '#0052CC',
    description: 'Link pentest issues to JIRA tickets for remediation tracking and workflow automation.',
    fields: [
      { key: 'baseUrl',  label: 'Base URL',  placeholder: 'https://yourcompany.atlassian.net', type: 'url' },
      { key: 'username', label: 'Email',     placeholder: 'user@company.com', type: 'email' },
      { key: 'password', label: 'API Token', placeholder: 'ATATT3xFfGF0...', type: 'password' },
    ],
  },
  {
    type: 'servicenow',
    name: 'ServiceNow',
    color: '#81B5A1',
    description: 'Sync findings with ServiceNow incidents and change management workflows.',
    fields: [
      { key: 'baseUrl',  label: 'Instance URL', placeholder: 'https://yourinstance.service-now.com', type: 'url' },
      { key: 'username', label: 'Username',      placeholder: 'admin', type: 'text' },
      { key: 'password', label: 'Password',      placeholder: '••••••••', type: 'password' },
    ],
  },
  {
    type: 'azure_devops',
    name: 'Azure DevOps',
    color: '#0078D4',
    description: 'Create work items in Azure DevOps Boards for pentest finding remediation.',
    fields: [
      { key: 'baseUrl',  label: 'Org URL',      placeholder: 'https://dev.azure.com/yourorg', type: 'url' },
      { key: 'password', label: 'PAT Token',    placeholder: 'Personal access token', type: 'password' },
      { key: 'project',  label: 'Project Name', placeholder: 'MyProject', type: 'text' },
    ],
  },
  {
    type: 'linear',
    name: 'Linear',
    color: '#5B50D6',
    description: 'Sync pentest issues with Linear projects for agile remediation workflows.',
    fields: [
      { key: 'password', label: 'API Key', placeholder: 'lin_api_...', type: 'password' },
    ],
  },
  {
    type: 'freshservice',
    name: 'Freshservice',
    color: '#0D9F60',
    description: 'Create Freshservice tickets for pentest findings and track SLA compliance.',
    fields: [
      { key: 'baseUrl',  label: 'Domain',  placeholder: 'https://yourcompany.freshservice.com', type: 'url' },
      { key: 'password', label: 'API Key', placeholder: 'your-api-key', type: 'password' },
    ],
  },
]

function ItsmPlatformCard({ platform }: { platform: typeof ITSM_PLATFORMS_CONFIG[0] }) {
  const [connected, setConnected] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [config, setConfig] = useState<Partial<ItsmConfig>>({ baseUrl: '', username: '', password: '', project: '', pat: '' })

  function setField(key: string, value: string) {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/integrations/itsm/${platform.type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        setConnected(true)
        setLastSync(new Date().toISOString())
        setExpanded(false)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    try {
      await fetch(`/api/integrations/itsm/${platform.type}`, { method: 'DELETE' })
      setConnected(false)
      setLastSync(null)
      setConfig({ baseUrl: '', username: '', password: '', project: '', pat: '' })
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${connected ? `${platform.color}35` : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s',
      position: 'relative',
    }}>
      {connected && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${platform.color}, transparent)` }} />
      )}

      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${platform.color}18`, border: `1px solid ${platform.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Link2 size={18} color={platform.color} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{platform.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {connected
                ? lastSync ? `Last sync: ${new Date(lastSync).toLocaleString()}` : 'Connected'
                : platform.description.slice(0, 55) + '…'
              }
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {connected ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: '#10B981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '2px 8px' }}>
              <Wifi size={10} /> CONNECTED
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '2px 8px' }}>
              <WifiOff size={10} /> NOT CONNECTED
            </span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 500, background: connected ? `${platform.color}12` : 'rgba(255,255,255,0.06)', border: `1px solid ${connected ? `${platform.color}30` : 'rgba(255,255,255,0.1)'}`, color: connected ? platform.color : 'var(--text-secondary)', cursor: 'pointer' }}
          >
            {connected ? 'Configure' : 'Connect'} <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, margin: '14px 0 16px' }}>{platform.description}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {platform.fields.map(field => (
              <div key={field.key}>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 5 }}>{field.label}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={field.type === 'password' && !showPasswords[field.key] ? 'password' : field.type === 'password' ? 'text' : field.type}
                    value={(config as Record<string, string>)[field.key] ?? ''}
                    onChange={e => setField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8, padding: field.type === 'password' ? '9px 36px 9px 12px' : '9px 12px',
                      fontSize: 13, color: '#E2E8F0', outline: 'none', boxSizing: 'border-box' as const,
                    }}
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      onClick={() => setShowPasswords(p => ({ ...p, [field.key]: !p[field.key] }))}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex' }}
                    >
                      {showPasswords[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            {connected && (
              <button
                onClick={() => void handleDisconnect()}
                style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 500, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', cursor: 'pointer' }}
              >
                Disconnect
              </button>
            )}
            <button
              onClick={() => setExpanded(false)}
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 500, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: saving ? `${platform.color}30` : `${platform.color}20`, border: `1px solid ${platform.color}50`, color: platform.color, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={13} />}
              {saving ? 'Saving…' : 'Save & Connect'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ItsmSection() {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Target size={14} color="#EF4444" />
        <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          ITSM & Ticketing (Pentest)
        </h2>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, marginLeft: 22 }}>
        Connect ticketing platforms to automatically create and sync remediation tickets for pentest findings.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {ITSM_PLATFORMS_CONFIG.map(platform => (
          <ItsmPlatformCard key={platform.type} platform={platform} />
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({})
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState<Record<string, boolean>>({})
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [scanAllRunning, setScanAllRunning] = useState(false)
  const [scanAllResult, setScanAllResult] = useState<ScanAllResult | null>(null)
  const [scheduleOverrides, setScheduleOverrides] = useState<Record<string, string>>({})

  const fetchStatuses = useCallback(async () => {
    try {
      const types = ['github', 'aws']
      const results = await Promise.allSettled(
        types.map((t) => fetch(`/api/integrations/${t}`).then((r) => r.json() as Promise<{ connected: boolean; integration: { status: string; lastSyncAt: string | null; errorMessage: string | null; syncSchedule?: string | null } | null }>))
      )

      const statusMap: Record<string, IntegrationStatus> = {}
      types.forEach((type, i) => {
        const result = results[i]
        if (result.status === 'fulfilled' && result.value) {
          const d = result.value
          statusMap[type] = {
            type,
            connected: d.connected,
            status: d.integration?.status ?? 'inactive',
            lastSyncAt: d.integration?.lastSyncAt ?? null,
            errorMessage: d.integration?.errorMessage ?? null,
            syncSchedule: d.integration?.syncSchedule ?? null,
          }
        }
      })
      setStatuses(statusMap)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatuses()
  }, [fetchStatuses])

  const handleRunScan = async (type: string) => {
    setScanning((s) => ({ ...s, [type]: true }))
    setScanMessage(null)
    try {
      const res = await fetch(`/api/integrations/${type}/scan`, { method: 'POST' })
      const data = await res.json() as { success: boolean; summary?: { failed: number } }
      if (data.success) {
        setScanMessage(`${type.toUpperCase()} scan complete — ${data.summary?.failed ?? 0} findings`)
        await fetchStatuses()
      }
    } catch {
      setScanMessage('Scan failed — check console for details')
    } finally {
      setScanning((s) => ({ ...s, [type]: false }))
    }
  }

  const handleScanAll = async () => {
    setScanAllRunning(true)
    setScanAllResult(null)
    setScanMessage(null)
    try {
      const res = await fetch('/api/integrations/scan-all', { method: 'POST' })
      const data = await res.json() as ScanAllResult
      setScanAllResult(data)
      setScanMessage(`Scan All complete: ${data.scanned} scanned, ${data.totalFindings} total findings`)
      await fetchStatuses()
    } catch {
      setScanMessage('Scan All failed')
    } finally {
      setScanAllRunning(false)
    }
  }

  const handleScheduleUpdate = (type: string, schedule: string) => {
    setScheduleOverrides(prev => ({ ...prev, [type]: schedule }))
    setStatuses(prev => ({
      ...prev,
      [type]: prev[type] ? { ...prev[type], syncSchedule: schedule } : { type, connected: false, status: 'inactive', lastSyncAt: null, errorMessage: null, syncSchedule: schedule },
    }))
  }

  const connectedCount = Object.values(statuses).filter((s) => s.connected).length
  const allIntegrations = INTEGRATION_CATALOG.flatMap((c) => c.items)
  const anyScanning = Object.values(scanning).some(Boolean) || scanAllRunning

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }} className="animate-fade-in">
      {/* ── Page header ─────────────────────────────── */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plug size={16} color="#8B5CF6" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Integrations
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 46 }}>
            Connect your infrastructure to automate compliance evidence collection and security scanning.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => void handleScanAll()}
            disabled={anyScanning}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, fontWeight: 500, padding: '9px 16px', borderRadius: 8,
              background: anyScanning ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.35)',
              color: '#8B5CF6', cursor: anyScanning ? 'not-allowed' : 'pointer',
              opacity: anyScanning ? 0.7 : 1, transition: 'all 0.15s',
            }}
          >
            {scanAllRunning
              ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <Zap size={14} />
            }
            {scanAllRunning ? 'Scanning…' : 'Scan All'}
          </button>
        </div>
      </div>

      {/* ── NL Tests card ───────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <FlaskConical size={14} color="#8B5CF6" />
          <h2 style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--text-muted)',
          }}>
            Security Testing
          </h2>
        </div>
        <Link href="/integrations/nl-tests" style={{ textDecoration: 'none' }}>
          <div style={{
            padding: '18px 20px', borderRadius: 12, cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(6,182,212,0.06) 100%)',
            border: '1px solid rgba(139,92,246,0.2)',
            display: 'flex', alignItems: 'center', gap: 16,
            transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.4)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.2)'}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 11, flexShrink: 0,
              background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FlaskConical size={20} color="#8B5CF6" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>NL Tests</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Plain-English security checks — SSL, DNS records, security headers, port scanning, CORS, certificate expiry, and more. No code required.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', fontWeight: 600 }}>
                ACTIVE
              </span>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>
          </div>
        </Link>
      </div>

      {/* ── Stats bar ───────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28,
      }}>
        {[
          {
            icon: Activity, label: 'Connected', value: connectedCount,
            color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)',
          },
          {
            icon: ShieldCheck, label: 'Total Checks Available', value: allIntegrations.filter((i) => i.phase === 'available').reduce((s, i) => s + i.checks, 0),
            color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)',
          },
          {
            icon: Clock, label: 'Last Scan', value: loading ? '—' : (
              Object.values(statuses).filter((s) => s.lastSyncAt).sort((a, b) =>
                new Date(b.lastSyncAt!).getTime() - new Date(a.lastSyncAt!).getTime()
              )[0]?.lastSyncAt
                ? new Date(Object.values(statuses).filter((s) => s.lastSyncAt).sort((a, b) =>
                    new Date(b.lastSyncAt!).getTime() - new Date(a.lastSyncAt!).getTime()
                  )[0].lastSyncAt!).toLocaleDateString()
                : 'Never'
            ),
            color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.2)',
          },
        ].map(({ icon: Icon, label, value, color, bg, border }) => (
          <div key={label} style={{
            background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Icon size={18} color={color} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {value}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Scan message ────────────────────────────── */}
      {scanMessage && (
        <div style={{
          marginBottom: 20, padding: '10px 16px', borderRadius: 8,
          background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
          color: '#8B5CF6', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <CheckCircle2 size={14} />
          {scanMessage}
        </div>
      )}

      {/* ── Scan All results bar chart ───────────────── */}
      {scanAllResult && scanAllResult.integrations.length > 0 && (
        <div style={{
          marginBottom: 24, padding: '16px 20px', borderRadius: 12,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Recent Scan Results
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scanAllResult.integrations.map((item) => (
              <div key={item.type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 80, fontSize: 12, color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {item.type}
                </div>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    background: item.status === 'success'
                      ? item.findingsCount > 0
                        ? 'linear-gradient(90deg, #F59E0B, #EF4444)'
                        : 'linear-gradient(90deg, #10B981, #06B6D4)'
                      : item.status === 'error'
                      ? '#EF4444'
                      : 'rgba(255,255,255,0.1)',
                    width: item.status === 'success'
                      ? `${Math.max(10, Math.min(100, (item.findingsCount / 20) * 100 + 10))}%`
                      : item.status === 'error' ? '100%' : '5%',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', width: 70, textAlign: 'right' }}>
                  {item.status === 'success' ? `${item.findingsCount} findings` : item.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Integration categories ───────────────────── */}
      {INTEGRATION_CATALOG.map((category) => (
        <div key={category.category} style={{ marginBottom: 28 }}>
          {/* Category header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <category.icon size={14} color={category.color} />
            <h2 style={{
              fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-muted)',
            }}>
              {category.category}
            </h2>
          </div>

          {/* Cards grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}>
            {category.items.map((item) => {
              const scanInfo = scanAllResult?.integrations.find(i => i.type === item.type)
              return (
                <IntegrationCard
                  key={item.type}
                  {...item}
                  status={loading ? null : (statuses[item.type] ?? null)}
                  onRunScan={(t) => void handleRunScan(t)}
                  scanning={scanning[item.type] ?? false}
                  scanInfo={scanInfo}
                  onScheduleUpdate={handleScheduleUpdate}
                />
              )
            })}
          </div>
        </div>
      ))}

      {/* ── Scan All no results note ─────────────────── */}
      {scanAllResult && scanAllResult.scanned === 0 && (
        <div style={{
          padding: '14px 18px', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, color: 'var(--text-muted)',
        }}>
          <AlertTriangle size={14} />
          No active integrations found. Connect an integration and mark it as active to run scans.
        </div>
      )}

      {/* ── ITSM Integrations ───────────────────────── */}
      <ItsmSection />

      {/* ── Footer note ─────────────────────────────── */}
      <div style={{
        padding: '16px 20px', borderRadius: 10, marginTop: 8,
        background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Lock size={16} color="#06B6D4" />
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          All credentials are encrypted at rest using AES-256-GCM. Integration tokens are stored securely
          and never logged. Read-only API access is sufficient for all security checks.
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
