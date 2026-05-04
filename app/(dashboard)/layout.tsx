import { getSession } from '@/lib/auth/jwt'
import { redirect } from 'next/navigation'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { ChatWidget } from '@/components/ai/chat-widget'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/signin')

  return (
    <div style={{ position: 'relative', height: '100dvh', display: 'flex', overflow: 'hidden' }}>
      {/* Ambient background — persists across all dashboard pages */}
      <div className="cg-bg" />

      {/* Sidebar */}
      <DashboardSidebar role={session.role} />

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <DashboardHeader
          firstName={session.firstName || ''}
          lastName={session.lastName || ''}
          email={session.email}
          role={session.role}
        />
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '24px',
          }}
        >
          {children}
        </main>
      </div>
      <ChatWidget />
    </div>
  )
}
