import { getSession } from '@/lib/auth/jwt'
import { redirect } from 'next/navigation'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/signin')

  const isAdmin = ['super_admin', 'admin'].includes(session.role)

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Access Restricted
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Settings are only available to administrators.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
