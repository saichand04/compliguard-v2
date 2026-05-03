'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, ChevronDown, LogOut, Settings, User, Search, Command } from 'lucide-react'

interface HeaderProps {
  firstName: string
  lastName: string
  email: string
  role: string
}

const ROLE_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  super_admin:  { label: 'Super Admin',  color: '#C4B5FD', bg: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.30)' },
  admin:        { label: 'Admin',        color: '#C4B5FD', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.25)' },
  auditor:      { label: 'Auditor',      color: '#67E8F9', bg: 'rgba(6,182,212,0.18)',  border: 'rgba(6,182,212,0.30)' },
  contributor:  { label: 'Contributor',  color: '#6EE7B7', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.25)' },
  viewer:       { label: 'Viewer',       color: '#94A3B8', bg: 'rgba(148,163,184,0.12)',border: 'rgba(148,163,184,0.20)' },
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Dashboard</span>

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {segments.map((seg, i) => {
        const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')
        const isLast = i === segments.length - 1
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>/</span>}
            <span style={{
              fontSize: 13.5,
              fontWeight: isLast ? 600 : 400,
              color: isLast ? 'var(--text-primary)' : 'var(--text-muted)',
            }}>
              {label}
            </span>
          </span>
        )
      })}
    </nav>
  )
}

export function DashboardHeader({ firstName, lastName, email, role }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notificationCount = 3 // demo value

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/signin')
  }

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || email.charAt(0).toUpperCase()
  const roleBadge = ROLE_BADGE[role] || ROLE_BADGE['viewer']

  return (
    <header
      className="glass-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 20px',
        height: 56,
        flexShrink: 0,
        zIndex: 20,
        position: 'relative',
      }}
    >
      {/* Breadcrumb */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Breadcrumb pathname={pathname} />
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 11,
            color: searchFocused ? 'var(--violet)' : 'var(--text-muted)',
            transition: 'color 0.15s',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          placeholder="Search controls, frameworks…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            background: searchFocused ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${searchFocused ? 'var(--border-active)' : 'var(--border-glass)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '6px 36px 6px 32px',
            fontSize: 13,
            color: 'var(--text-secondary)',
            outline: 'none',
            width: 220,
            transition: 'all 0.15s ease',
            fontFamily: 'Inter, sans-serif',
          }}
        />
        <div style={{
          position: 'absolute',
          right: 9,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid var(--border-glass)',
          borderRadius: 4,
          padding: '1px 5px',
        }}>
          <Command size={9} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>K</span>
        </div>
      </div>

      {/* Notification bell */}
      <div style={{ position: 'relative' }}>
        <button
          className="btn-icon"
          onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false) }}
          style={{ position: 'relative' }}
        >
          <Bell size={16} />
          {notificationCount > 0 && (
            <span style={{
              position: 'absolute',
              top: 5,
              right: 5,
              width: 7,
              height: 7,
              background: 'var(--rose)',
              borderRadius: '50%',
              border: '1.5px solid var(--bg-base)',
              animation: 'pulse-dot 2s infinite',
            }} />
          )}
        </button>

        {notifOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setNotifOpen(false)} />
            <div
              className="glass-strong animate-scale-in"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                width: 320,
                borderRadius: 'var(--radius-lg)',
                zIndex: 50,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>Notifications</span>
                  <span className="badge badge-rose">{notificationCount} new</span>
                </div>
              </div>
              {[
                { title: 'Evidence due in 3 days', desc: 'AC-2 — Access Management', color: 'var(--amber)', time: '2h ago' },
                { title: 'New control mapping available', desc: 'HITRUST ↔ NIST 800-53 AC-2', color: 'var(--violet)', time: '5h ago' },
                { title: 'Risk review required', desc: 'High severity — Data Exposure', color: 'var(--rose)', time: '1d ago' },
              ].map((n, i) => (
                <div key={i} style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-glass)',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.color, marginTop: 5, flexShrink: 0, boxShadow: `0 0 6px ${n.color}` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{n.desc}</div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{n.time}</span>
                  </div>
                </div>
              ))}
              <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                <button style={{ fontSize: 12, color: 'var(--violet)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  View all notifications
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* User menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false) }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: userMenuOpen ? 'var(--bg-surface-hover)' : 'transparent',
            border: `1px solid ${userMenuOpen ? 'var(--border-glass-strong)' : 'transparent'}`,
            borderRadius: 'var(--radius-md)',
            padding: '5px 10px 5px 5px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {/* Avatar */}
          <div style={{
            width: 28,
            height: 28,
            background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: 'white',
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-secondary)' }} className="hidden sm:block">
            {firstName || email.split('@')[0]}
          </span>
          <ChevronDown size={13} style={{ color: 'var(--text-muted)', transition: 'transform 0.15s', transform: userMenuOpen ? 'rotate(180deg)' : 'none' }} />
        </button>

        {userMenuOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setUserMenuOpen(false)} />
            <div
              className="glass-strong animate-scale-in"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                width: 220,
                borderRadius: 'var(--radius-lg)',
                zIndex: 50,
                overflow: 'hidden',
              }}
            >
              {/* User info */}
              <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'white',
                    flexShrink: 0,
                  }}>
                    {initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {firstName} {lastName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 99,
                    background: roleBadge.bg,
                    color: roleBadge.color,
                    border: `1px solid ${roleBadge.border}`,
                    letterSpacing: '0.03em',
                  }}>
                    {roleBadge.label}
                  </span>
                </div>
              </div>

              {/* Menu items */}
              {[
                { icon: User, label: 'My Profile', href: '/profile' },
                { icon: Settings, label: 'Settings', href: '/settings' },
              ].map(({ icon: Icon, label, href }) => (
                <button
                  key={href}
                  onClick={() => { setUserMenuOpen(false); router.push(href) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '9px 14px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    fontSize: 13.5,
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.12s',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--border-glass)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-secondary)' }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}

              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '9px 14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--rose)',
                  fontSize: 13.5,
                  fontFamily: 'Inter, sans-serif',
                  transition: 'background 0.12s',
                  textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--rose-dim)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
