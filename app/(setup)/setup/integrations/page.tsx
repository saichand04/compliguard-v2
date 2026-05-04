'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardProgress } from '@/components/setup-wizard/wizard-progress'
import { WizardStepCard } from '@/components/setup-wizard/wizard-step-card'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const WIZARD_STEPS = [
  { number: 1, label: 'Welcome' }, { number: 2, label: 'Organization' },
  { number: 3, label: 'Admin Account' }, { number: 4, label: 'Users' },
  { number: 5, label: 'Email' }, { number: 6, label: 'Storage' },
  { number: 7, label: 'AI' }, { number: 8, label: 'Integrations' }, { number: 9, label: 'Review' },
]

interface IntegrationConfig {
  tenantId?: string
  clientId?: string
  clientSecret?: string
  accessKeyId?: string
  secretAccessKey?: string
  region?: string
  githubToken?: string
}

export default function IntegrationsPage() {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [configs, setConfigs] = useState<Record<string, IntegrationConfig>>({
    azure: {},
    aws: {},
    github: {},
  })

  const updateConfig = (integration: string, key: string, value: string) => {
    setConfigs((prev) => ({ ...prev, [integration]: { ...prev[integration], [key]: value } }))
  }

  const handleNext = async () => {
    setLoading(true)
    try {
      await fetch('/api/setup/step/8', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrations: configs }),
      })
      router.push('/setup/review')
    } finally {
      setLoading(false)
    }
  }

  const integrations = [
    {
      id: 'azure',
      name: 'Azure Entra ID',
      description: 'Sync users, groups, MFA status, Conditional Access, and more',
      fields: [
        { key: 'tenantId', label: 'Tenant ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
        { key: 'clientId', label: 'Client ID (App Registration)', placeholder: 'xxxxxxxx-xxxx-...' },
        { key: 'clientSecret', label: 'Client Secret', placeholder: '•••••••••' },
      ],
    },
    {
      id: 'aws',
      name: 'AWS',
      description: 'Scan 40+ AWS services for compliance controls and security findings',
      fields: [
        { key: 'accessKeyId', label: 'Access Key ID', placeholder: 'AKIA...' },
        { key: 'secretAccessKey', label: 'Secret Access Key', placeholder: '•••••••' },
        { key: 'region', label: 'Default Region', placeholder: 'us-east-1' },
      ],
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Check branch protection, secret scanning, code security policies',
      fields: [
        { key: 'githubToken', label: 'Personal Access Token', placeholder: 'ghp_...' },
      ],
    },
  ]

  return (
    <div>
      <WizardProgress steps={WIZARD_STEPS} currentStep={8} />

      <WizardStepCard
        title="Configure integrations"
        description="Connect cloud providers and tools to automate evidence collection. All steps here are optional."
        onBack={() => router.push('/setup/ai')}
        onNext={handleNext}
        loading={loading}
        skipLabel="Skip for now"
        onSkip={() => router.push('/setup/review')}
      >
        <div className="space-y-3">
          {integrations.map((integration) => (
            <div key={integration.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(expanded === integration.id ? null : integration.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{integration.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{integration.description}</div>
                </div>
                {expanded === integration.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {expanded === integration.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700">
                  {integration.fields.map((field) => (
                    <div key={field.key} className="mt-3">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{field.label}</label>
                      <input
                        type={field.key.toLowerCase().includes('secret') || field.key.toLowerCase().includes('key') || field.key.toLowerCase().includes('token') ? 'password' : 'text'}
                        value={(configs[integration.id] as Record<string, string>)[field.key] || ''}
                        onChange={(e) => updateConfig(integration.id, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </WizardStepCard>
    </div>
  )
}
