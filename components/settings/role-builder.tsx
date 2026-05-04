'use client'

import { useState } from 'react'
import { X, ShieldCheck } from 'lucide-react'

interface RoleBuilderProps {
  onSave: (role: { name: string; description: string; permissions: Record<string, string[]> }) => Promise<void>
  onClose: () => void
}

interface PermGroup {
  key: string
  label: string
  actions: { key: string; label: string }[]
}

const PERM_GROUPS: PermGroup[] = [
  {
    key: 'frameworks',
    label: 'Framework & Controls',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
      { key: 'publish', label: 'Publish' },
    ],
  },
  {
    key: 'evidence',
    label: 'Evidence',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'upload', label: 'Upload' },
      { key: 'approve', label: 'Approve' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'findings',
    label: 'Findings',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
      { key: 'accept', label: 'Accept' },
    ],
  },
  {
    key: 'tasks',
    label: 'Tasks',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
      { key: 'assign', label: 'Assign' },
    ],
  },
  {
    key: 'vendors',
    label: 'Vendors',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
      { key: 'risk_assess', label: 'Risk Assess' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'export', label: 'Export' },
    ],
  },
  {
    key: 'users_roles',
    label: 'Users & Roles',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'manage', label: 'Manage' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'edit', label: 'Edit' },
    ],
  },
  {
    key: 'ai_assistant',
    label: 'AI Assistant',
    actions: [
      { key: 'use', label: 'Use' },
    ],
  },
  {
    key: 'audit_log',
    label: 'Audit Log',
    actions: [
      { key: 'view', label: 'View' },
    ],
  },
]

export function RoleBuilder({ onSave, onClose }: RoleBuilderProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {}
    PERM_GROUPS.forEach(g => { init[g.key] = new Set() })
    return init
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggle = (groupKey: string, action: string) => {
    setPermissions(prev => {
      const next = { ...prev }
      const set = new Set(prev[groupKey])
      if (set.has(action)) set.delete(action)
      else set.add(action)
      next[groupKey] = set
      return next
    })
  }

  const selectAll = (groupKey: string) => {
    const group = PERM_GROUPS.find(g => g.key === groupKey)!
    setPermissions(prev => ({
      ...prev,
      [groupKey]: new Set(group.actions.map(a => a.key)),
    }))
  }

  const clearAll = (groupKey: string) => {
    setPermissions(prev => ({ ...prev, [groupKey]: new Set() }))
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Role name is required'); return }
    setSaving(true)
    setError('')
    try {
      const permsRecord: Record<string, string[]> = {}
      Object.entries(permissions).forEach(([k, v]) => {
        permsRecord[k] = Array.from(v)
      })
      await onSave({ name: name.trim(), description: description.trim(), permissions: permsRecord })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save role')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 13,
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#0D1225',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldCheck size={16} color="#8B5CF6" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Create Custom Role</h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {error && (
            <div style={{
              marginBottom: 16, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 12.5, color: '#F87171',
            }}>
              {error}
            </div>
          )}

          {/* Name & Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                Role Name *
              </label>
              <input
                style={inputStyle}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Compliance Lead"
              />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                Description
              </label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: 68, fontFamily: 'inherit' }}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of this role's purpose…"
              />
            </div>
          </div>

          {/* Permission Matrix */}
          <div style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              Permission Matrix
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PERM_GROUPS.map(group => {
                const groupPerms = permissions[group.key]
                const allSelected = group.actions.every(a => groupPerms.has(a.key))
                const anySelected = group.actions.some(a => groupPerms.has(a.key))

                return (
                  <div
                    key={group.key}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 10,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: anySelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {group.label}
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => selectAll(group.key)}
                          style={{
                            fontSize: 10.5, fontWeight: 600, color: '#8B5CF6',
                            background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px',
                            textDecoration: allSelected ? 'none' : 'underline',
                          }}
                        >
                          All
                        </button>
                        <button
                          onClick={() => clearAll(group.key)}
                          style={{
                            fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)',
                            background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px',
                            textDecoration: !anySelected ? 'none' : 'underline',
                          }}
                        >
                          None
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {group.actions.map(action => {
                        const checked = groupPerms.has(action.key)
                        return (
                          <label
                            key={action.key}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                              background: checked ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${checked ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)'}`,
                              transition: 'all 0.15s',
                              fontSize: 11.5, fontWeight: checked ? 600 : 400,
                              color: checked ? '#A78BFA' : 'var(--text-muted)',
                              userSelect: 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(group.key, action.key)}
                              style={{ display: 'none' }}
                            />
                            <span style={{
                              width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                              background: checked ? '#8B5CF6' : 'transparent',
                              border: `1.5px solid ${checked ? '#8B5CF6' : 'rgba(255,255,255,0.2)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {checked && (
                                <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
                                  <path d="M1 2.5L3 4.5L6 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </span>
                            {action.label}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
              border: 'none', color: 'white', cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Role'}
          </button>
        </div>
      </div>
    </div>
  )
}
