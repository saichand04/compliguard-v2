'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Target, ShieldOff, Globe, FlaskConical, Server, Satellite,
  MessageSquare, GraduationCap, Users2,
  Cloud, Building2, Cpu,
} from 'lucide-react'
import { broadcastModulesUpdate } from '@/lib/hooks/use-modules'
import type { ModuleToggles } from '@/lib/db/schema/module_config'
import { DEFAULT_MODULE_TOGGLES } from '@/lib/db/schema/module_config'

// ─── Module registry ──────────────────────────────────────────────────────────
// To add a new module: add one entry here + a moduleKey in the sidebar NAV_GROUPS
// and optionally wrap its page with <ModuleGuard moduleKey="..." label="...">

interface ModuleDef {
  key: keyof ModuleToggles
  name: string
  desc: string
  icon: React.ElementType
  color: string
  group: string
}

const MODULES: ModuleDef[] = [
  // ── Security Testing
  { key: 'pentest',       group: 'Security Testing',  name: 'Penetration Testing', desc: 'Track pentest engagements and issues from third-party assessors',           icon: Target,        color: '#ef4444' },
  { key: 'firewallAudit', group: 'Security Testing',  name: 'Firewall Audit',       desc: 'Record and track gaps identified during firewall audits',                   icon: ShieldOff,     color: '#f97316' },
  { key: 'dnsAudit',      group: 'Security Testing',  name: 'DNS Audit',            desc: 'Track issues from external and internal DNS audits',                        icon: Globe,         color: '#3b82f6' },

  // ── Cloud Security
  { key: 'cloudMicrosoft', group: 'Cloud Security',   name: 'Microsoft 365',        desc: 'Entra ID, Intune, Defender, Sentinel, Purview, Compliance Manager, Azure Scan', icon: Building2,  color: '#0ea5e9' },
  { key: 'cloudAWS',       group: 'Cloud Security',   name: 'AWS',                  desc: 'Amazon Web Services security posture, GuardDuty, Security Hub integration', icon: Cloud,         color: '#f59e0b' },
  { key: 'cloudGCP',       group: 'Cloud Security',   name: 'GCP',                  desc: 'Google Cloud Platform Security Command Center and compliance integration',  icon: Cpu,           color: '#10b981' },

  // ── Integrations & AI
  { key: 'nlTests',       group: 'AI & Integrations', name: 'NL Tests',             desc: 'Natural language security tests and automated checks',                      icon: FlaskConical,  color: '#8b5cf6' },
  { key: 'mcpServer',     group: 'AI & Integrations', name: 'MCP Server',           desc: 'Model Context Protocol server for AI integrations',                         icon: Server,        color: '#06b6d4' },
  { key: 'openClaw',      group: 'AI & Integrations', name: 'OpenClaw',             desc: 'OpenClaw AI security analysis integration',                                 icon: Satellite,     color: '#10b981' },
  { key: 'teamsBot',      group: 'AI & Integrations', name: 'Teams Bot',            desc: 'Microsoft Teams bot for compliance notifications',                          icon: MessageSquare, color: '#8b5cf6' },

  // ── Organization
  { key: 'training',      group: 'Organization',       name: 'Training',            desc: 'Security awareness training and tracking',                                  icon: GraduationCap, color: '#f59e0b' },
  { key: 'vendors',       group: 'Organization',       name: 'Vendor Management',   desc: 'Third-party vendor risk assessment and tracking',                           icon: Users2,        color: '#06b6d4' },
]

// ─── Toggle switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ enabled, onChange, loading }: { enabled: boolean; onChange: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={loading}
      aria-pressed={enabled}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: 40,
        height: 22,
        borderRadius: 11,
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        background: enabled ? '#8b5cf6' : 'rgba(255,255,255,0.12)',
        transition: 'background 0.2s ease',
        flexShrink: 0,
        padding: 0,
        outline: 'none',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: enabled ? 21 : 3,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: 'white',
        transition: 'left 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

function SkeletonCard() {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ width: 120, height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
        </div>
        <div style={{ width: 40, height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.06)' }} />
      </div>
      <div style={{ width: '85%', height: 11, borderRadius: 5, background: 'rgba(255,255,255,0.04)' }} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ModuleToggles() {
  const [modules, setModules] = useState<ModuleToggles>(DEFAULT_MODULE_TOGGLES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, 'ok' | 'error'>>({})

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/modules')
      if (res.ok) {
        const data = await res.json()
        const m = { ...DEFAULT_MODULE_TOGGLES, ...(data.modules ?? {}) } as ModuleToggles
        setModules(m)
        broadcastModulesUpdate(m)
      }
    } catch {
      // use defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchModules() }, [fetchModules])

  const handleToggle = async (key: keyof ModuleToggles) => {
    const newValue = !modules[key]
    const optimistic = { ...modules, [key]: newValue }
    setModules(optimistic)
    broadcastModulesUpdate(optimistic) // instant sidebar + page guard update
    setSaving(key)
    setFeedback(prev => { const n = { ...prev }; delete n[key]; return n })

    try {
      const res = await fetch('/api/settings/modules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      })
      if (!res.ok) throw new Error('Failed')
      setFeedback(prev => ({ ...prev, [key]: 'ok' }))
    } catch {
      // revert optimistic update
      const reverted = { ...modules, [key]: !newValue }
      setModules(reverted)
      broadcastModulesUpdate(reverted)
      setFeedback(prev => ({ ...prev, [key]: 'error' }))
    } finally {
      setSaving(null)
      setTimeout(() => {
        setFeedback(prev => { const n = { ...prev }; delete n[key]; return n })
      }, 2000)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {['Security Testing', 'Cloud Security', 'AI & Integrations', 'Organization'].map(g => (
          <div key={g}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>{g}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Group modules by their group label
  const groups = Array.from(new Set(MODULES.map(m => m.group)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {groups.map(group => (
        <div key={group}>
          {/* Group header */}
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: 10,
            paddingBottom: 6,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            {group}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {MODULES.filter(m => m.group === group).map(({ key, name, desc, icon: Icon, color }) => {
              const enabled = modules[key]
              const isSaving = saving === key
              const fb = feedback[key]

              return (
                <div
                  key={key}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: '16px 18px',
                    opacity: enabled ? 1 : 0.6,
                    transition: 'opacity 0.2s ease, border-color 0.2s ease',
                    borderColor: fb === 'ok' ? 'rgba(74,222,128,0.3)' : fb === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: `${color}18`, border: `1px solid ${color}35`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={15} color={color} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {name}
                      </span>
                    </div>
                    <ToggleSwitch enabled={enabled} onChange={() => handleToggle(key)} loading={isSaving} />
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{desc}</p>
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: enabled ? '#8b5cf6' : 'var(--text-muted)', transition: 'color 0.2s' }}>
                      {isSaving ? 'Saving…' : fb === 'ok' ? 'Saved' : fb === 'error' ? 'Error' : enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    {fb === 'ok' && <span style={{ fontSize: 10, color: '#4ade80' }}>✓</span>}
                    {fb === 'error' && <span style={{ fontSize: 10, color: '#ef4444' }}>✗ Failed to save</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
