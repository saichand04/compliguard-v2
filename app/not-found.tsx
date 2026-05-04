'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, ArrowLeft, Clock, Zap, BarChart3, GitBranch, Users2, FileText, Plug } from 'lucide-react'

const COMING_SOON = [
  { icon: BarChart3, label: 'Reports & Analytics',      phase: 'Phase 2', color: '#8B5CF6' },
  { icon: FileText,  label: 'Evidence Management',      phase: 'Phase 2', color: '#06B6D4' },
  { icon: Clock,     label: 'Risk Register',             phase: 'Phase 2', color: '#F59E0B' },
  { icon: GitBranch, label: 'Findings & Tasks',          phase: 'Phase 2', color: '#10B981' },
  { icon: Users2,    label: 'Vendors & People',          phase: 'Phase 2', color: '#8B5CF6' },
  { icon: Plug,      label: 'Cloud Integrations',        phase: 'Phase 3', color: '#06B6D4' },
  { icon: Zap,       label: 'Azure-Native Deep Sync',    phase: 'Phase 4', color: '#F59E0B' },
  { icon: Shield,    label: 'OpenClaw MCP Integration',  phase: 'Phase 6', color: '#EF4444' },
]

export default function NotFound() {
  const router = useRouter()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base, #080B18)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `
          radial-gradient(ellipse 70% 50% at 20% 20%, rgba(139,92,246,0.14) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 80% 70%, rgba(6,182,212,0.10) 0%, transparent 55%)
        `,
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, width: '100%', textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(109,40,217,0.4)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="white" opacity="0.95"/>
            </svg>
          </div>
          <span style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 20, fontWeight: 700,
            color: 'var(--text-primary, #F1F5F9)',
            letterSpacing: '-0.01em',
          }}>CompliGuard</span>
        </div>

        {/* 404 badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: 100, padding: '6px 16px', marginBottom: 24,
        }}>
          <Clock size={13} style={{ color: '#A78BFA' }} />
          <span style={{ fontSize: 12, color: '#A78BFA', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Coming Soon
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(40px, 6vw, 64px)',
          fontWeight: 700,
          color: 'var(--text-primary, #F1F5F9)',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          marginBottom: 16,
        }}>
          This feature is{' '}
          <span style={{
            background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>on the roadmap</span>
        </h1>

        <p style={{
          fontSize: 16, color: 'rgba(148,163,184,0.8)',
          lineHeight: 1.7, marginBottom: 40, maxWidth: 480, margin: '0 auto 40px',
        }}>
          CompliGuard is actively being built. Core compliance features are live — the modules below are coming in upcoming phases.
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56 }}>
          <button
            onClick={() => router.back()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 22px', borderRadius: 9, cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--text-primary, #F1F5F9)', fontSize: 14, fontWeight: 500,
              fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
          >
            <ArrowLeft size={15} /> Go back
          </button>

          <Link href="/dashboard" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 22px', borderRadius: 9, textDecoration: 'none',
            background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
            color: 'white', fontSize: 14, fontWeight: 600,
            boxShadow: '0 0 24px rgba(124,58,237,0.35)',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 36px rgba(124,58,237,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.35)'; e.currentTarget.style.transform = 'none' }}
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Roadmap grid */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '24px',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18, textAlign: 'left' }}>
            Platform Roadmap
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, textAlign: 'left' }}>
            {COMING_SOON.map(({ icon: Icon, label, phase, color }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: `${color}15`, border: `1px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary, #CBD5E1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {label}
                  </div>
                </div>
                <span style={{
                  fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap',
                  padding: '2px 8px', borderRadius: 100,
                  background: `${color}15`, color, border: `1px solid ${color}30`,
                }}>
                  {phase}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
