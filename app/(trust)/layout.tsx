import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Trust Portal — CompliGuard',
  description: 'Public compliance and security status portal',
}

export default function TrustLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#080B18',
        color: '#F1F5F9',
      }}
    >
      {children}
    </div>
  )
}
