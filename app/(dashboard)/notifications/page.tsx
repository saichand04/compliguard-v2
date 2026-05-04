'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, Shield, ExternalLink, CheckCheck, Circle,
  AlertTriangle, CheckCircle, XCircle, AtSign, Info,
  Zap, Clock, FileText, Users, AlertCircle,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
  metadata?: Record<string, unknown> | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TYPE_META: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  control_overdue:    { color: 'var(--amber)',   icon: AlertTriangle,  label: 'Control Overdue' },
  evidence_rejected:  { color: 'var(--rose)',    icon: XCircle,        label: 'Evidence Rejected' },
  evidence_approved:  { color: 'var(--emerald)', icon: CheckCircle,    label: 'Evidence Approved' },
  evidence_request:   { color: '#67E8F9',        icon: FileText,       label: 'Evidence Request' },
  new_finding:        { color: 'var(--rose)',    icon: AlertCircle,    label: 'New Finding' },
  policy_expiry:      { color: 'var(--amber)',   icon: Clock,          label: 'Policy Expiry' },
  task_assigned:      { color: 'var(--violet)',  icon: CheckCheck,     label: 'Task Assigned' },
  task_overdue:       { color: 'var(--rose)',    icon: Clock,          label: 'Task Overdue' },
  risk_identified:    { color: 'var(--rose)',    icon: AlertTriangle,  label: 'Risk Identified' },
  vendor_review_due:  { color: 'var(--amber)',   icon: Users,          label: 'Vendor Review Due' },
  system:             { color: 'var(--cyan)',    icon: Info,           label: 'System' },
  mention:            { color: 'var(--violet)',  icon: AtSign,         label: 'Mention' },
  invite:             { color: 'var(--emerald)', icon: Zap,            label: 'Invite' },
}

function getTypeMeta(type: string) {
  return TYPE_META[type] ?? { color: 'var(--cyan)', icon: Bell, label: type }
}

type FilterTab = 'all' | 'unread' | 'mentions' | 'system'

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    )
    setUnreadCount((c) => Math.max(0, c - 1))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
  }

  const markAllAsRead = async () => {
    setMarkingAll(true)
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      )
      setUnreadCount(0)
    } finally {
      setMarkingAll(false)
    }
  }

  const handleClick = async (n: Notification) => {
    if (!n.isRead) await markAsRead(n.id)
    if (n.link) router.push(n.link)
  }

  // Client-side filter
  const filtered = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.isRead
    if (activeTab === 'mentions') return n.type === 'mention'
    if (activeTab === 'system') return n.type === 'system'
    return true
  })

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'all',      label: 'All' },
    { id: 'unread',   label: 'Unread' },
    { id: 'mentions', label: 'Mentions' },
    { id: 'system',   label: 'System' },
  ]

  return (
    <div
      className="animate-fade-in"
      style={{
        height: 'calc(100vh - 56px)',
        overflowY: 'auto',
        padding: '24px 28px',
        maxWidth: 780,
        margin: '0 auto',
      }}
    >
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: 'rgba(239,68,68,0.15)',
                  color: '#F87171',
                  border: '1px solid rgba(239,68,68,0.30)',
                }}
              >
                {unreadCount} unread
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Stay on top of compliance events, evidence requests, and team activity.
          </p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {unreadCount > 0 && (
            <button
              className="btn-ghost"
              onClick={markAllAsRead}
              disabled={markingAll}
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <CheckCheck size={13} />
              {markingAll ? 'Marking…' : 'Mark all as read'}
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          marginBottom: 20,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border-glass)',
          borderRadius: 10,
          padding: 4,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '6px 14px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 500,
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.15s',
              background: activeTab === tab.id ? 'rgba(139,92,246,0.18)' : 'transparent',
              color: activeTab === tab.id ? 'var(--violet)' : 'var(--text-muted)',
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            {tab.label}
            {tab.id === 'unread' && unreadCount > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 99,
                  background: 'rgba(139,92,246,0.25)',
                  color: 'var(--violet)',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="glass-card"
              style={{
                height: 72,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.03)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        /* Empty state */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              background: 'var(--violet-dim)',
              border: '1px solid rgba(139,92,246,0.20)',
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
            }}
          >
            <Shield size={28} style={{ color: 'var(--violet)' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            All caught up
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 300 }}>
            {activeTab === 'unread'
              ? 'No unread notifications. You\'re on top of everything.'
              : activeTab === 'mentions'
              ? 'No mentions yet. Team members can @mention you in comments.'
              : activeTab === 'system'
              ? 'No system notifications at this time.'
              : 'No notifications yet. They\'ll appear here when activity happens.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((n, idx) => {
            const meta = getTypeMeta(n.type)
            const IconComp = meta.icon
            return (
              <div
                key={n.id}
                className="animate-fade-up"
                style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'both' }}
              >
                <div
                  className="glass-card"
                  onClick={() => handleClick(n)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    padding: '14px 16px',
                    borderRadius: 12,
                    cursor: n.link || !n.isRead ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                    borderLeft: !n.isRead ? `3px solid ${meta.color}` : '3px solid transparent',
                    background: !n.isRead
                      ? `linear-gradient(135deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.02) 100%)`
                      : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (n.link || !n.isRead) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = !n.isRead
                      ? 'linear-gradient(135deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.02) 100%)'
                      : ''
                  }}
                >
                  {/* Type icon */}
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: `${meta.color}1A`,
                      border: `1px solid ${meta.color}33`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    <IconComp size={14} style={{ color: meta.color }} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
                      <span
                        style={{
                          fontSize: 13.5,
                          fontWeight: n.isRead ? 400 : 600,
                          color: n.isRead ? 'var(--text-secondary)' : 'var(--text-primary)',
                          lineHeight: 1.35,
                          flex: 1,
                        }}
                      >
                        {n.title}
                      </span>
                      {/* Unread indicator dot */}
                      {!n.isRead && (
                        <div
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: meta.color,
                            boxShadow: `0 0 6px ${meta.color}80`,
                            flexShrink: 0,
                            marginTop: 5,
                          }}
                        />
                      )}
                    </div>
                    {n.body && (
                      <p
                        style={{
                          fontSize: 12.5,
                          color: 'var(--text-muted)',
                          margin: '0 0 5px',
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {n.body}
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: 99,
                          background: `${meta.color}1A`,
                          color: meta.color,
                          border: `1px solid ${meta.color}33`,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {meta.label}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Link icon */}
                  {n.link && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!n.isRead) markAsRead(n.id)
                        router.push(n.link!)
                      }}
                      className="btn-icon"
                      style={{ flexShrink: 0, opacity: 0.7 }}
                      title="Open link"
                    >
                      <ExternalLink size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
