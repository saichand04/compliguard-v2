'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Target, ShieldOff, Globe, FlaskConical, Server, Satellite,
  MessageSquare, GraduationCap, Users2,
} from 'lucide-react'

interface ModuleConfig {
  pentest: boolean
  firewallAudit: boolean
  dnsAudit: boolean
  nlTests: boolean
  mcpServer: boolean
  openClaw: boolean
  teamsBot: boolean
  training: boolean
  vendors: boolean
}

const MODULES: {
  key: keyof ModuleConfig
  name: string
  desc: string
  icon: React.ElementType
  color: string
}[] = [
  { key: 'pentest',       name: 'Penetration Testing', desc: 'Track pentest engagements and issues from third-party assessors',              icon: Target,        color: '#ef4444' },
  { key: 'firewallAudit', name: 'Firewall Audit',       desc: 'Record and track gaps identified during firewall audits',                      icon: ShieldOff,     color: '#f97316' },
  { key: 'dnsAudit',      name: 'DNS Audit',            desc: 'Track issues from external and internal DNS audits',                           icon: Globe,         color: '#3b82f6' },
  { key: 'nlTests',       name: 'NL Tests',             desc: 'Natural language security tests and automated checks',                         icon: FlaskConical,  color: '#8b5cf6' },
  { key: 'mcpServer',     name: 'MCP Server',           desc: 'Model Context Protocol server for AI integrations',                            icon: Server,        color: '#06b6d4' },
  { key: 'openClaw',      name: 'OpenClaw',             desc: 'OpenClaw AI security analysis integration',                                    icon: Satellite,     color: '#10b981' },
  { key: 'teamsBot',      name: 'Teams Bot',            desc: 'Microsoft Teams bot for compliance notifications',                             icon: MessageSquare, color: '#8b5cf6' },
  { key: 'training',      name: 'Training',             desc: 'Security awareness training and tracking',                                     icon: GraduationCap, color: '#f59e0b' },
  { key: 'vendors',       name: 'Vendor Management',    desc: 'Third-party vendor risk assessment and tracking',                              icon: Users2,        color: '#06b6d4' },
]

const DEFAULT_MODULES: ModuleConfig = {
  pentest: true,
  firewallAudit: true,
  dnsAudit: true,
  nlTests: true,
  mcpServer: true,
  openClaw: true,
  teamsBot: true,
  training: true,
  vendors: true,
}

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
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: enabled ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'white',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  )
}

function SkeletonCard() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '16px 18px',
    }}>
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

export function ModuleToggles() {
  const [modules, setModules] = useState<ModuleConfig>(DEFAULT_MODULES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, 'ok' | 'error'>>({})

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/modules')
      if (res.ok) {
        const data = await res.json()
        setModules({ ...DEFAULT_MODULES, ...(data.modules ?? {}) })
      }
    } catch {
      // use defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchModules() }, [fetchModules])

  const handleToggle = async (key: keyof ModuleConfig) => {
    const newValue = !modules[key]
    setModules(prev => ({ ...prev, [key]: newValue }))
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
      // revert
      setModules(prev => ({ ...prev, [key]: !newValue }))
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
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 12,
      }}>
        {MODULES.map(m => <SkeletonCard key={m.key} />)}
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 12,
    }}>
      {MODULES.map(({ key, name, desc, icon: Icon, color }) => {
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
              opacity: enabled ? 1 : 0.65,
              transition: 'opacity 0.2s ease, border-color 0.2s ease',
              borderColor: fb === 'ok' ? 'rgba(74,222,128,0.3)' : fb === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: `${color}18`, border: `1px solid ${color}35`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={15} color={color} />
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {name}
                </span>
              </div>
              <ToggleSwitch enabled={enabled} onChange={() => handleToggle(key)} loading={isSaving} />
            </div>

            {/* Description */}
            <p style={{
              fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0,
            }}>
              {desc}
            </p>

            {/* Status label */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
                color: enabled ? '#8b5cf6' : 'var(--text-muted)',
                transition: 'color 0.2s',
              }}>
                {isSaving ? 'Saving…' : fb === 'ok' ? 'Saved' : fb === 'error' ? 'Error' : enabled ? 'Enabled' : 'Disabled'}
              </span>
              {fb === 'ok' && (
                <span style={{ fontSize: 10, color: '#4ade80' }}>✓</span>
              )}
              {fb === 'error' && (
                <span style={{ fontSize: 10, color: '#ef4444' }}>✗ Failed to save</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
