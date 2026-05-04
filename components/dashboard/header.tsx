'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, ChevronDown, LogOut, Settings, User, Search, Command, CheckCheck } from 'lucide-react'

interface HeaderProps {
  firstName: string
  lastName: string
  email: string
  role: string
}

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  isRead: boolean
  createdAt: string
}

const ROLE_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  super_admin:  { label: 'Super Admin',  color: '#C4B5FD', bg: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.30)' },
  admin:        { label: 'Admin',        color: '#C4B5FD', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.25)' },
  auditor:      { label: 'Auditor',      color: '#67E8F9', bg: 'rgba(6,182,212,0.18)',  border: 'rgba(6,182,212,0.30)' },
  contributor:  { label: 'Contributor',  color: '#6EE7B7', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.25)' },
  viewer:       { label: 'Viewer',       color: '#94A3B8', bg: 'rgba(148,163,184,0.12)',border: 'rgba(148,163,184,0.20)' },
}

const TYPE_COLORS: Record<string, string> = {
  control_overdue:   'var(--amber)',
  evidence_rejected: 'var(--rose)',
  evidence_approved: 'var(--emerald)',
  evidence_request:  '#67E8F9',
  new_finding:       'var(--rose)',
  policy_expiry:     'var(--amber)',
  task_assigned:     'var(--violet)',
  task_overdue:      'var(--rose)',
  risk_identified:   'var(--rose)',
  vendor_review_due: 'var(--amber)',
  system:            'var(--cyan)',
  mention:           'var(--violet)',
  invite:            'var(--emerald)',
}

function getTypeColor(type: string) {
  return TYPE_COLORS[type] ?? 'var(--cyan)'
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
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

  // Real notifications state
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {
      // silent — don't break the header
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const markAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setMarkingAll(true)
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } finally {
      setMarkingAll(false)
    }
  }

  const handleNotifClick = async (n: Notification) => {
    if (!n.isRead) {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [n.id] }),
      })
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x))
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    setNotifOpen(false)
    if (n.link) router.push(n.link)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/signin')
  }

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || email.charAt(0).toUpperCase()
  const roleBadge = ROLE_BADGE[role] || ROLE_BADGE['viewer']

  // Last 5 notifications for dropdown
  const dropdownNotifs = notifications.slice(0, 5)

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
          {unreadCount > 0 && (
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
                width: 340,
                borderRadius: 'var(--radius-lg)',
                zIndex: 50,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>Notifications</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {unreadCount > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 99,
                          background: 'rgba(239,68,68,0.15)',
                          color: '#F87171',
                          border: '1px solid rgba(239,68,68,0.30)',
                        }}
                      >
                        {unreadCount} new
                      </span>
                    )}
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        disabled={markingAll}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          padding: 0,
                          fontFamily: 'Inter, sans-serif',
                          transition: 'color 0.12s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--violet)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        title="Mark all as read"
                      >
                        <CheckCheck size={12} />
                        {markingAll ? '…' : 'All read'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Notification items */}
              {dropdownNotifs.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                  No notifications yet
                </div>
              ) : (
                dropdownNotifs.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    style={{
                      padding: '11px 16px',
                      borderBottom: '1px solid var(--border-glass)',
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                      background: !n.isRead ? 'rgba(139,92,246,0.04)' : undefined,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = !n.isRead ? 'rgba(139,92,246,0.04)' : '')}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: getTypeColor(n.type),
                          marginTop: 5,
                          flexShrink: 0,
                          boxShadow: !n.isRead ? `0 0 6px ${getTypeColor(n.type)}` : 'none',
                          opacity: n.isRead ? 0.4 : 1,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: n.isRead ? 400 : 500,
                            color: n.isRead ? 'var(--text-muted)' : 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {n.title}
                        </div>
                        {n.body && (
                          <div
                            style={{
                              fontSize: 11.5,
                              color: 'var(--text-muted)',
                              marginTop: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {n.body}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}

              {/* Footer */}
              <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                <button
                  onClick={() => { setNotifOpen(false); router.push('/notifications') }}
                  style={{
                    fontSize: 12,
                    color: 'var(--violet)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    margin: '0 auto',
                    transition: 'opacity 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  View all notifications →
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
