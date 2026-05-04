import { getSession } from '@/lib/auth/jwt'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface Module {
  id: string
  title: string
  description: string | null
  estimatedMinutes: number | null
  passingScore: number | null
  isRequired: boolean | null
  category: string
  difficulty: string
  completion: {
    completedAt: string | null
    score: number | null
    passed: boolean | null
    certificateKey: string | null
    attemptCount: number | null
  } | null
}

interface Stats {
  totalModules: number
  completedModules: number
  passRate: number
  avgScore: number
  overdueCertificates: number
  upcomingRenewals: number
  completionsByCategory: Record<string, { total: number; completed: number }>
}

async function fetchModules(token: string): Promise<Module[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/training/modules`, {
      headers: { Cookie: `cg-session=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.modules ?? []
  } catch {
    return []
  }
}

async function fetchStats(token: string): Promise<Stats | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/training/stats`, {
      headers: { Cookie: `cg-session=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: '#22C55E',
  intermediate: '#F59E0B',
  advanced: '#EF4444',
}

const CATEGORY_COLORS: Record<string, string> = {
  'Security Awareness': '#8B5CF6',
  'Privacy & Data Protection': '#06B6D4',
  'Compliance': '#10B981',
  'Identity & Access': '#F59E0B',
  'Incident Response': '#EF4444',
  'General': '#6B7280',
}

export default async function TrainingPage() {
  const session = await getSession()
  if (!session) redirect('/signin')

  // Get the session cookie value for server-side API calls
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const token = cookieStore.get('cg-session')?.value ?? ''

  const [modules, stats] = await Promise.all([
    fetchModules(token),
    fetchStats(token),
  ])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: '0 0 6px',
          letterSpacing: '-0.02em',
        }}>
          Security Training
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
          Complete required training modules and earn certificates to demonstrate your security knowledge.
        </p>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}>
          {[
            { label: 'Total Modules', value: stats.totalModules, color: 'var(--text-primary)' },
            { label: 'Completed', value: stats.completedModules, color: '#22C55E' },
            { label: 'Pass Rate', value: `${stats.passRate}%`, color: '#8B5CF6' },
            { label: 'Avg Score', value: stats.avgScore > 0 ? `${stats.avgScore}%` : '—', color: '#06B6D4' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="glass-card"
              style={{ padding: '18px 20px', borderRadius: 'var(--radius-lg)' }}
            >
              <div style={{ fontSize: 26, fontWeight: 700, color: stat.color, letterSpacing: '-0.02em' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {modules.length} module{modules.length !== 1 ? 's' : ''} available
        </div>
        <Link
          href="/training/completions"
          style={{
            fontSize: 13,
            color: 'var(--violet)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          View completion history →
        </Link>
      </div>

      {/* Module Grid */}
      {modules.length === 0 ? (
        <div className="glass-card" style={{ padding: 48, textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>🎓</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
            No training modules available yet.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 20,
        }}>
          {modules.map((mod) => {
            const isCompleted = mod.completion?.passed === true
            const isAttempted = mod.completion !== null && !isCompleted
            const catColor = CATEGORY_COLORS[mod.category] ?? '#6B7280'
            const diffColor = DIFFICULTY_COLORS[mod.difficulty] ?? '#6B7280'

            return (
              <div
                key={mod.id}
                className="glass-card"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  border: isCompleted ? '1px solid rgba(34,197,94,0.25)' : undefined,
                }}
              >
                {/* Card top bar */}
                <div style={{
                  height: 3,
                  background: isCompleted
                    ? 'linear-gradient(90deg, #22C55E, #10B981)'
                    : `linear-gradient(90deg, ${catColor}, ${catColor}88)`,
                }} />

                <div style={{ padding: '20px 20px 16px' }}>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: catColor,
                      background: `${catColor}18`,
                      border: `1px solid ${catColor}30`,
                      borderRadius: 4,
                      padding: '2px 8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      {mod.category}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: diffColor,
                      background: `${diffColor}18`,
                      border: `1px solid ${diffColor}30`,
                      borderRadius: 4,
                      padding: '2px 8px',
                      textTransform: 'capitalize',
                    }}>
                      {mod.difficulty}
                    </span>
                    {mod.isRequired && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#F59E0B',
                        background: 'rgba(245,158,11,0.1)',
                        border: '1px solid rgba(245,158,11,0.3)',
                        borderRadius: 4,
                        padding: '2px 8px',
                      }}>
                        Required
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: '0 0 8px',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.3,
                  }}>
                    {mod.title}
                  </h3>

                  {/* Description */}
                  <p style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    margin: '0 0 16px',
                    lineHeight: 1.6,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {mod.description}
                  </p>

                  {/* Meta row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    {mod.estimatedMinutes && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {mod.estimatedMinutes} min
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      Pass: {mod.passingScore ?? 80}%
                    </span>
                  </div>

                  {/* Completion status */}
                  {isCompleted && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      background: 'rgba(34,197,94,0.08)',
                      border: '1px solid rgba(34,197,94,0.2)',
                      borderRadius: 8,
                      marginBottom: 16,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#22C55E' }}>
                        Completed — Score: {mod.completion?.score}%
                      </span>
                    </div>
                  )}

                  {isAttempted && !isCompleted && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      background: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      borderRadius: 8,
                      marginBottom: 16,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B' }}>
                        Not passed — Last score: {mod.completion?.score}% (Attempt #{mod.completion?.attemptCount})
                      </span>
                    </div>
                  )}

                  {/* CTA Button */}
                  <Link
                    href={`/training/${mod.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '9px 16px',
                      borderRadius: 8,
                      background: isCompleted
                        ? 'rgba(139,92,246,0.1)'
                        : 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
                      color: isCompleted ? '#8B5CF6' : '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: 'none',
                      border: isCompleted ? '1px solid rgba(139,92,246,0.3)' : 'none',
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {isCompleted ? 'Review Module' : isAttempted ? 'Try Again' : 'Start Training'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
