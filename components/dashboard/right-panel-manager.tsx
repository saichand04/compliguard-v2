'use client'

/**
 * RightPanelManager
 *
 * Chicklet-menu-driven right panel. Users pick which widgets are visible
 * and in what order. Preferences persist to localStorage.
 *
 * Widgets available:
 *   mapping-engine | activity | my-tasks | teams-bot | xdr-feed
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Zap, Activity, CheckSquare, MessageSquare, Radio,
  Settings2, GripVertical, X, Eye, EyeOff, ChevronDown,
} from 'lucide-react'
import { MyTasksWidget } from './my-tasks-widget'
import { XDRTicker } from './xdr-ticker'
import { TeamsStatusWidget } from './teams-status-widget'
import { Link2 } from 'lucide-react'

// ── Widget definitions ────────────────────────────────────────────────────────

export type WidgetId = 'mapping-engine' | 'activity' | 'my-tasks' | 'teams-bot' | 'xdr-feed'

interface WidgetMeta {
  id: WidgetId
  label: string
  icon: React.ElementType
  color: string
  defaultVisible: boolean
}

const WIDGET_META: WidgetMeta[] = [
  { id: 'mapping-engine', label: 'Mapping Engine', icon: Zap,           color: 'var(--violet)',  defaultVisible: true  },
  { id: 'activity',       label: 'Activity',        icon: Activity,      color: 'var(--cyan)',    defaultVisible: true  },
  { id: 'my-tasks',       label: 'My Tasks',         icon: CheckSquare,   color: 'var(--emerald)', defaultVisible: true  },
  { id: 'teams-bot',      label: 'Teams Bot',        icon: MessageSquare, color: 'var(--violet)',  defaultVisible: true  },
  { id: 'xdr-feed',       label: 'XDR Live Feed',    icon: Radio,         color: 'var(--rose)',    defaultVisible: false },
]

const STORAGE_KEY = 'cg_right_panel_prefs'

interface PanelPrefs {
  order: WidgetId[]
  hidden: WidgetId[]
}

function defaultPrefs(): PanelPrefs {
  return {
    order: WIDGET_META.map(w => w.id),
    hidden: WIDGET_META.filter(w => !w.defaultVisible).map(w => w.id),
  }
}

function loadPrefs(): PanelPrefs {
  if (typeof window === 'undefined') return defaultPrefs()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PanelPrefs
      const allIds = WIDGET_META.map(w => w.id)
      // Make sure any newly added widgets are included
      const missingInOrder = allIds.filter(id => !parsed.order.includes(id))
      return {
        order: [...parsed.order.filter(id => allIds.includes(id)), ...missingInOrder],
        hidden: parsed.hidden.filter(id => allIds.includes(id)),
      }
    }
  } catch { /* ignore */ }
  return defaultPrefs()
}

// ── Mapping Engine sub-component ─────────────────────────────────────────────

interface MappingStats {
  totalMappings: number
  autoMapped: number
  pendingReview: number
  conflicts: number
}

function MappingEngineWidget({ stats }: { stats: MappingStats }) {
  return (
    <div className="glass-card animate-fade-up delay-100" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 28, height: 28,
          background: 'var(--violet-dim)',
          border: '1px solid rgba(139,92,246,0.30)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={13} style={{ color: 'var(--violet)' }} />
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
          Mapping Engine
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontWeight: 600,
          padding: '2px 7px', borderRadius: 99,
          background: 'var(--emerald-dim)', color: 'var(--emerald)',
          border: '1px solid rgba(16,185,129,0.25)',
        }}>
          ACTIVE
        </span>
      </div>

      {[
        { label: 'Total Mappings', value: stats.totalMappings.toLocaleString(), color: 'var(--text-primary)' },
        { label: 'Auto-mapped',    value: stats.autoMapped.toLocaleString(),    color: 'var(--emerald)' },
        { label: 'Pending Review', value: stats.pendingReview,                  color: 'var(--amber)' },
        { label: 'Conflicts',      value: stats.conflicts,                      color: 'var(--rose)' },
      ].map(({ label, value, color }) => (
        <div key={label} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '7px 0', borderBottom: '1px solid var(--border-glass)',
        }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{label}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color }}>{value}</span>
        </div>
      ))}

      <button className="btn-primary" style={{ width: '100%', marginTop: 14, fontSize: 12.5, padding: '8px 14px' }}>
        <Link2 size={13} /> Review Pending Mappings
      </button>
    </div>
  )
}

// ── Activity sub-component ────────────────────────────────────────────────────

interface ActivityItem {
  action: string
  subject: string
  user: string
  time: string
  color: string
}

function ActivityWidget({ items }: { items: ActivityItem[] }) {
  return (
    <div className="glass-card animate-fade-up delay-150" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Activity size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Activity</span>
        </div>
        <button style={{ fontSize: 11.5, color: 'var(--violet)', background: 'none', border: 'none', cursor: 'pointer' }}>
          View all
        </button>
      </div>

      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', gap: 10, padding: '8px 0',
          borderBottom: i < items.length - 1 ? '1px solid var(--border-glass)' : 'none',
          cursor: 'pointer',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: item.color, boxShadow: `0 0 5px ${item.color}`,
            marginTop: 5, flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 1 }}>
              {item.action}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.subject}
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{item.time}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{item.user}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Chicklet menu ─────────────────────────────────────────────────────────────

interface ChickletMenuProps {
  prefs: PanelPrefs
  onToggle: (id: WidgetId) => void
  onClose: () => void
}

