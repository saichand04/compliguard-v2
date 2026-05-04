import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CompliGuard',
  description: 'Vendor questionnaire portal',
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
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
