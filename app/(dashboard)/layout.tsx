import { getSession } from '@/lib/auth/jwt'
import { redirect } from 'next/navigation'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/auth/signin')

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <DashboardSidebar role={session.role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader
          firstName={session.firstName || ''}
          lastName={session.lastName || ''}
          email={session.email}
          role={session.role}
        />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
