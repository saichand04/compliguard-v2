'use client'

import { cn } from '@/lib/utils'
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
  className?: string
}

export function WizardStepCard({
  title,
  description,
  children,
  onBack,
  onNext,
  nextLabel = 'Next',
  backLabel = 'Back',
  nextDisabled = false,
  loading = false,
  skipLabel,
  onSkip,
  className,
}: WizardStepCardProps) {
  return (
    <div className={cn('bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700', className)}>
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-slate-100 dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>

      {/* Body */}
      <div className="px-8 py-6">{children}</div>

      {/* Footer */}
      <div className="px-8 pb-8 flex items-center justify-between">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {backLabel}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {skipLabel && onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-slate-400 hover:text-slate-600 font-medium transition-colors"
            >
              {skipLabel}
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled || loading}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-5 rounded-md text-sm transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {nextLabel}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
