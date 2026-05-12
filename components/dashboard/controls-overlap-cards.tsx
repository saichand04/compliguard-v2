'use client'

/**
 * ControlsOverlapCards
 *
 * Displays two stat cards side-by-side:
 *   • Common Controls  — controls shared across ≥2 selected frameworks
 *   • Unique Controls  — controls that belong to exactly one framework
 *
 * Computation logic (works on demo data; replace with real DB query in page.tsx):
 *   Given N frameworks each with a set of control IDs, we compute:
 *     common = |union of (controls appearing in ≥2 frameworks)|
 *     unique = sum over frameworks of |controls that appear only in that framework|
 *
 * Since we're operating on demo counts (not real control ID sets), we derive
 * approximations from the overlap model:
 *   estimatedOverlapRatio ≈ 0.35  (35% of active controls overlap across frameworks)
 *   This ratio is replaced by a real DB query (controls_mapping table) in production.
 */

import { useState, useEffect } from 'react'
import { GitMerge, Fingerprint, Info } from 'lucide-react'

export interface FrameworkForOverlap {
  name: string
  shortName: string
  totalControls: number
  completedControls: number
}

interface ControlsOverlapCardsProps {
  frameworks: FrameworkForOverlap[]
  /** Pass real common control count from DB if available */
  commonControlsCount?: number
  /** Pass real unique control count from DB if available */
  uniqueControlsCount?: number
}

// ── Simple animated counter ───────────────────────────────────────────────────

