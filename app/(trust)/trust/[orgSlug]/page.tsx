'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Shield, CheckCircle, Clock, Activity, ExternalLink } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FrameworkProgress {
  id: string
  name: string
  shortName: string
  version: string | null
  category: string | null
  pct: number
  implementedControls: number
  totalControls: number
  status: 'Certified' | 'Auditing' | 'In Progress'
}

interface TrustData {
  orgName: string
  orgSlug: string
  logoUrl: string | null
  overallScore: number
  lastUpdated: string
  activeFrameworks: FrameworkProgress[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 2) return 'just now'
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')
}

function statusColor(status: FrameworkProgress['status']) {
  if (status === 'Certified') return { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)', text: '#6EE7B7' }
  if (status === 'Auditing')  return { bg: 'rgba(6,182,212,0.15)',  border: 'rgba(6,182,212,0.35)',  text: '#67E8F9' }
  return { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.35)', text: '#C4B5FD' }
}

// ── Security Highlights ───────────────────────────────────────────────────────

const HIGHLIGHTS = [
  {
    icon: Activity,
    title: 'Continuous Monitoring',
    description: '24/7 automated compliance checks across all active frameworks and controls.',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.10)',
    border: 'rgba(139,92,246,0.25)',
  },
  {
    icon: Shield,
    title: 'Evidence-Backed',
    description: 'All compliance claims are supported by collected, auditable evidence artifacts.',
    color: '#06B6D4',
    bg: 'rgba(6,182,212,0.10)',
    border: 'rgba(6,182,212,0.25)',
  },
  {
    icon: CheckCircle,
    title: 'Third-Party Audited',
    description: 'Controls are independently verified by accredited third-party audit teams.',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.25)',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrustPortalPage() {
  const params = useParams()
  const orgSlug = params?.orgSlug as string
  const [data, setData] = useState<TrustData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgSlug) return
    fetch(`/api/trust/${orgSlug}`)
      .then((r) => {
        if (!r.ok) throw new Error('Organization not found')
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [orgSlug])

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
            borderRadius: 14, margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(109,40,217,0.4)',
            animation: 'pulse 2s ease-in-out infinite',
          }}>
            <Shield size={22} color="white" />
          </div>
          <p style={{ fontSize: 14, color: 'rgba(241,245,249,0.5)' }}>Loading trust portal…</p>
        </div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: '#F1F5F9', marginBottom: 8 }}>
            Portal Not Found
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(241,245,249,0.5)' }}>
            {error ?? 'This trust portal does not exist or has not been enabled.'}
          </p>
        </div>
      </div>
    )
  }

  const scoreGrade = data.overallScore >= 90 ? 'Excellent' : data.overallScore >= 70 ? 'Good' : 'In Progress'
  const scoreColor = data.overallScore >= 90 ? '#6EE7B7' : data.overallScore >= 70 ? '#67E8F9' : '#C4B5FD'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px 64px' }}>

      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 0', marginBottom: 40,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
            borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(109,40,217,0.4)', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="white" opacity="0.95" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#F1F5F9', letterSpacing: '-0.01em' }}>
            CompliGuard
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 99,
          background: 'rgba(139,92,246,0.12)',
          border: '1px solid rgba(139,92,246,0.3)',
          fontSize: 12, color: '#C4B5FD', fontWeight: 500,
        }}>
          <Shield size={11} />
          Powered by CompliGuard
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        {/* Org logo / avatar */}
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
          {data.logoUrl ? (
            <img
              src={data.logoUrl}
              alt={data.orgName}
              style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }}
            />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 700, color: 'white',
              boxShadow: '0 0 32px rgba(109,40,217,0.35)',
            }}>
              {getInitials(data.orgName)}
            </div>
          )}
        </div>

        {/* Org name */}
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 36, fontWeight: 700, color: '#F1F5F9',
          marginBottom: 6, letterSpacing: '-0.02em', lineHeight: 1.2,
        }}>
          {data.orgName}
        </h1>

        {/* Tagline */}
        <p style={{ fontSize: 15, color: 'rgba(241,245,249,0.55)', marginBottom: 16 }}>
          Security &amp; Compliance Status
        </p>

        {/* Last updated */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 28 }}>
          <Clock size={12} style={{ color: 'rgba(241,245,249,0.35)' }} />
          <span style={{ fontSize: 12, color: 'rgba(241,245,249,0.4)' }}>
            Updated {timeAgo(data.lastUpdated)}
          </span>
        </div>

        {/* Overall score badge */}
        <div style={{ display: 'inline-block', position: 'relative' }}>
          <div style={{
            padding: '20px 40px',
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <span style={{
              fontSize: 56, fontWeight: 800, lineHeight: 1,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.03em',
            }}>
              {data.overallScore}%
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: scoreColor, textTransform: 'uppercase' }}>
              {scoreGrade}
            </span>
          </div>
          <div style={{
            position: 'absolute', inset: -1,
            borderRadius: 21, zIndex: -1,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(6,182,212,0.2) 100%)',
            filter: 'blur(12px)',
          }} />
        </div>
      </div>

      {/* ── Framework compliance grid ─────────────────────────────────────────── */}
      {data.activeFrameworks.length > 0 && (
        <section style={{ marginBottom: 52 }}>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 20, fontWeight: 700, color: '#F1F5F9',
            marginBottom: 20, letterSpacing: '-0.01em',
          }}>
            Framework Compliance
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {data.activeFrameworks.map((fw) => {
              const sc = statusColor(fw.status)
              return (
                <div
                  key={fw.id}
                  style={{
                    padding: '20px 22px',
                    background: 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 16,
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 4, lineHeight: 1.3 }}>
                        {fw.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                          color: 'rgba(6,182,212,0.9)', background: 'rgba(6,182,212,0.12)',
                          border: '1px solid rgba(6,182,212,0.25)',
                          padding: '1px 6px', borderRadius: 4,
                        }}>
                          {fw.shortName}
                        </span>
                        {fw.version && (
                          <span style={{ fontSize: 10, color: 'rgba(241,245,249,0.35)' }}>
                            v{fw.version}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status pill */}
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                      padding: '3px 9px', borderRadius: 99,
                      background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text,
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {fw.status}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{
                      height: 6, borderRadius: 99,
                      background: 'rgba(255,255,255,0.07)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${fw.pct}%`,
                        borderRadius: 99,
                        background: 'linear-gradient(90deg, #8B5CF6 0%, #06B6D4 100%)',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>

                  {/* Percentage + control count */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
                      {fw.pct}%
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(241,245,249,0.45)' }}>
                      {fw.implementedControls} of {fw.totalControls} controls
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Security highlights ───────────────────────────────────────────────── */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 20, fontWeight: 700, color: '#F1F5F9',
          marginBottom: 20, letterSpacing: '-0.01em',
        }}>
          Security Highlights
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {HIGHLIGHTS.map(({ icon: Icon, title, description, color, bg, border }) => (
            <div
              key={title}
              style={{
                padding: '22px 20px',
                background: bg,
                backdropFilter: 'blur(20px)',
                border: `1px solid ${border}`,
                borderRadius: 16,
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `${bg}`,
                border: `1px solid ${border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12,
              }}>
                <Icon size={17} color={color} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 6 }}>
                {title}
              </div>
              <p style={{ fontSize: 13, color: 'rgba(241,245,249,0.55)', lineHeight: 1.6, margin: 0 }}>
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingTop: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 20, height: 20,
            background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
            borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="white" opacity="0.95" />
            </svg>
          </div>
          <span style={{ fontSize: 12, color: 'rgba(241,245,249,0.45)', fontWeight: 500 }}>
            Powered by CompliGuard
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'rgba(241,245,249,0.35)' }}>
          Last verified: {new Date(data.lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </footer>
    </div>
  )
}
