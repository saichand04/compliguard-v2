'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardProgress } from '@/components/setup-wizard/wizard-progress'
import { WizardStepCard } from '@/components/setup-wizard/wizard-step-card'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const WIZARD_STEPS = [
  { number: 1, label: 'Welcome' }, { number: 2, label: 'Organization' },
  { number: 3, label: 'Admin Account' }, { number: 4, label: 'Users' },
  { number: 5, label: 'Email' }, { number: 6, label: 'Storage' },
  { number: 7, label: 'AI' }, { number: 8, label: 'Integrations' }, { number: 9, label: 'Review' },
]

type StorageProvider = 'local' | 's3' | 'azure-blob' | 'onedrive' | 'minio'

export default function StorageSetupPage() {
  const router = useRouter()
  const [provider, setProvider] = useState<StorageProvider>('local')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const updateConfig = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const res = await fetch('/api/setup/test-storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, config }),
    })
    const data = await res.json()
    setTestResult(data)
    setTesting(false)
  }

  const handleNext = async () => {
    setLoading(true)
    try {
      await fetch('/api/setup/step/6', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageProvider: provider, config }),
      })
      router.push('/setup/ai')
    } finally {
      setLoading(false)
    }
  }

  const providers = [
    { value: 'local' as StorageProvider, label: 'Local Filesystem', description: 'Stores files on the server disk' },
    { value: 'minio' as StorageProvider, label: 'MinIO', description: 'S3-compatible, bundled in Docker' },
    { value: 's3' as StorageProvider, label: 'AWS S3', description: 'Amazon Simple Storage Service' },
    { value: 'azure-blob' as StorageProvider, label: 'Azure Blob', description: 'Microsoft Azure Blob Storage' },
    { value: 'onedrive' as StorageProvider, label: 'OneDrive', description: 'Microsoft OneDrive / SharePoint' },
  ]

  return (
    <div>
      <WizardProgress steps={WIZARD_STEPS} currentStep={6} />

      <WizardStepCard
        title="Storage configuration"
        description="Choose where evidence files and policy documents will be stored."
        onBack={() => router.push('/setup/email')}
        onNext={handleNext}
        loading={loading}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2">
            {providers.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => { setProvider(p.value); setTestResult(null) }}
                className={cn(
                  'flex items-start gap-3 p-3 border-2 rounded-md text-left transition-all',
                  provider === p.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-slate-200 dark:border-slate-700'
                )}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">{p.label}</div>
                  <div className="text-xs text-slate-500">{p.description}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Dynamic config fields */}
          {provider === 'local' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Storage path</label>
              <input
                value={config.localPath || ''}
                onChange={(e) => updateConfig('localPath', e.target.value)}
                placeholder="/var/lib/compliguard/evidence"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {(provider === 's3' || provider === 'minio') && (
            <div className="space-y-3">
              {provider === 'minio' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">MinIO Endpoint</label>
                  <input value={config.endpoint || ''} onChange={(e) => updateConfig('endpoint', e.target.value)} placeholder="http://minio:9000" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bucket name</label>
                <input value={config.bucket || ''} onChange={(e) => updateConfig('bucket', e.target.value)} placeholder="evidence" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Access Key ID</label>
                  <input type="password" value={config.accessKeyId || ''} onChange={(e) => updateConfig('accessKeyId', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Secret Access Key</label>
                  <input type="password" value={config.secretAccessKey || ''} onChange={(e) => updateConfig('secretAccessKey', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
          )}

          {provider === 'azure-blob' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Connection String</label>
                <input type="password" value={config.connectionString || ''} onChange={(e) => updateConfig('connectionString', e.target.value)} placeholder="DefaultEndpointsProtocol=https;..." className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Container name</label>
                <input value={config.container || ''} onChange={(e) => updateConfig('container', e.target.value)} placeholder="evidence" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          {provider === 'onedrive' && (
            <div className="space-y-3">
              {[['tenantId', 'Tenant ID'], ['clientId', 'Client ID'], ['clientSecret', 'Client Secret'], ['driveId', 'Drive ID']].map(([key, label]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input type="password" value={config[key] || ''} onChange={(e) => updateConfig(key, e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
          >
            {testing && <Loader2 className="w-4 h-4 animate-spin" />}
            Test connection
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