function ChickletMenu({ prefs, onToggle, onClose }: ChickletMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 36,
        right: 0,
        zIndex: 100,
        background: 'var(--bg-card, #1a1a2e)',
        border: '1px solid var(--border-glass)',
        borderRadius: 12,
        padding: '12px 14px',
        minWidth: 220,
        boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
        Panel Widgets
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {WIDGET_META.map((w) => {
          const Icon = w.icon
          const isVisible = !prefs.hidden.includes(w.id)
          return (
            <button
              key={w.id}
              onClick={() => onToggle(w.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: isVisible ? `${w.color}40` : 'transparent',
                background: isVisible ? `${w.color}12` : 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: isVisible ? `${w.color}20` : 'rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={12} style={{ color: isVisible ? w.color : 'var(--text-muted)' }} />
              </div>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: isVisible ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {w.label}
              </span>
              {isVisible
                ? <Eye size={12} style={{ color: w.color, flexShrink: 0 }} />
                : <EyeOff size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              }
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-glass)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        Click to show / hide widgets
      </div>
    </div>
  )
}

// ── Draggable widget wrapper ───────────────────────────────────────────────────

interface DraggableWidgetProps {
  id: WidgetId
  index: number
  isDragging: boolean
  isOver: boolean
  onDragStart: (i: number) => void
  onDragOver: (i: number) => void
  onDragEnd: () => void
  children: React.ReactNode
}

function DraggableWidget({ index, isDragging, isOver, onDragStart, onDragOver, onDragEnd, children }: DraggableWidgetProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index) }}
      onDragEnd={onDragEnd}
      style={{
        opacity: isDragging ? 0.3 : 1,
        transform: isOver ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.15s ease, opacity 0.15s ease',
        boxShadow: isOver ? '0 0 0 2px rgba(139,92,246,0.6)' : 'none',
        borderRadius: 12,
        position: 'relative',
      }}
    >
      {/* Drag handle */}
      <div
        style={{
          position: 'absolute',
          top: 10, right: 10,
          zIndex: 10,
          cursor: 'grab',
          opacity: 0.3,
          padding: 2,
        }}
        title="Drag to reorder"
      >
        <GripVertical size={13} style={{ color: 'var(--text-muted)' }} />
      </div>
      {children}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface RightPanelManagerProps {
  mappingStats: {
    totalMappings: number
    autoMapped: number
    pendingReview: number
    conflicts: number
  }
  activityItems: ActivityItem[]
}

export function RightPanelManager({ mappingStats, activityItems }: RightPanelManagerProps) {
  const [prefs, setPrefs] = useState<PanelPrefs>(loadPrefs)
  const [menuOpen, setMenuOpen] = useState(false)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  // Persist prefs
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
  }, [prefs])

  const toggleWidget = useCallback((id: WidgetId) => {
    setPrefs(prev => ({
      ...prev,
      hidden: prev.hidden.includes(id)
        ? prev.hidden.filter(h => h !== id)
        : [...prev.hidden, id],
    }))
  }, [])

  const handleDragStart = useCallback((i: number) => setDraggingIdx(i), [])
  const handleDragOver = useCallback((i: number) => setOverIdx(i), [])
  const handleDragEnd = useCallback(() => {
    if (draggingIdx !== null && overIdx !== null && draggingIdx !== overIdx) {
      setPrefs(prev => {
        const visibleOrder = prev.order.filter(id => !prev.hidden.includes(id))
        const next = [...visibleOrder]
        const [moved] = next.splice(draggingIdx, 1)
        next.splice(overIdx, 0, moved)
        // Rebuild full order: visible (reordered) + hidden ones at end
        const hiddenOnes = prev.order.filter(id => prev.hidden.includes(id))
        return { ...prev, order: [...next, ...hiddenOnes] }
      })
    }
    setDraggingIdx(null)
    setOverIdx(null)
  }, [draggingIdx, overIdx])

  // Only show visible widgets in order
  const visibleIds = prefs.order.filter(id => !prefs.hidden.includes(id))
  const hiddenCount = prefs.hidden.length

  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case 'mapping-engine': return <MappingEngineWidget stats={mappingStats} />
      case 'activity':       return <ActivityWidget items={activityItems} />
      case 'my-tasks':       return <MyTasksWidget />
      case 'xdr-feed':       return <XDRTicker />
      case 'teams-bot':      return <TeamsStatusWidget />
      default:               return null
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Panel header with chicklet menu button ───────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 11px',
            borderRadius: 8,
            border: '1px solid var(--border-glass)',
            background: menuOpen ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.04)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            color: menuOpen ? 'var(--violet)' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          <Settings2 size={12} />
          Widgets
          {hiddenCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
              background: 'rgba(139,92,246,0.25)', color: 'var(--violet)',
              marginLeft: 2,
            }}>
              {hiddenCount} hidden
            </span>
          )}
          <ChevronDown size={11} style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {menuOpen && (
          <ChickletMenu
            prefs={prefs}
            onToggle={toggleWidget}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>

      {/* ── Visible widgets (draggable) ─────────────────── */}
      {visibleIds.map((id, visualIdx) => (
        <DraggableWidget
          key={id}
          id={id}
          index={visualIdx}
          isDragging={draggingIdx === visualIdx}
          isOver={overIdx === visualIdx && draggingIdx !== null && draggingIdx !== visualIdx}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {renderWidget(id)}
        </DraggableWidget>
      ))}

      {/* ── Empty state ──────────────────────────────────── */}
      {visibleIds.length === 0 && (
        <div style={{
          padding: '28px 20px',
          textAlign: 'center',
          border: '1px dashed var(--border-glass)',
          borderRadius: 12,
        }}>
          <EyeOff size={22} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>All widgets hidden</div>
          <button
            onClick={() => setMenuOpen(true)}
            style={{
              fontSize: 12, color: 'var(--violet)', background: 'none',
              border: 'none', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Restore from Widgets menu
          </button>
        </div>
      )}
    </div>
  )
}
