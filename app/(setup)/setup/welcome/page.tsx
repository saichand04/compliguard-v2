'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { WizardProgress } from '@/components/setup-wizard/wizard-progress'
import { Server, Cloud, Monitor, ArrowRight, Loader2, Shield, CheckCircle2, LayoutDashboard } from 'lucide-react'

const WIZARD_STEPS = [
  { number: 1, label: 'Welcome' },
  { number: 2, label: 'Org' },
  { number: 3, label: 'Admin' },
  { number: 4, label: 'Users' },
  { number: 5, label: 'Email' },
  { number: 6, label: 'Storage' },
  { number: 7, label: 'AI' },
  { number: 8, label: 'Integrations' },
  { number: 9, label: 'Review' },
]

type DeploymentType = 'docker' | 'linux' | 'cloud'

const DEPLOYMENT_OPTIONS = [
  {
    type: 'docker' as DeploymentType,
    icon: Server,
    title: 'Docker',
    description: 'docker compose up — all services containerized with MinIO storage',
    recommended: true,
  },
  {
    type: 'linux' as DeploymentType,
    icon: Monitor,
    title: 'Linux Standalone',
    description: 'Node.js + systemd on your Linux server — minimal dependencies',
    recommended: false,
  },
  {
    type: 'cloud' as DeploymentType,
    icon: Cloud,
    title: 'Cloud (Vercel / Railway)',
    description: 'Deployed to a cloud platform with Neon Postgres and external storage',
    recommended: false,
  },
]

const WHAT_WELL_CONFIGURE = [
  'Organization profile and branding',
  'Administrator account & user invitations',
  'Email delivery provider (SMTP / SendGrid)',
  'Evidence storage backend (local, S3, Azure Blob)',
  'AI provider for compliance automation',
  'Optional: Cloud integrations (Azure, AWS, GitHub)',
]

export default function WelcomePage() {
  const router = useRouter()
  const [deploymentType, setDeploymentType] = useState<DeploymentType>('docker')
  const [loading, setLoading] = useState(false)

  const handleNext = async () => {
    setLoading(true)
    try {
      await fetch('/api/setup/step/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deploymentType }),
      })
      router.push('/setup/organization')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <WizardProgress steps={WIZARD_STEPS} currentStep={1} />

      {/* Card */}
      <div className="glass-strong" style={{ borderRadius: 'var(--radius-xl)', padding: '32px' }}>

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36,
              background: 'var(--violet-dim)',
              border: '1px solid rgba(139,92,246,0.30)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={17} style={{ color: 'var(--violet)' }} />
            </div>
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}>
              Welcome to CompliGuard
            </h1>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Let's get your compliance workspace set up in about 5 minutes. You can change any setting later.
          </p>
        </div>

        {/* What we'll configure */}
        <div style={{
          background: 'var(--violet-dim)',
          border: '1px solid rgba(139,92,246,0.20)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--violet)', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            What this wizard configures
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            {WHAT_WELL_CONFIGURE.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                <CheckCircle2 size={12} style={{ color: 'var(--emerald)', marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Deployment type */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
            How are you deploying CompliGuard?
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEPLOYMENT_OPTIONS.map(({ type, icon: Icon, title, description, recommended }) => {
              const selected = deploymentType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDeploymentType(type)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '13px 15px',
                    background: selected ? 'var(--bg-surface-active)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selected ? 'var(--border-active)' : 'var(--border-glass)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    boxShadow: selected ? '0 0 12px rgba(139,92,246,0.12)' : 'none',
                  }}
                >
                  <div style={{
                    width: 32, height: 32,
                    background: selected ? 'var(--violet-dim)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selected ? 'rgba(139,92,246,0.30)' : 'var(--border-glass)'}`,
                    borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={15} style={{ color: selected ? 'var(--violet)' : 'var(--text-muted)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: selected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {title}
                      </span>
                      {recommended && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 700,
                          padding: '1px 6px', borderRadius: 99,
                          background: 'var(--emerald-dim)',
                          color: 'var(--emerald)',
                          border: '1px solid rgba(16,185,129,0.25)',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                        }}>
                          Recommended
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{description}</span>
                  </div>
                  {/* Radio indicator */}
                  <div style={{
                    width: 16, height: 16,
                    borderRadius: '50%',
                    border: `2px solid ${selected ? 'var(--violet)' : 'var(--border-glass-strong)'}`,
                    background: selected ? 'var(--violet)' : 'transparent',
                    flexShrink: 0,
                    marginTop: 2,
                    boxShadow: selected ? '0 0 6px rgba(139,92,246,0.5)' : 'none',
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}>
                    {selected && (
                      <div style={{
                        position: 'absolute', inset: 3,
                        background: 'white',
                        borderRadius: '50%',
                        opacity: 0.9,
                      }} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Master skip — always available */}
          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontSize: 13, color: 'var(--text-muted)',
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-glass)',
              background: 'transparent',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
              e.currentTarget.style.color = 'var(--text-secondary)'
              e.currentTarget.style.borderColor = 'var(--border-glass-strong)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--border-glass)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <LayoutDashboard size={13} />
            Skip setup — Go to Dashboard
          </Link>

          <button
            onClick={handleNext}
            disabled={loading}
            className="btn-primary"
            style={{ minWidth: 140 }}
          >
            {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {loading ? 'Saving…' : 'Get Started'}
            {!loading && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
