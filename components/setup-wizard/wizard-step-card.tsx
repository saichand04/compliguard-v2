'use client'

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'

interface WizardStepCardProps {
  title: string
  description: string
  children: React.ReactNode
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  backLabel?: string
  nextDisabled?: boolean
  loading?: boolean
  skipLabel?: string
  onSkip?: () => void
  icon?: React.ReactNode
}

export function WizardStepCard({
  title,
  description,
  children,
  onBack,
  onNext,
  nextLabel = 'Continue',
  backLabel = 'Back',
  nextDisabled = false,
  loading = false,
  skipLabel,
  onSkip,
  icon,
}: WizardStepCardProps) {
  return (
    <div
      className="glass-strong animate-fade-up"
      style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}
    >
      {/* Header */}
      <div style={{
        padding: '24px 28px 20px',
        borderBottom: '1px solid var(--border-glass)',
      }}>
        {icon && (
          <div style={{ marginBottom: 12 }}>{icon}</div>
        )}
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
          marginBottom: 6,
        }}>
          {title}
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>{description}</p>
      </div>

      {/* Body */}
      <div style={{ padding: '24px 28px' }}>{children}</div>

      {/* Footer */}
      <div style={{
        padding: '16px 28px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid var(--border-glass)',
      }}>
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn-ghost"
              style={{ fontSize: 13 }}
            >
              <ArrowLeft size={14} />
              {backLabel}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {skipLabel && onSkip && (
            <button
              type="button"
              onClick={onSkip}
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                padding: '0 8px',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {skipLabel}
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled || loading}
              className="btn-primary"
            >
              {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {nextLabel}
              {!loading && <ArrowRight size={14} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
