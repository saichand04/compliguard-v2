'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { StatsCard } from './stats-card'
import { TrendingUp, CheckSquare, AlertTriangle, FileText, Shield, BarChart3, Activity, Zap, type LucideIcon } from 'lucide-react'

// Icon registry — maps string names sent from server to actual components
const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp,
  CheckSquare,
  AlertTriangle,
  FileText,
  Shield,
  BarChart3,
  Activity,
  Zap,
}

export interface StatItem {
  title: string
  value: string | number
  subtitle?: string
  trend?: { value: number; label: string }
  iconName: string          // string key from ICON_MAP — safe to cross RSC boundary
  accentColor?: 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose'
}

interface DraggableStatsGridProps {
  stats: StatItem[]
  storageKey?: string
}

const STORAGE_KEY = 'compliguard_stats_order'

export function DraggableStatsGrid({ stats, storageKey = STORAGE_KEY }: DraggableStatsGridProps) {
  // Initialise order from localStorage or natural order
  const [order, setOrder] = useState<number[]>(() => {
    if (typeof window === 'undefined') return stats.map((_, i) => i)
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed: number[] = JSON.parse(saved)
        // Validate — must cover exactly 0..stats.length-1
        if (
          parsed.length === stats.length &&
          parsed.every((n) => Number.isInteger(n) && n >= 0 && n < stats.length)
        ) {
          return parsed
        }
      }
    } catch {/* ignore */}
    return stats.map((_, i) => i)
  })

  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const dragGhost = useRef<HTMLDivElement | null>(null)

  // Persist order to localStorage whenever it changes
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(order)) } catch {/* ignore */}
  }, [order, storageKey])

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, visualIdx: number) => {
    setDraggingIdx(visualIdx)
    e.dataTransfer.effectAllowed = 'move'
    // Use a minimal ghost image so card doesn't snap to cursor corner
    const ghost = document.createElement('div')
    ghost.style.cssText = 'position:fixed;top:-200px;left:-200px;width:1px;height:1px;opacity:0;'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    dragGhost.current = ghost
  }, [])

  const handleDragEnd = useCallback(() => {
    if (draggingIdx !== null && overIdx !== null && draggingIdx !== overIdx) {
      setOrder((prev) => {
        const next = [...prev]
        const [moved] = next.splice(draggingIdx, 1)
        next.splice(overIdx, 0, moved)
        return next
      })
    }
    setDraggingIdx(null)
    setOverIdx(null)
    if (dragGhost.current) {
      dragGhost.current.remove()
      dragGhost.current = null
    }
  }, [draggingIdx, overIdx])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, visualIdx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverIdx(visualIdx)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, visualIdx: number) => {
    e.preventDefault()
    setOverIdx(visualIdx)
  }, [])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}
    >
      {order.map((statIdx, visualIdx) => {
        const stat = stats[statIdx]
        const isDragging = draggingIdx === visualIdx
        const isOver = overIdx === visualIdx && draggingIdx !== null && draggingIdx !== visualIdx

        return (
          <div
            key={statIdx}
            draggable
            onDragStart={(e) => handleDragStart(e, visualIdx)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, visualIdx)}
            onDrop={(e) => handleDrop(e, visualIdx)}
            style={{
              opacity: isDragging ? 0.35 : 1,
              transform: isOver ? 'scale(1.03)' : 'scale(1)',
              transition: 'transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease',
              boxShadow: isOver ? '0 0 0 2px rgba(139,92,246,0.6), 0 8px 32px rgba(139,92,246,0.2)' : 'none',
              borderRadius: 'var(--radius-lg, 12px)',
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
          >
            <StatsCard
              {...stat}
              icon={ICON_MAP[stat.iconName] ?? FileText}
              delay={visualIdx * 60}
            />
          </div>
        )
      })}
    </div>
  )
}
