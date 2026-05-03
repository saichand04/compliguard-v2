'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardProgress } from '@/components/setup-wizard/wizard-progress'
import { WizardStepCard } from '@/components/setup-wizard/wizard-step-card'
import { Plus, Trash2 } from 'lucide-react'

const WIZARD_STEPS = [
  { number: 1, label: 'Welcome' }, { number: 2, label: 'Organization' },
  { number: 3, label: 'Admin Account' }, { number: 4, label: 'Users' },
  { number: 5, label: 'Email' }, { number: 6, label: 'Storage' },
  { number: 7, label: 'AI' }, { number: 8, label: 'Integrations' }, { number: 9, label: 'Review' },
]

interface InviteRow {
  id: string
  email: string
  role: string
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'compliance_manager', label: 'Compliance Manager' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'user', label: 'User' },
]

export default function InviteUsersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<InviteRow[]>([
    { id: crypto.randomUUID(), email: '', role: 'compliance_manager' },
  ])

  const addRow = () => {
    setRows((prev) => [...prev, { id: crypto.randomUUID(), email: '', role: 'user' }])
  }

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const updateRow = (id: string, field: keyof InviteRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const handleNext = async () => {
    setLoading(true)
    const validRows = rows.filter((r) => r.email.trim() && r.email.includes('@'))
    try {
      await fetch('/api/setup/step/4', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invites: validRows }),
      })
      router.push('/setup/email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <WizardProgress steps={WIZARD_STEPS} currentStep={4} />

      <WizardStepCard
        title="Invite your team"
        description="Add team members now or skip and invite them later from Settings → Users."
        onBack={() => router.push('/setup/admin')}
        onNext={handleNext}
        nextLabel="Next"
        skipLabel="Skip for now"
        onSkip={() => router.push('/setup/email')}
        loading={loading}
      >
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <input
                type="email"
                value={row.email}
                onChange={(e) => updateRow(row.id, 'email', e.target.value)}
                placeholder="colleague@company.com"
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={row.role}
                onChange={(e) => updateRow(row.id, 'role', e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add another person
          </button>
        </div>
      </WizardStepCard>
    </div>
  )
}
