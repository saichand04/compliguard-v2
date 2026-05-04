'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Search, ChevronDown, Check } from 'lucide-react'

interface UserRow {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  role: string
}

interface RoleOption {
  id: string
  name: string
  isBuiltIn?: boolean
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#8B5CF6',
  admin: '#8B5CF6',
  compliance_manager: '#06B6D4',
  auditor: '#10B981',
  user: '#6B7280',
}

function getRoleColor(role: string): string {
  return ROLE_COLORS[role] ?? '#06B6D4'
}

function RoleDropdown({
  userId,
  currentRole,
  roles,
  onAssign,
}: {
  userId: string
  currentRole: string
  roles: RoleOption[]
  onAssign: (userId: string, roleId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const currentRoleObj = roles.find(r => r.id === currentRole)
  const label = currentRoleObj?.name ?? currentRole.replace(/_/g, ' ')
  const color = getRoleColor(currentRole)

  const handleSelect = async (roleId: string) => {
    setOpen(false)
    if (roleId === currentRole) return
    setSaving(true)
    try {
      await onAssign(userId, roleId)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={saving}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
          background: `${color}15`, border: `1px solid ${color}30`,
          color: color, cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1, whiteSpace: 'nowrap',
        }}
      >
        {saving ? '…' : label}
        <ChevronDown size={11} />
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 4,
              background: '#0D1225', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              minWidth: 180, zIndex: 20, overflow: 'hidden',
            }}
          >
            {roles.map(role => (
              <button
                key={role.id}
                onClick={() => handleSelect(role.id)}
                style={{
                  width: '100%', padding: '9px 14px', textAlign: 'left',
                  background: role.id === currentRole ? 'rgba(139,92,246,0.1)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: role.id === currentRole ? 600 : 400,
                  color: role.id === currentRole ? '#A78BFA' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => {
                  if (role.id !== currentRole) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                }}
                onMouseLeave={e => {
                  if (role.id !== currentRole) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span>{role.name}</span>
                {role.id === currentRole && <Check size={12} color="#8B5CF6" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function UsersSettingsPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/roles'),
      ])
      const usersData = await usersRes.json()
      const rolesData = await rolesRes.json()

      setUsers(usersData.users ?? [])

      // Combine built-in + custom into flat list for dropdown
      const allRoles: RoleOption[] = [
        ...(rolesData.builtIn ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name, isBuiltIn: true })),
        ...(rolesData.custom ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name, isBuiltIn: false })),
      ]
      setRoles(allRoles)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAssignRole = async (userId: string, roleId: string) => {
    const res = await fetch(`/api/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: roleId }),
    })
    if (!res.ok) {
      const d = await res.json()
      setToast(d.error || 'Failed to assign role')
      setTimeout(() => setToast(''), 3000)
      return
    }
    // Optimistic update
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: roleId } : u))
    setToast('Role updated')
    setTimeout(() => setToast(''), 2000)
  }

  const filtered = search
    ? users.filter(u => {
        const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase()
        return name.includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
      })
    : users

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }} className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push('/settings')} className="btn-ghost" style={{ fontSize: 13 }}>
          <ArrowLeft size={14} /> Settings
        </button>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Users size={18} color="#06B6D4" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
              Users & Roles
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {users.length} member{users.length !== 1 ? 's' : ''} in your organization
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push('/settings/roles')}
          style={{
            fontSize: 13, fontWeight: 600, color: '#8B5CF6', padding: '8px 14px', borderRadius: 8,
            background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
            cursor: 'pointer', textDecoration: 'none',
          }}
        >
          Manage Roles →
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users by name or email…"
          style={{
            width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr auto',
          padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          {['Member', 'Email', 'Role'].map(col => (
            <span key={col} style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {col}
            </span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {search ? 'No users match your search' : 'No users found'}
          </div>
        ) : (
          filtered.map((user, i) => {
            const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || null
            return (
              <div
                key={user.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr auto',
                  padding: '12px 18px', alignItems: 'center',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                {/* Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#8B5CF6',
                  }}>
                    {fullName
                      ? fullName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                      : user.email[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {fullName ?? '—'}
                  </span>
                </div>

                {/* Email */}
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </span>

                {/* Role dropdown */}
                <RoleDropdown
                  userId={user.id}
                  currentRole={user.role}
                  roles={roles}
                  onAssign={handleAssignRole}
                />
              </div>
            )
          })
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          padding: '10px 18px', borderRadius: 10,
          background: toast.includes('Failed') ? 'rgba(239,68,68,0.9)' : 'rgba(16,185,129,0.9)',
          color: 'white', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          animation: 'fade-in 0.2s ease',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
