import { getSession } from '@/lib/auth/jwt'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'

interface Completion {
  id: string
  moduleId: string
  completedAt: string | null
  score: number | null
  passed: boolean | null
  attemptCount: number | null
  certificateKey: string | null
  createdAt: string
  moduleTitle: string | null
  moduleDescription: string | null
  moduleEstimatedMinutes: number | null
  modulePassingScore: number | null
  moduleCategory: string
  moduleDifficulty: string
}

async function fetchCompletions(token: string): Promise<Completion[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/training/completions`,
      {
        headers: { Cookie: `cg-session=${token}` },
        cache: 'no-store',
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.completions ?? []
  } catch {
    return []
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  'Security Awareness': '#8B5CF6',
  'Privacy & Data Protection': '#06B6D4',
  'Compliance': '#10B981',
  'Identity & Access': '#F59E0B',
  'Incident Response': '#EF4444',
  'General': '#6B7280',
}

export default async function CompletionsPage() {
  const session = await getSession()
  if (!session) redirect('/signin')

  const cookieStore = await cookies()
  const token = cookieStore.get('cg-session')?.value ?? ''

  const completions = await fetchCompletions(token)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 4px',
            letterSpacing: '-0.02em',
          }}>
            Training History
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            Your training attempts and earned certificates.
          </p>
        </div>
        <Link
          href="/training"
          style={{
            padding: '9px 18px',
            background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ← Back to Training
        </Link>
      </div>

      {/* Table */}
      {completions.length === 0 ? (
        <div className="glass-card" style={{ padding: 48, textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
            You haven&apos;t attempted any training modules yet.{' '}
            <Link href="/training" style={{ color: '#8B5CF6', textDecoration: 'none' }}>
              Start training →
            </Link>
          </p>
        </div>
      ) : (
        <div className="glass-card" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 80px 80px 1.5fr 100px',
            gap: 0,
            padding: '10px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            {['Module', 'Category', 'Difficulty', 'Score', 'Attempts', 'Certificate ID', 'Status'].map((h) => (
              <div key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {completions.map((c, idx) => {
            const catColor = CATEGORY_COLORS[c.moduleCategory] ?? '#6B7280'
            const isPassed = c.passed === true

            return (
              <div
                key={c.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 80px 80px 1.5fr 100px',
                  gap: 0,
                  padding: '14px 20px',
                  alignItems: 'center',
                  borderBottom: idx < completions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  transition: 'background 0.1s',
                }}
              >
                {/* Module name */}
                <div>
                  <Link
                    href={`/training/${c.moduleId}`}
                    style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}
                  >
                    {c.moduleTitle ?? 'Unknown Module'}
                  </Link>
                  {c.completedAt && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {new Date(c.completedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>

                {/* Category */}
                <div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: catColor,
                    background: `${catColor}18`,
                    border: `1px solid ${catColor}30`,
                    borderRadius: 4,
                    padding: '2px 7px',
                  }}>
                    {c.moduleCategory}
                  </span>
                </div>

                {/* Difficulty */}
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {c.moduleDifficulty}
                </div>

                {/* Score */}
                <div style={{ fontSize: 14, fontWeight: 700, color: isPassed ? '#22C55E' : c.score !== null ? '#EF4444' : 'var(--text-muted)' }}>
                  {c.score !== null ? `${c.score}%` : '—'}
                </div>

                {/* Attempts */}
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {c.attemptCount ?? 1}
                </div>

                {/* Certificate ID */}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.certificateKey ? c.certificateKey.slice(0, 8) + '...' : '—'}
                </div>

                {/* Status badge */}
                <div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 9px',
                    borderRadius: 4,
                    color: isPassed ? '#22C55E' : '#EF4444',
                    background: isPassed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: isPassed ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.25)',
                  }}>
                    {isPassed ? 'Passed' : 'Failed'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
