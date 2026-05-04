export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-x-hidden">
      {/* Ambient background */}
      <div className="cg-bg" />

      {/* Extra mid-screen glow for auth pages */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '500px',
          background: 'radial-gradient(ellipse at center, rgba(109,40,217,0.10) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-[420px] animate-fade-up">
        {/* Logo mark */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div
            style={{
              width: 40,
              height: 40,
              background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(109,40,217,0.45)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="white" opacity="0.95"/>
              <path d="M9 12L11 14L15 10" stroke="rgba(109,40,217,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              CompliGuard
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.04em', marginTop: -1 }}>
              AI-Powered GRC Platform
            </div>
          </div>
        </div>

        {/* Glass card */}
        <div className="glass-strong" style={{ borderRadius: 'var(--radius-xl)', padding: '36px 32px' }}>
          {children}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>
          © 2026 CompliGuard — Enterprise GRC
        </p>
      </div>
    </div>
  )
}
