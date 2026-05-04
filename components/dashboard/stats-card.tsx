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
  violet:  { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.30)', icon: '#A78BFA', glow: 'rgba(139,92,246,0.25)' },
  cyan:    { bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.28)',  icon: '#67E8F9', glow: 'rgba(6,182,212,0.20)'  },
  emerald: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', icon: '#6EE7B7', glow: 'rgba(16,185,129,0.20)' },
  amber:   { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)', icon: '#FCD34D', glow: 'rgba(245,158,11,0.20)' },
  rose:    { bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.28)',  icon: '#FDA4AF', glow: 'rgba(244,63,94,0.20)'  },
}

export function StatsCard({ title, value, subtitle, trend, icon: Icon, accentColor = 'violet', delay = 0 }: StatsCardProps) {
  const accent = ACCENT[accentColor]
  const trendPositive = trend && trend.value > 0
  const trendNeutral = trend && trend.value === 0

  return (
    <div
      className="glass-card animate-fade-up"
      style={{
        padding: '22px 22px 18px',
        animationDelay: `${delay}ms`,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      {/* Corner glow */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 90, height: 90,
        background: `radial-gradient(circle, ${accent.glow} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Icon + title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {title}
        </div>
        <div style={{
          width: 36, height: 36,
          background: accent.bg,
          border: `1px solid ${accent.border}`,
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 0 14px ${accent.glow}`,
        }}>
          <Icon size={17} style={{ color: accent.icon }} />
        </div>
      </div>

      {/* Value */}
      <div style={{
        fontSize: 32, fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '-0.03em',
        lineHeight: 1,
        marginBottom: subtitle ? 6 : 14,
      }}>
        {value}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.4 }}>{subtitle}</div>
      )}

      {/* Trend pill */}
      {trend && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
          background: trendNeutral ? 'rgba(255,255,255,0.06)' : trendPositive ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
          border: `1px solid ${trendNeutral ? 'rgba(255,255,255,0.1)' : trendPositive ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}`,
          borderRadius: 100, padding: '3px 9px',
        }}>
          {trendNeutral
            ? <Minus size={11} style={{ color: 'var(--text-muted)' }} />
            : trendPositive
              ? <TrendingUp size={11} style={{ color: 'var(--emerald)' }} />
              : <TrendingDown size={11} style={{ color: 'var(--rose)' }} />}
          <span style={{ fontSize: 12, fontWeight: 600,
            color: trendNeutral ? 'var(--text-muted)' : trendPositive ? 'var(--emerald)' : 'var(--rose)' }}>
            {trendPositive ? '+' : ''}{trend.value}%
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{trend.label}</span>
        </div>
      )}
    </div>
  )
}
