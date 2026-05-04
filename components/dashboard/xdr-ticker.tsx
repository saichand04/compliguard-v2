'use client'

/**
 * components/dashboard/xdr-ticker.tsx
 * Live XDR alert ticker — connects to /api/integrations/xdr-relay SSE stream.
 * Shows real-time Sentinel incidents and Defender alerts as they arrive.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { Shield, Zap, AlertTriangle, Activity, ChevronRight, Wifi, WifiOff } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MitreChip {
  techniqueId: string
  techniqueName: string
  tacticName: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

interface TickerIncident {
  type: 'incident'
  isNew: boolean
  data: {
    id: string
    title: string
    severity: string
    status: string
    tactics: string[]
    assignedTo?: string
    createdAt?: string
    lastModifiedAt?: string
  }
  mitre: MitreChip[]
  timestamp: string
}

interface TickerAlert {
  type: 'alert'
  data: {
    id: string
    title: string
    severity: string
    status: string
    category: string
    detectionSource?: string
    createdDateTime?: string
  }
  timestamp: string
}

interface StatusEvent {
  type: 'status'
  connected: boolean
  message: string
  timestamp: string
}

interface HeartbeatEvent {
  type: 'heartbeat'
  timestamp: string
}

interface ErrorEvent {
  type: 'error'
  message: string
  timestamp: string
}

type SSEEvent = TickerIncident | TickerAlert | StatusEvent | HeartbeatEvent | ErrorEvent

type TickerItem = {
  id: string
  kind: 'incident' | 'alert'
  title: string
  severity: string
  time: string
  tactic?: string
  techniqueId?: string
  isNew: boolean
  animating: boolean
}

// ── Severity colors ────────────────────────────────────────────────────────────

function severityColor(sev: string): string {
  const s = sev.toLowerCase()
  if (s === 'critical') return 'var(--rose, #f43f5e)'
  if (s === 'high') return 'var(--amber, #f59e0b)'
  if (s === 'medium') return 'var(--violet, #8B5CF6)'
  if (s === 'low') return 'var(--cyan, #06B6D4)'
  return 'var(--text-muted, #6b7280)'
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function XDRTicker() {
  const [items, setItems] = useState<TickerItem[]>([])
  const [connected, setConnected] = useState<boolean | null>(null)
  const [xdrEnabled, setXdrEnabled] = useState<boolean | null>(null)
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const mountedRef = useRef(true)

  const addItem = useCallback((item: TickerItem) => {
    setItems((prev) => {
      // Deduplicate by id
      const filtered = prev.filter((p) => p.id !== item.id)
      // Add new item at top, limit to 20
      return [item, ...filtered].slice(0, 20)
    })

    // Remove animation class after 600ms
    setTimeout(() => {
      if (!mountedRef.current) return
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, animating: false } : p)),
      )
    }, 600)
  }, [])

  useEffect(() => {
    mountedRef.current = true

    function connect() {
      if (!mountedRef.current) return
      if (esRef.current) esRef.current.close()

      const es = new EventSource('/api/integrations/xdr-relay')
      esRef.current = es

      es.onopen = () => {
        if (mountedRef.current) setConnected(true)
      }

      es.onmessage = (e) => {
        if (!mountedRef.current) return
        try {
          const event: SSEEvent = JSON.parse(e.data as string)

          if (event.type === 'heartbeat') {
            setLastHeartbeat(new Date((event as HeartbeatEvent).timestamp))
            return
          }

          if (event.type === 'status') {
            const se = event as StatusEvent
            setConnected(se.connected)
            setXdrEnabled(se.connected)
            return
          }

          if (event.type === 'error') {
            return
          }

          if (event.type === 'incident') {
            const ie = event as TickerIncident
            const primaryMitre = ie.mitre[0]
            addItem({
              id: `incident-${ie.data.id}`,
              kind: 'incident',
              title: ie.data.title,
              severity: ie.data.severity,
              time: formatRelativeTime(ie.timestamp),
              tactic: primaryMitre?.tacticName ?? ie.data.tactics[0],
              techniqueId: primaryMitre?.techniqueId,
              isNew: ie.isNew,
              animating: true,
            })
          } else if (event.type === 'alert') {
            const ae = event as TickerAlert
            addItem({
              id: `alert-${ae.data.id}`,
              kind: 'alert',
              title: ae.data.title,
              severity: ae.data.severity,
              time: formatRelativeTime(ae.timestamp),
              tactic: ae.data.category,
              isNew: true,
              animating: true,
            })
          }
        } catch {
          // Malformed event — ignore
        }
      }

      es.onerror = () => {
        if (!mountedRef.current) return
        setConnected(false)
        es.close()
        // Reconnect after 10s
        setTimeout(() => {
          if (mountedRef.current) connect()
        }, 10_000)
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      esRef.current?.close()
    }
  }, [addItem])

  // ── Render ─────────────────────────────────────────────────────────────────

  const isConnected = connected === true
  const notConfigured = xdrEnabled === false

  return (
    <div
      className="glass-card animate-fade-up delay-200"
      style={{ padding: '14px 16px' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 26, height: 26,
          background: 'rgba(139,92,246,0.12)',
          border: '1px solid rgba(139,92,246,0.25)',
          borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Shield size={12} style={{ color: '#8B5CF6' }} />
        </div>

        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          XDR Live Feed
        </span>

        {/* Connection status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isConnected ? (
            <>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 5px #10b981',
                animation: 'pulse 2s ease-in-out infinite',
              }} />
              <Wifi size={11} style={{ color: '#10b981' }} />
            </>
          ) : (
            <WifiOff size={11} style={{ color: 'var(--text-muted)' }} />
          )}
        </div>

        <Link
          href="/integrations/sentinel"
          style={{
            fontSize: 11, color: '#8B5CF6',
            textDecoration: 'none',
            marginLeft: 4,
            display: 'flex', alignItems: 'center', gap: 2,
          }}
        >
          Configure <ChevronRight size={10} />
        </Link>
      </div>

      {/* Ticker body */}
      <div style={{
        height: 240,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        {notConfigured || (!isConnected && items.length === 0) ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 10,
            textAlign: 'center',
            padding: '0 12px',
          }}>
            <div style={{
              width: 36, height: 36,
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.15)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity size={16} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 3 }}>
                Connect XDR to see live alerts
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                Configure Sentinel &amp; Defender to stream real-time incidents.
              </div>
            </div>
            <Link
              href="/integrations/sentinel"
              style={{
                fontSize: 12,
                padding: '6px 12px',
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.30)',
                borderRadius: 8,
                color: '#8B5CF6',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Shield size={11} />
              Configure XDR
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 8,
          }}>
            <Zap size={18} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Waiting for incidents...
            </span>
            {lastHeartbeat && (
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', opacity: 0.7 }}>
                Last check: {formatRelativeTime(lastHeartbeat.toISOString())}
              </span>
            )}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                gap: 8,
                padding: '7px 9px',
                borderRadius: 8,
                background: item.animating
                  ? `${severityColor(item.severity)}0d`
                  : 'rgba(255,255,255,0.02)',
                border: `1px solid ${severityColor(item.severity)}20`,
                transition: 'background 0.4s ease, transform 0.3s ease',
                transform: item.animating ? 'translateY(0)' : 'none',
                animation: item.animating ? 'slideDown 0.3s ease' : 'none',
                flexShrink: 0,
              }}
            >
              {/* Severity dot */}
              <div style={{
                width: 6, height: 6,
                borderRadius: '50%',
                background: severityColor(item.severity),
                boxShadow: `0 0 4px ${severityColor(item.severity)}`,
                marginTop: 5,
                flexShrink: 0,
              }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title */}
                <div style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 2,
                }}>
                  {item.title}
                </div>

                {/* Chips row */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Severity badge */}
                  <span style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: `${severityColor(item.severity)}18`,
                    color: severityColor(item.severity),
                    border: `1px solid ${severityColor(item.severity)}30`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}>
                    {item.severity}
                  </span>

                  {/* Kind badge */}
                  <span style={{
                    fontSize: 9.5,
                    fontWeight: 500,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: item.kind === 'incident'
                      ? 'rgba(139,92,246,0.12)'
                      : 'rgba(6,182,212,0.12)',
                    color: item.kind === 'incident' ? '#8B5CF6' : '#06B6D4',
                    border: `1px solid ${item.kind === 'incident' ? 'rgba(139,92,246,0.25)' : 'rgba(6,182,212,0.25)'}`,
                  }}>
                    {item.kind === 'incident' ? 'Incident' : 'Alert'}
                  </span>

                  {/* MITRE tactic chip */}
                  {item.tactic && (
                    <span style={{
                      fontSize: 9.5,
                      fontWeight: 500,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-muted)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 100,
                    }}>
                      {item.techniqueId ? `${item.techniqueId} · ` : ''}{item.tactic}
                    </span>
                  )}
                </div>
              </div>

              {/* Time */}
              <div style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                flexShrink: 0,
                marginTop: 2,
              }}>
                {item.time}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {items.length} event{items.length !== 1 ? 's' : ''} (max 20)
          </span>
          <Link
            href="/integrations/xdr-advanced"
            style={{
              fontSize: 11,
              color: '#8B5CF6',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            XDR Advanced <ChevronRight size={10} />
          </Link>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

export default XDRTicker
