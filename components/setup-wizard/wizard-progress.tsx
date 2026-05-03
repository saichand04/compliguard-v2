import { Check } from 'lucide-react'

interface WizardStep {
  number: number
  label: string
  description?: string
}

interface WizardProgressProps {
  steps: WizardStep[]
  currentStep: number
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <div style={{ marginBottom: 32 }}>
      {/* Step counter */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          Step {currentStep} of {steps.length}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {Math.round(((currentStep - 1) / steps.length) * 100)}% complete
        </span>
      </div>

      {/* Track */}
      <div className="progress-track" style={{ marginBottom: 20 }}>
        <div
          className="progress-fill"
          style={{ width: `${((currentStep - 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Step dots — compact row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        position: 'relative',
        gap: 4,
      }}>
        {steps.map((step) => {
          const isComplete = step.number < currentStep
          const isCurrent  = step.number === currentStep
          const isPending  = step.number > currentStep

          return (
            <div
              key={step.number}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                flex: 1,
              }}
            >
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isComplete
                  ? 'linear-gradient(135deg, #7C3AED, #06B6D4)'
                  : isCurrent
                    ? 'var(--violet-dim)'
                    : 'rgba(255,255,255,0.04)',
                border: isCurrent
                  ? '2px solid var(--violet)'
                  : isComplete
                    ? '2px solid transparent'
                    : '1px solid var(--border-glass)',
                boxShadow: isCurrent ? '0 0 12px rgba(139,92,246,0.45)' : 'none',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}>
                {isComplete ? (
                  <Check size={12} style={{ color: 'white' }} />
                ) : (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: isCurrent ? 'var(--violet)' : 'var(--text-muted)',
                  }}>
                    {step.number}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 9.5,
                fontWeight: isCurrent ? 600 : 400,
                color: isComplete ? 'var(--emerald)' : isCurrent ? 'var(--violet)' : 'var(--text-muted)',
                textAlign: 'center',
                lineHeight: 1.2,
                letterSpacing: '0.01em',
                maxWidth: 60,
              }}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
