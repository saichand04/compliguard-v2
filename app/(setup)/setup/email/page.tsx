'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardProgress } from '@/components/setup-wizard/wizard-progress'
import { WizardStepCard } from '@/components/setup-wizard/wizard-step-card'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const WIZARD_STEPS = [
  { number: 1, name: 'Welcome' }, { number: 2, name: 'Organization' },
  { number: 3, name: 'Admin Account' }, { number: 4, name: 'Users' },
  { number: 5, name: 'Email' }, { number: 6, name: 'Storage' },
  { number: 7, name: 'AI' }, { number: 8, name: 'Integrations' }, { number: 9, name: 'Review' },
]

type EmailProvider = 'resend' | 'sendgrid' | 'postmark' | 'smtp'

export default function EmailSetupPage() {
  const router = useRouter()
  const [provider, setProvider] = useState<EmailProvider>('resend')
  const [apiKey, setApiKey] = useState('')
  const [fromAddress, setFromAddress] = useState('')
  const [inboundEmail, setInboundEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const res = await fetch('/api/setup/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey, fromAddress }),
    })
    const data = await res.json()
    setTestResult(data)
    setTesting(false)
  }

  const handleNext = async () => {
    setLoading(true)
    try {
      await fetch('/api/setup/step/5', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailProvider: provider, apiKey, fromAddress, inboundEmail }),
      })
      router.push('/setup/storage')
    } finally {
      setLoading(false)
    }
  }

  const providers: { value: EmailProvider; label: string; placeholder: string }[] = [
    { value: 'resend', label: 'Resend', placeholder: 're_...' },
    { value: 'sendgrid', label: 'SendGrid', placeholder: 'SG...' },
    { value: 'postmark', label: 'Postmark', placeholder: 'Server API token' },
    { value: 'smtp', label: 'SMTP', placeholder: 'Not needed for SMTP' },
  ]

  return (
    <div>
      <WizardProgress steps={WIZARD_STEPS} currentStep={5} />

      <WizardStepCard
        title="Email configuration"
        description="Configure how CompliGuard sends notifications, invites, and evidence requests."
        onBack={() => router.push('/setup/users')}
        onNext={handleNext}
        loading={loading}
        className="mt-4"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email provider</label>
            <div className="grid grid-cols-2 gap-2">
              {providers.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setProvider(p.value)}
                  className={cn(
                    'px-4 py-2 border-2 rounded-md text-sm font-medium text-left transition-all',
                    provider === p.value ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {provider !== 'smtp' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={providers.find(p => p.value === provider)?.placeholder}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From address *</label>
            <input
              type="email"
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              placeholder="compliance@yourcompany.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Platform inbound email <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="email"
              value={inboundEmail}
              onChange={(e) => setInboundEmail(e.target.value)}
              placeholder="evidence@inbound.yourcompany.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-400">Postmark Inbound Parse address — users can reply to evidence requests with attachments</p>
          </div>

          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !fromAddress}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
          >
            {testing && <Loader2 className="w-4 h-4 animate-spin" />}
            Send test email
          </button>

          {testResult && (
            <div className={cn('flex items-start gap-2 text-sm p-3 rounded-md', testResult.ok ? 'bg-green-50 text-green-700 dark:bg-green-950' : 'bg-red-50 text-red-700 dark:bg-red-950')}>
              {testResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {testResult.message}
            </div>
          )}
        </div>
      </WizardStepCard>
    </div>
  )
}
