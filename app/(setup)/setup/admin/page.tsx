'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { WizardProgress } from '@/components/setup-wizard/wizard-progress'
import { WizardStepCard } from '@/components/setup-wizard/wizard-step-card'
import { AlertTriangle } from 'lucide-react'

const WIZARD_STEPS = [
  { number: 1, name: 'Welcome' }, { number: 2, name: 'Organization' },
  { number: 3, name: 'Admin Account' }, { number: 4, name: 'Users' },
  { number: 5, name: 'Email' }, { number: 6, name: 'Storage' },
  { number: 7, name: 'AI' }, { number: 8, name: 'Integrations' }, { number: 9, name: 'Review' },
]

const adminSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'At least 8 characters').regex(/[A-Z]/, 'Must include uppercase').regex(/[0-9]/, 'Must include number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })

type AdminFormData = z.infer<typeof adminSchema>

export default function AdminAccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<AdminFormData>({
    resolver: zodResolver(adminSchema),
  })

  const password = watch('password', '')

  const onNext = handleSubmit(async (data) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/step/3', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Failed to create admin account')
        return
      }
      router.push('/setup/users')
    } finally {
      setLoading(false)
    }
  })

  const getStrength = (pwd: string) => {
    let score = 0
    if (pwd.length >= 8) score++
    if (pwd.length >= 12) score++
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++
    return score
  }
  const strength = getStrength(password)

  return (
    <div>
      <WizardProgress steps={WIZARD_STEPS} currentStep={3} />

      <WizardStepCard
        title="Create the administrator account"
        description="This will be the primary super administrator for your CompliGuard instance."
        onBack={() => router.push('/setup/organization')}
        onNext={onNext}
        loading={loading}
        className="mt-4"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-xs">
              This account will have full system access including settings, user management, and all compliance data. Store the credentials securely.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">First name *</label>
              <input className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...register('firstName')} />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Last name *</label>
              <input className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...register('lastName')} />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email address *</label>
            <input type="email" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="admin@company.com" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password *</label>
            <input type="password" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...register('password')} />
            {password && (
              <div className="mt-1 flex gap-1">
                {[1,2,3,4].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength ? ['bg-red-500','bg-amber-500','bg-yellow-400','bg-green-500'][strength-1] || 'bg-green-500' : 'bg-slate-200'}`} />
                ))}
              </div>
            )}
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm password *</label>
            <input type="password" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
          </div>
        </div>
      </WizardStepCard>
    </div>
  )
}
