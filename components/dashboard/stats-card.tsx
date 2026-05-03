import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { type LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: { value: number; label: string }
  icon: LucideIcon
  accentColor?: 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose'
  delay?: number
}

const ACCENT = {
  violet:  { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.30)', icon: '#A78BFA', glow: 'rgba(139,92,246,0.25)', line: '#8B5CF6' },
  cyan:    { bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.28)',  icon: '#67E8F9', glow: 'rgba(6,182,212,0.20)',  line: '#06B6D4' },
  emerald: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', icon: '#6EE7B7', glow: 'rgba(16,185,129,0.20)', line: '#10B981' },
  amber:   { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)', icon: '#FCD34D', glow: 'rgba(245,158,11,0.20)', line: '#F59E0B' },
  rose:    { bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.28)',  icon: '#FDA4AF', glow: 'rgba(244,63,94,0.20)',  line: '#F43F5E' },
}

// Tiny sparkline SVG
function Sparkline({ color }: { color: string }) {
  const points = [10, 6, 14, 8, 4, 12, 7, 15, 9, 13, 5, 16]
  const w = 80, h = 28
  const min = Math.min(...points), max = Math.max(...points)
  const scaleY = (v: number) => h - ((v - min) / (max - min)) * (h - 4) - 2
  const scaleX = (i: number) => (i / (points.length - 1)) * w
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(v)}`).join(' ')

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" style={{ opacity: 0.8 }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <path
        d={`${d} L ${w} ${h} L 0 ${h} Z`}
        fill={`url(#sg-${color.replace('#','')})`}
      />
      {/* Line */}
      <path d={d} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StatsCard({ title, value, subtitle, trend, icon: Icon, accentColor = 'violet', delay = 0 }: StatsCardProps) {
  const accent = ACCENT[accentColor]
  const trendPositive = trend && trend.value > 0
  const trendNeutral = trend && trend.value === 0

  return (
    <div
      className="glass-card animate-fade-up"
      style={{
        padding: '20px 20px 16px',
        animationDelay: `${delay}ms`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle corner glow */}
      <div style={{
        position: 'absolute',
        top: -20,
        right: -20,
        width: 80,
        height: 80,
        background: `radial-gradient(circle, ${accent.glow} 0%, transparent 70%)`,
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
            {title}
          </div>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>
            {value}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</div>
          )}
        </div>

        {/* Icon badge */}
        <div style={{
          width: 38,
          height: 38,
          background: accent.bg,
          border: `1px solid ${accent.border}`,
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 0 12px ${accent.glow}`,
        }}>
          <Icon size={18} style={{ color: accent.icon }} />
        </div>
      </div>

      {/* Bottom row — trend + sparkline */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        {trend ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {trendNeutral ? (
              <Minus size={12} style={{ color: 'var(--text-muted)' }} />
            ) : trendPositive ? (
              <TrendingUp size={12} style={{ color: 'var(--emerald)' }} />
            ) : (
              <TrendingDown size={12} style={{ color: 'var(--rose)' }} />
            )}
            <span style={{
              fontSize: 12,
              fontWeight: 500,
              color: trendNeutral ? 'var(--text-muted)' : trendPositive ? 'var(--emerald)' : 'var(--rose)',
            }}>
              {trendPositive ? '+' : ''}{trend.value}%
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{trend.label}</span>
          </div>
        ) : (
          <div />
        )}
        <Sparkline color={accent.line} />
      </div>
    </div>
  )
}
