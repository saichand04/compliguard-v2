'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface WizardStep {
  number: number
  name: string
  description?: string
}

interface WizardProgressProps {
  steps: WizardStep[]
  currentStep: number
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <div className="w-full py-6 px-4">
      <div className="flex items-center justify-between relative">
        {/* Connecting line */}
        <div className="absolute top-4 left-0 right-0 h-px bg-slate-200 dark:bg-slate-700" />
        <div
          className="absolute top-4 left-0 h-px bg-blue-600 transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step) => {
          const isCompleted = step.number < currentStep
          const isCurrent = step.number === currentStep
          const isUpcoming = step.number > currentStep

          return (
            <div key={step.number} className="relative flex flex-col items-center gap-1 z-10">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm font-semibold transition-all',
                  isCompleted && 'bg-blue-600 border-blue-600 text-white',
                  isCurrent && 'bg-white border-blue-600 text-blue-600 dark:bg-slate-800',
                  isUpcoming && 'bg-white border-slate-300 text-slate-400 dark:bg-slate-800 dark:border-slate-600'
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap hidden sm:block',
                  isCurrent && 'text-blue-600',
                  isCompleted && 'text-slate-600 dark:text-slate-400',
                  isUpcoming && 'text-slate-400'
                )}
              >
                {step.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
