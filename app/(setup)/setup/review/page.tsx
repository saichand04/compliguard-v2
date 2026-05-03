'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardProgress } from '@/components/setup-wizard/wizard-progress'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const WIZARD_STEPS = [
  { number: 1, label: 'Welcome' }, { number: 2, label: 'Organization' },
  { number: 3, label: 'Admin Account' }, { number: 4, label: 'Users' },
  { number: 5, label: 'Email' }, { number: 6, label: 'Storage' },
  { number: 7, label: 'AI' }, { number: 8, label: 'Integrations' }, { number: 9, label: 'Review' },
]

interface SetupSummaryItem {
  label: string
  status: 'configured' | 'skipped' | 'required'
  detail?: string
}

export default function ReviewPage() {
  const router = useRouter()
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // In a real flow, this would be fetched from server state
  const summaryItems: SetupSummaryItem[] = [
    { label: 'Organization', status: 'configured', detail: 'Profile saved' },
    { label: 'Administrator Account', status: 'configured', detail: 'Super admin created' },
    { label: 'Team Members', status: 'skipped', detail: 'Add from Settings → Users' },
    { label: 'Email Provider', status: 'configured', detail: 'Outbound email configured' },
    { label: 'Storage Provider', status: 'configured', detail: 'Files will be stored locally' },
    { label: 'AI Provider', status: 'configured', detail: 'OpenAI GPT-4o-mini' },
    { label: 'Cloud Integrations', status: 'skipped', detail: 'Configure from Integrations page' },
  ]

  const handleLaunch = async () => {
    setLaunching(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/complete', { method: 'POST' })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Failed to complete setup')
        return
      }
      router.push('/dashboard')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div>
      <WizardProgress steps={WIZARD_STEPS} currentStep={9} />

      <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="px-8 pt-8 pb-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Review & Launch</h2>
          <p className="text-sm text-slate-500 mt-1">Review your configuration before launching CompliGuard.</p>
        </div>

        <div className="px-8 py-6">
          <div className="space-y-3">
            {summaryItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                <div className="flex items-center gap-3">
                  {item.status === 'configured' ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  ) : item.status === 'skipped' ? (
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</span>
                </div>
                <span className="text-xs text-slate-500">{item.detail}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="px-8 pb-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/setup/integrations')}
            className="text-sm text-slate-500 hover:text-slate-700 font-medium"
          >
            ← Back
          </button>

          <button
            type="button"
            onClick={handleLaunch}
            disabled={launching}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 px-6 rounded-md text-sm transition-colors"
          >
            {launching && <Loader2 className="w-4 h-4 animate-spin" />}
            {launching ? 'Launching…' : '🚀 Launch CompliGuard'}
          </button>
        </div>
      </div>
    </div>
  )
}
