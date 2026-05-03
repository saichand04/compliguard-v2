'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { WizardProgress } from '@/components/setup-wizard/wizard-progress'
import { WizardStepCard } from '@/components/setup-wizard/wizard-step-card'

const WIZARD_STEPS = [
  { number: 1, label: 'Welcome' },
  { number: 2, label: 'Organization' },
  { number: 3, label: 'Admin Account' },
  { number: 4, label: 'Users' },
  { number: 5, label: 'Email' },
  { number: 6, label: 'Storage' },
  { number: 7, label: 'AI' },
  { number: 8, label: 'Integrations' },
  { number: 9, label: 'Review' },
]

const orgSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
})

type OrgFormData = z.infer<typeof orgSchema>

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance / Banking', 'Insurance', 'Retail / E-commerce',
  'Manufacturing', 'Education', 'Government', 'Legal', 'Consulting', 'Media / Entertainment', 'Other',
]

const SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+']

export default function OrganizationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema),
  })

  const onNext = handleSubmit(async (data) => {
    setLoading(true)
    try {
      await fetch('/api/setup/step/2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      router.push('/setup/admin')
    } finally {
      setLoading(false)
    }
  })

  return (
    <div>
      <WizardProgress steps={WIZARD_STEPS} currentStep={2} />

      <WizardStepCard
        title="Tell us about your organization"
        description="This information will appear on your trust portal and compliance reports."
        onBack={() => router.push('/setup/welcome')}
        onNext={onNext}
        loading={loading}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Organization name <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Acme Corp"
              {...register('name')}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Primary domain
            </label>
            <input
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="acme.com"
              {...register('domain')}
            />
            <p className="mt-1 text-xs text-slate-400">Used to auto-approve users signing up with this email domain</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Industry</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                {...register('industry')}
              >
                <option value="">Select industry…</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company size</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                {...register('size')}
              >
                <option value="">Select size…</option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>{s} employees</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </WizardStepCard>
    </div>
  )
}
