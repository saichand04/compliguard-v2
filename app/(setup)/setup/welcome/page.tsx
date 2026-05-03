'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardProgress } from '@/components/setup-wizard/wizard-progress'
import { WizardStepCard } from '@/components/setup-wizard/wizard-step-card'
import { Server, Cloud, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

const WIZARD_STEPS = [
  { number: 1, name: 'Welcome' },
  { number: 2, name: 'Organization' },
  { number: 3, name: 'Admin Account' },
  { number: 4, name: 'Users' },
  { number: 5, name: 'Email' },
  { number: 6, name: 'Storage' },
  { number: 7, name: 'AI' },
  { number: 8, name: 'Integrations' },
  { number: 9, name: 'Review' },
]

type DeploymentType = 'docker' | 'linux' | 'cloud'

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

  const deploymentOptions = [
    {
      type: 'docker' as DeploymentType,
      icon: <Server className="w-5 h-5" />,
      title: 'Docker',
      description: 'docker compose up — all services containerized with MinIO storage and Redis',
    },
    {
      type: 'linux' as DeploymentType,
      icon: <Monitor className="w-5 h-5" />,
      title: 'Linux Standalone',
      description: 'Node.js + systemd on your Linux server — minimal dependencies',
    },
    {
      type: 'cloud' as DeploymentType,
      icon: <Cloud className="w-5 h-5" />,
      title: 'Cloud (Vercel / Railway)',
      description: 'Deployed to a cloud platform with Neon Postgres and external storage',
    },
  ]

  return (
    <div>
      <WizardProgress steps={WIZARD_STEPS} currentStep={1} />

      <WizardStepCard
        title="Welcome to CompliGuard"
        description="Let's get your compliance workspace set up in about 5 minutes."
        onNext={handleNext}
        nextLabel="Get Started"
        loading={loading}
        className="mt-4"
      >
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">What this wizard will configure</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>✓ Your organization profile</li>
              <li>✓ Administrator account</li>
              <li>✓ Email sending provider</li>
              <li>✓ Evidence storage backend</li>
              <li>✓ AI provider for compliance automation</li>
              <li>✓ Optional: Cloud integrations (AWS, Azure, GitHub)</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              How are you deploying CompliGuard?
            </label>
            <div className="grid gap-3">
              {deploymentOptions.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setDeploymentType(opt.type)}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all',
                    deploymentType === opt.type
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  )}
                >
                  <div className={cn('mt-0.5', deploymentType === opt.type ? 'text-blue-600' : 'text-slate-400')}>
                    {opt.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{opt.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{opt.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </WizardStepCard>
    </div>
  )
}