function AnimatedCount({ target, duration = 900 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (target === 0) { setCurrent(0); return }
    const step = target / (duration / 16)
    let val = 0
    const timer = setInterval(() => {
      val = Math.min(val + step, target)
      setCurrent(Math.floor(val))
      if (val >= target) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])

  return <>{current.toLocaleString()}</>
}

// ── Per-framework unique bar ──────────────────────────────────────────────────

function FrameworkUniqueBar({ name, count, total, color }: { name: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{name}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{count.toLocaleString()}</span>
      </div>
      <div style={{
        height: 4, borderRadius: 99,
        background: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${pct}%`,
          background: color,
          transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
        }} />
      </div>
    </div>
  )
}

// ── Overlap tooltip ───────────────────────────────────────────────────────────

const FRAMEWORK_COLORS = [
  'var(--violet)', 'var(--cyan)', 'var(--emerald)',
  'var(--amber)', 'var(--rose)', '#6366f1',
]

export function ControlsOverlapCards({
  frameworks,
  commonControlsCount,
  uniqueControlsCount,
}: ControlsOverlapCardsProps) {
  const [showTooltip, setShowTooltip] = useState<'common' | 'unique' | null>(null)
  const [expanded, setExpanded] = useState<'common' | 'unique' | null>(null)

  // ── Derive counts from framework data ──────────────────────────────────────
  // If real DB counts not passed, estimate from framework totals.
  // Overlap model: controls shared ≥2 frameworks ≈ 35% of the smallest framework pool.
  const totalActiveControls = frameworks.reduce((s, f) => s + f.totalControls, 0)

  const derivedCommon = commonControlsCount !== undefined
    ? commonControlsCount
    : Math.round(totalActiveControls * 0.35)

  const derivedUnique = uniqueControlsCount !== undefined
    ? uniqueControlsCount
    : totalActiveControls - derivedCommon

  // Per-framework unique estimate (unique = totalControls * (1 - overlapRatio))
  const perFrameworkUnique = frameworks.map(f => ({
    name: f.shortName,
    count: Math.round(f.totalControls * 0.65),
    total: f.totalControls,
  }))

  const overlapPct = totalActiveControls > 0
    ? Math.round((derivedCommon / totalActiveControls) * 100)
    : 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 0 }}>

      {/* ── Common Controls ─────────────────────────────── */}
      <div
        className="glass-card animate-fade-up"
        style={{
          padding: expanded === 'common' ? '20px 22px 18px' : '22px 22px 18px',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          animationDelay: '80ms',
        }}
        onClick={() => setExpanded(v => v === 'common' ? null : 'common')}
      >
        {/* Glow */}
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 90, height: 90,
          background: 'radial-gradient(circle, rgba(6,182,212,0.22) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{
            fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            maxWidth: '60%', lineHeight: 1.3,
          }}>
            Common Controls
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowTooltip(v => v === 'common' ? null : 'common') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
              title="What are common controls?"
            >
              <Info size={13} style={{ color: 'var(--text-muted)' }} />
            </button>
            <div style={{
              width: 34, height: 34,
              background: 'rgba(6,182,212,0.15)',
              border: '1px solid rgba(6,182,212,0.30)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 14px rgba(6,182,212,0.20)',
            }}>
              <GitMerge size={16} style={{ color: 'var(--cyan)' }} />
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {showTooltip === 'common' && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 54, right: 14, zIndex: 20,
              background: 'rgba(15,15,30,0.97)', border: '1px solid var(--border-glass)',
              borderRadius: 9, padding: '10px 13px',
              fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.6,
              maxWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            Controls that appear in <strong style={{ color: 'var(--cyan)' }}>2 or more</strong> of your active frameworks.
            Satisfying one implementation covers all mapped frameworks simultaneously.
          </div>
        )}

        {/* Value */}
        <div style={{
          fontSize: 30, fontWeight: 700,
          color: 'var(--text-primary)', letterSpacing: '-0.03em',
          lineHeight: 1, marginBottom: 6,
        }}>
          <AnimatedCount target={derivedCommon} />
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.4 }}>
          Shared across frameworks
        </div>

        {/* Overlap pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'rgba(6,182,212,0.10)',
          border: '1px solid rgba(6,182,212,0.22)',
          borderRadius: 100, padding: '3px 9px',
        }}>
          <GitMerge size={10} style={{ color: 'var(--cyan)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cyan)' }}>
            {overlapPct}% overlap
          </span>
        </div>

        {/* Expanded: framework overlap breakdown */}
        {expanded === 'common' && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Framework Overlap
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {frameworks.map((f, i) => (
                <span key={f.shortName} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 99,
                  background: `${FRAMEWORK_COLORS[i % FRAMEWORK_COLORS.length]}18`,
                  border: `1px solid ${FRAMEWORK_COLORS[i % FRAMEWORK_COLORS.length]}35`,
                  color: FRAMEWORK_COLORS[i % FRAMEWORK_COLORS.length],
                  fontWeight: 600,
                }}>
                  {f.shortName}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {frameworks.length} active frameworks · {derivedCommon.toLocaleString()} shared controls
            </div>
          </div>
        )}
      </div>

      {/* ── Unique Controls ──────────────────────────────── */}
      <div
        className="glass-card animate-fade-up"
        style={{
          padding: '22px 22px 18px',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          animationDelay: '140ms',
        }}
        onClick={() => setExpanded(v => v === 'unique' ? null : 'unique')}
      >
        {/* Glow */}
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 90, height: 90,
          background: 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{
            fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            maxWidth: '60%', lineHeight: 1.3,
          }}>
            Unique Controls
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowTooltip(v => v === 'unique' ? null : 'unique') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
              title="What are unique controls?"
            >
              <Info size={13} style={{ color: 'var(--text-muted)' }} />
            </button>
            <div style={{
              width: 34, height: 34,
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.30)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 14px rgba(139,92,246,0.20)',
            }}>
              <Fingerprint size={16} style={{ color: 'var(--violet)' }} />
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {showTooltip === 'unique' && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 54, right: 14, zIndex: 20,
              background: 'rgba(15,15,30,0.97)', border: '1px solid var(--border-glass)',
              borderRadius: 9, padding: '10px 13px',
              fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.6,
              maxWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            Controls that exist in <strong style={{ color: 'var(--violet)' }}>exactly one</strong> framework.
            These require dedicated effort and cannot be covered by cross-framework mappings.
          </div>
        )}

        {/* Value */}
        <div style={{
          fontSize: 30, fontWeight: 700,
          color: 'var(--text-primary)', letterSpacing: '-0.03em',
          lineHeight: 1, marginBottom: 6,
        }}>
          <AnimatedCount target={derivedUnique} />
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.4 }}>
          Exclusive to one framework
        </div>

        {/* Unique pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'rgba(139,92,246,0.10)',
          border: '1px solid rgba(139,92,246,0.22)',
          borderRadius: 100, padding: '3px 9px',
        }}>
          <Fingerprint size={10} style={{ color: 'var(--violet)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--violet)' }}>
            {100 - overlapPct}% unique
          </span>
        </div>

        {/* Expanded: per-framework breakdown */}
        {expanded === 'unique' && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              By Framework
            </div>
            {perFrameworkUnique.map((fw, i) => (
              <FrameworkUniqueBar
                key={fw.name}
                name={fw.name}
                count={fw.count}
                total={fw.total}
                color={FRAMEWORK_COLORS[i % FRAMEWORK_COLORS.length]}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
