export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Ambient background */}
      <div className="cg-bg" />

      {/* Top brand bar */}
      <div
        className="glass-header"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28,
            height: 28,
            background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(109,40,217,0.40)',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="white" opacity="0.95"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            CompliGuard
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: 99,
            background: 'var(--violet-dim)',
            color: 'var(--violet)',
            border: '1px solid rgba(139,92,246,0.25)',
            marginLeft: 4,
          }}>
            Setup
          </span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          Initial configuration — you can change all settings later
        </div>
      </div>

      {/* Page content with top padding for fixed header */}
      <div
        style={{
          paddingTop: 56,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 24px 40px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 580, position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
