import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Upload Evidence — CompliGuard',
  description: 'Secure evidence upload portal',
}

export default function UploadLayout({ children }: { children: React.ReactNode }) {
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
