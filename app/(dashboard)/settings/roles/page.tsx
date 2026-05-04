'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ShieldCheck, Plus, Trash2, Star } from 'lucide-react'
import { RoleBuilder } from '@/components/settings/role-builder'

interface BuiltInRole {
  id: string
  name: string
  description: string
  isBuiltIn: true
  permissions: Record<string, string[]>
}

interface CustomRole {
  id: string
  name: string
  description: string
  isBuiltIn: false
  permissions: Record<string, string[]>
  createdAt: string
}

type Role = BuiltInRole | CustomRole

const PERM_LABELS: Record<string, string> = {
  frameworks: 'Frameworks',
  evidence: 'Evidence',
  findings: 'Findings',
  tasks: 'Tasks',
  vendors: 'Vendors',
  reports: 'Reports',
  users_roles: 'Users',
  settings: 'Settings',
  ai_assistant: 'AI',
  audit_log: 'Audit',
}

function PermSummary({ permissions }: { permissions: Record<string, string[]> }) {
  if (permissions['*']?.includes('*')) {
    return (
      <span style={{
        fontSize: 10, fontWeight: 600, color: '#8B5CF6',
        background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
        padding: '2px 8px', borderRadius: 100,
      }}>Full Access</span>
    )
  }

  const activeGroups = Object.entries(permissions)
    .filter(([, v]) => v.length > 0)
    .map(([k]) => PERM_LABELS[k] ?? k)
    .slice(0, 4)

  const overflow = Object.entries(permissions).filter(([, v]) => v.length > 0).length - 4

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {activeGroups.map(label => (
        <span
          key={label}
          style={{
            fontSize: 9.5, fontWeight: 600, letterSpacing: '0.04em',
            color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '2px 6px', borderRadius: 100,
          }}
        >{label}</span>
      ))}
      {overflow > 0 && (
        <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>+{overflow} more</span>
      )}
    </div>
  )
}

export default function RolesPage() {
  const router = useRouter()
  const [builtIn, setBuiltIn] = useState<BuiltInRole[]>([])
  const [custom, setCustom] = useState<CustomRole[]>([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/roles')
      const data = await res.json()
      setBuiltIn(data.builtIn ?? [])
      setCustom(data.custom ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const handleCreate = async (role: { name: string; description: string; permissions: Record<string, string[]> }) => {
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error || 'Failed to create role')
    }
    await fetchRoles()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this custom role? Users assigned this role will fall back to viewer.')) return
    setDeleting(id)
    try {
      await fetch(`/api/roles/${id}`, { method: 'DELETE' })
      await fetchRoles()
    } finally {
      setDeleting(null)
    }
  }

  const roleCardStyle: React.CSSProperties = {
    padding: '14px 18px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12, backdropFilter: 'blur(20px)',
    display: 'flex', alignItems: 'flex-start', gap: 14,
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }} className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push('/settings')} className="btn-ghost" style={{ fontSize: 13 }}>
          <ArrowLeft size={14} /> Settings
        </button>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={18} color="#8B5CF6" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
              Roles & Permissions
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {builtIn.length} built-in roles · {custom.length} custom role{custom.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowBuilder(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
            border: 'none', color: 'white', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Create Role
        </button>
      </div>

      {/* Built-in roles */}
      <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
        Built-in Roles
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
        {loading ? (
          [1,2,3,4,5].map(i => (
            <div key={i} style={{ ...roleCardStyle, opacity: 0.4, height: 66 }} />
          ))
        ) : (
          builtIn.map((role: Role) => (
            <div key={role.id} style={roleCardStyle}>
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Star size={14} color="#8B5CF6" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{role.name}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: '#8B5CF6', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                    padding: '2px 6px', borderRadius: 100,
                  }}>Built-in</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 7 }}>{role.description}</p>
                <PermSummary permissions={role.permissions} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, alignSelf: 'center' }}>Read-only</span>
            </div>
          ))
        )}
      </div>

      {/* Custom roles */}
      <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
        Custom Roles
      </h2>

      {!loading && custom.length === 0 && (
        <div style={{
          padding: '32px 20px', borderRadius: 12,
          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
          textAlign: 'center',
        }}>
          <ShieldCheck size={28} color="rgba(139,92,246,0.4)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>No custom roles yet</p>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18 }}>
            Create custom roles with fine-grained permission sets for your org
          </p>
          <button
            onClick={() => setShowBuilder(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
              border: 'none', color: 'white', cursor: 'pointer',
            }}
          >
            <Plus size={13} /> Create First Role
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {custom.map((role: CustomRole) => (
          <div key={role.id} style={roleCardStyle}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldCheck size={14} color="#06B6D4" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{role.name}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: '#06B6D4', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.18)',
                  padding: '2px 6px', borderRadius: 100,
                }}>Custom</span>
              </div>
              {role.description && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 7 }}>{role.description}</p>
              )}
              <PermSummary permissions={role.permissions} />
            </div>
            <button
              onClick={() => handleDelete(role.id)}
              disabled={deleting === role.id}
              style={{
                flexShrink: 0, alignSelf: 'center',
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: 6, color: 'var(--text-muted)',
                opacity: deleting === role.id ? 0.5 : 1,
              }}
              title="Delete role"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {showBuilder && (
        <RoleBuilder
          onSave={handleCreate}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </div>
  )
}
