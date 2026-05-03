import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'CompliGuard — AI-Powered GRC Platform',
    template: '%s | CompliGuard',
  },
  description:
    'The compliance platform built for Microsoft 365 and Azure shops. Manage SOC 2, ISO 27001, HIPAA, and 50+ frameworks.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ minHeight: '100dvh', background: 'var(--bg-base)', WebkitFontSmoothing: 'antialiased' }}>
        {children}
      </body>
    </html>
  )
}
