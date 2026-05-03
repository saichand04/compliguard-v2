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

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro']

export default function AIProviderPage() {
  const router = useRouter()
  const [aiProvider, setAiProvider] = useState<'openai' | 'gemini'>('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const res = await fetch('/api/setup/test-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiProvider, apiKey, model }),
    })
    const data = await res.json()
    setTestResult(data)
    setTesting(false)
  }

  const handleNext = async () => {
    setLoading(true)
    try {
      await fetch('/api/setup/step/7', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiProvider, apiKey, model }),
      })
      router.push('/setup/integrations')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <WizardProgress steps={WIZARD_STEPS} currentStep={7} />

      <WizardStepCard
        title="AI provider"
        description="CompliGuard uses AI for control mapping, risk analysis, and the compliance assistant."
        onBack={() => router.push('/setup/storage')}
        onNext={handleNext}
        loading={loading}
        className="mt-4"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">AI Provider</label>
            <div className="grid grid-cols-2 gap-3">
              {(['openai', 'gemini'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setAiProvider(p)
                    setModel(p === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash')
                  }}
                  className={cn(
                    'p-4 border-2 rounded-lg text-sm font-medium transition-all',
                    aiProvider === p ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700' : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  )}
                >
                  {p === 'openai' ? 'OpenAI' : 'Google Gemini'}
                  <div className="text-xs font-normal text-slate-400 mt-1">
                    {p === 'openai' ? 'GPT-4o recommended' : 'Gemini 2.0 Flash recommended'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={aiProvider === 'openai' ? 'sk-...' : 'AI...'}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(aiProvider === 'openai' ? OPENAI_MODELS : GEMINI_MODELS).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !apiKey}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
          >
            {testing && <Loader2 className="w-4 h-4 animate-spin" />}
            Test AI connection
          </button>

          {testResult && (
            <div className={cn('flex items-start gap-2 text-sm p-3 rounded-md', testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
              {testResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {testResult.message}
            </div>
          )}
        </div>
      </WizardStepCard>
    </div>
  )
}
