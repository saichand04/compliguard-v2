interface FrameworkProgressCardProps {
  name: string
  shortName: string
  progress: number        // 0–100
  totalControls: number
  completedControls: number
  dueDate?: string
  status: 'on-track' | 'at-risk' | 'overdue' | 'complete'
  delay?: number
}

const STATUS_CONFIG = {
  'on-track': { label: 'On Track',  color: 'var(--emerald)', dim: 'var(--emerald-dim)', border: 'rgba(16,185,129,0.25)' },
  'at-risk':  { label: 'At Risk',   color: 'var(--amber)',   dim: 'var(--amber-dim)',   border: 'rgba(245,158,11,0.25)' },
  'overdue':  { label: 'Overdue',   color: 'var(--rose)',    dim: 'var(--rose-dim)',    border: 'rgba(244,63,94,0.25)' },
  'complete': { label: 'Complete',  color: 'var(--cyan)',    dim: 'var(--cyan-dim)',    border: 'rgba(6,182,212,0.25)' },
}

// Framework initials badge
function FrameworkBadge({ shortName }: { shortName: string }) {
  const colors = ['#7C3AED', '#0E7490', '#065F46', '#92400E', '#9F1239']
  const hash = shortName.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const color = colors[hash % colors.length]

  return (
    <div style={{
      width: 40,
      height: 40,
      background: `${color}22`,
      border: `1px solid ${color}44`,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: shortName.length > 4 ? 8 : shortName.length > 3 ? 9 : 10.5,
      fontWeight: 700,
      color: `${color}DD`,
      letterSpacing: '-0.02em',
      flexShrink: 0,
    }}>
      {shortName.slice(0, 6)}
    </div>
  )
}

export function FrameworkProgressCard({
  name, shortName, progress, totalControls, completedControls,
  dueDate, status, delay = 0
}: FrameworkProgressCardProps) {
  const cfg = STATUS_CONFIG[status]
  const pct = Math.min(100, Math.max(0, progress))

  return (
    <div
      className="glass-card animate-fade-up"
      style={{ padding: '16px 18px', animationDelay: `${delay}ms` }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <FrameworkBadge shortName={shortName} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </div>
            <span style={{
              flexShrink: 0,
              fontSize: 10.5,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 99,
              background: cfg.dim,
              color: cfg.color,
              border: `1px solid ${cfg.border}`,
              letterSpacing: '0.02em',
            }}>
              {cfg.label}
            </span>
          </div>
          {dueDate && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
              Due {dueDate}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-track" style={{ marginBottom: 10 }}>
        <div
          className="progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Footer stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{completedControls}</span>
          {' / '}
          {totalControls} controls
        </div>
        <div style={{
          fontSize: 15,
          fontWeight: 700,
          color: cfg.color,
          letterSpacing: '-0.01em',
        }}>
          {pct}%
        </div>
      </div>
    </div>
  )
}
