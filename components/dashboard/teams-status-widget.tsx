'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, CheckCircle, XCircle, ArrowRight, Wifi, WifiOff } from 'lucide-react'
import Link from 'next/link'

interface TeamsWidgetData {
  configured: boolean
  activeConversations: number
  lastNotificationAt: string | null
  lastDigestAt: string | null
}

export function TeamsStatusWidget() {
  const [data, setData] = useState<TeamsWidgetData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [configRes, statsRes, digestRes] = await Promise.all([
          fetch('/api/teams/config'),
          fetch('/api/teams/conversations/stats'),
          fetch('/api/teams/digest'),
        ])

        let configured = false
        let activeConversations = 0
        let lastDigestAt: string | null = null

        if (configRes.ok) {
          const d = await configRes.json() as { connected?: boolean }
          configured = d.connected ?? false
        }
        if (statsRes.ok) {
          const d = await statsRes.json() as { active?: number }
          activeConversations = d.active ?? 0
        }
        if (digestRes.ok) {
          const d = await digestRes.json() as { lastSentAt?: string | null }
          lastDigestAt = d.lastSentAt ?? null
        }

        setData({
          configured,
          activeConversations,
          lastNotificationAt: null, // not tracked separately; could come from audit log
          lastDigestAt,
        })
      } catch {
        // fail silently — widget is non-critical
        setData({ configured: false, activeConversations: 0, lastNotificationAt: null, lastDigestAt: null })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Don't render if bot is not configured (no BOT_APP_ID equivalent at client)
  // We still try to show something minimal even if unconfigured

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageSquare size={13} color="#8B5CF6" />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Teams Bot
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    )
  }

  const isConnected = data?.configured ?? false
  const conversations = data?.activeConversations ?? 0

  return (
    <Link
      href="/settings/teams-bot"
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${isConnected ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 14,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
      }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.background = 'rgba(255,255,255,0.06)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.background = 'rgba(255,255,255,0.04)'
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: isConnected ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${isConnected ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.1)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MessageSquare size={13} color={isConnected ? '#8B5CF6' : 'var(--text-muted)'} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Teams Bot
            </span>
          </div>
          <ArrowRight size={13} color="var(--text-muted)" />
        </div>

        {/* Status + conversations */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {isConnected
              ? <CheckCircle size={13} color="#4ADE80" />
              : <XCircle size={13} color="#F87171" />}
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: isConnected ? '#4ADE80' : '#F87171',
            }}>
              {isConnected ? 'Connected' : 'Not configured'}
            </span>
          </div>
          {isConnected && (
            <div style={{
              fontSize: 11, color: 'var(--text-muted)',
              padding: '2px 8px', borderRadius: 20,
              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
            }}>
              {conversations} active
            </div>
          )}
        </div>

        {/* Last digest */}
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          {data?.lastDigestAt ? (
            <>
              {isConnected ? <Wifi size={10} style={{ display: 'inline', marginRight: 4 }} /> : null}
              Last digest:{' '}
              {new Date(data.lastDigestAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </>
          ) : isConnected ? (
            <span style={{ color: 'var(--text-muted)' }}>No digest sent yet</span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>
              <WifiOff size={10} style={{ display: 'inline', marginRight: 4 }} />
              Configure in Settings
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
