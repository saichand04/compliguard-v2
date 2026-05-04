'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Shield, ArrowRight, ChevronRight, Zap, Search, BarChart3, CheckCircle, Menu, X } from 'lucide-react'

const FRAMEWORKS = [
  'ISO 27001', 'SOC 2', 'HIPAA', 'HITRUST', 'FERPA', 'GDPR',
  'PCI DSS', 'NIST 800-53', 'FedRAMP', 'CCPA', 'ISO 9001', 'SOX',
  'CMMC', 'COBIT', 'NERC CIP', 'ISO 27017', 'ISO 27018', 'NIST CSF',
]

const STATS = [
  { value: '80%', label: 'Faster compliance certification' },
  { value: '50+', label: 'Compliance frameworks supported' },
  { value: '24/7', label: 'Continuous monitoring' },
  { value: '99.9%', label: 'Audit success rate' },
]

const FEATURES = [
  {
    icon: Zap,
    tag: 'Automation',
    title: 'Automated Evidence Collection',
    description: 'Connect to AWS, Azure, Microsoft 365 and more for automatic evidence pulls. Eliminate manual screenshot-and-paste workflows forever.',
    gradient: 'from-violet-500/20 to-transparent',
  },
  {
    icon: Search,
    tag: 'AI Engine',
    title: 'AI-Powered Gap Detection',
    description: 'Identify compliance gaps before auditors do. Our 4-layer mapping engine cross-references NIST 800-53 as a universal anchor across all frameworks.',
    gradient: 'from-cyan-500/20 to-transparent',
  },
  {
    icon: BarChart3,
    tag: 'Visibility',
    title: 'Real-Time Dashboards',
    description: 'Track progress across all frameworks in one unified view. Evidence collected once automatically populates all relevant control requirements.',
    gradient: 'from-violet-500/20 to-transparent',
  },
]

const PROGRESS_ITEMS = [
  { label: 'ISO 27001', pct: 87, color: '#8B5CF6' },
  { label: 'SOC 2 Type II', pct: 92, color: '#06B6D4' },
  { label: 'HIPAA', pct: 85, color: '#8B5CF6' },
  { label: 'HITRUST', pct: 78, color: '#06B6D4' },
]

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Ambient background glows ─────────────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `
          radial-gradient(ellipse 80% 50% at 20% -10%, rgba(139,92,246,0.18) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 80% 10%, rgba(6,182,212,0.12) 0%, transparent 50%),
          radial-gradient(ellipse 50% 60% at 50% 80%, rgba(139,92,246,0.08) 0%, transparent 60%)
        `,
      }} />

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        transition: 'all 0.3s ease',
        background: scrolled ? 'rgba(8,11,24,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(139,92,246,0.4)',
            }}>
              <Shield size={18} color="white" />
            </div>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              CompliGuard
            </span>
          </Link>

          {/* Desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="hide-mobile">
            <a href="#features" style={{ color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
              Features
            </a>
            <a href="#frameworks" style={{ color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
              Frameworks
            </a>
          </div>

          {/* Auth buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="hide-mobile">
            <Link href="/signin" style={{
              fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none',
              padding: '8px 16px', borderRadius: 8,
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent' }}>
              Sign in
            </Link>
            <Link href="/setup/welcome" style={{
              fontSize: 14, fontWeight: 600, color: 'white', textDecoration: 'none',
              padding: '8px 18px', borderRadius: 8,
              background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
              boxShadow: '0 0 20px rgba(139,92,246,0.35)',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 30px rgba(139,92,246,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(139,92,246,0.35)'; e.currentTarget.style.transform = 'none' }}>
              Get Started <ChevronRight size={14} />
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button className="show-mobile" onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 4 }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{
            background: 'rgba(8,11,24,0.96)', backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '16px 24px 24px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <a href="#features" onClick={() => setMenuOpen(false)} style={{ color: 'var(--text-secondary)', fontSize: 15, textDecoration: 'none' }}>Features</a>
              <a href="#frameworks" onClick={() => setMenuOpen(false)} style={{ color: 'var(--text-secondary)', fontSize: 15, textDecoration: 'none' }}>Frameworks</a>
              <hr style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
              <Link href="/signin" style={{ color: 'var(--text-secondary)', fontSize: 15, textDecoration: 'none' }}>Sign in</Link>
              <Link href="/setup/welcome" style={{
                fontSize: 15, fontWeight: 600, color: 'white', textDecoration: 'none',
                padding: '10px 18px', borderRadius: 8, textAlign: 'center',
                background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
              }}>Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, paddingTop: 160, paddingBottom: 100, textAlign: 'center', padding: '160px 24px 100px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 100, padding: '6px 14px', marginBottom: 32,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6', boxShadow: '0 0 8px #8B5CF6' }} />
            <span style={{ fontSize: 12, color: '#A78BFA', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              AI-Powered GRC Platform
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            marginBottom: 24,
          }}>
            AI-Powered{' '}
            <span style={{
              background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Compliance
            </span>{' '}
            Automation.
          </h1>

          {/* Subheadline */}
          <p style={{
            fontSize: 'clamp(16px, 2vw, 20px)',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            maxWidth: 640,
            margin: '0 auto 40px',
          }}>
            Streamline your compliance journey for ISO 27001, SOC 2, HIPAA, HITRUST, FERPA, and more.
            Automate evidence collection, continuous monitoring, and certification management.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/setup/welcome" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 28px', borderRadius: 10, textDecoration: 'none',
              background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
              color: 'white', fontWeight: 600, fontSize: 15,
              boxShadow: '0 0 40px rgba(139,92,246,0.4)',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 60px rgba(139,92,246,0.6)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 40px rgba(139,92,246,0.4)'; e.currentTarget.style.transform = 'none' }}>
              Start Free Trial <ArrowRight size={16} />
            </Link>
            <Link href="/signin" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 28px', borderRadius: 10, textDecoration: 'none',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-primary)', fontWeight: 500, fontSize: 15,
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}>
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 24px 80px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, overflow: 'hidden',
          }} className="stats-grid">
            {STATS.map((s, i) => (
              <div key={i} style={{
                padding: '28px 24px', textAlign: 'center',
                borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}>
                <div style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em',
                  background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  marginBottom: 6,
                }}>{s.value}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" style={{ position: 'relative', zIndex: 1, padding: '60px 24px 100px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{
              display: 'inline-block', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#8B5CF6', marginBottom: 14,
            }}>Automation</span>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700,
              color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 16,
            }}>
              Accelerate compliance.<br />Reduce manual work.
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
              Our AI-powered platform automates evidence collection, control testing, and continuous monitoring.
            </p>
          </div>

          {/* Feature cards row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }} className="features-grid">
            {FEATURES.map((f, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 20, padding: '32px 28px',
                backdropFilter: 'blur(20px)',
                position: 'relative', overflow: 'hidden',
                transition: 'all 0.3s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.border = '1px solid rgba(139,92,246,0.3)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
                onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'none' }}>
                {/* Glow bg */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 120,
                  background: `linear-gradient(to bottom, ${i % 2 === 0 ? 'rgba(139,92,246,0.08)' : 'rgba(6,182,212,0.08)'}, transparent)`,
                  pointerEvents: 'none',
                }} />

                <div style={{
                  width: 44, height: 44, borderRadius: 12, marginBottom: 20,
                  background: i % 2 === 0 ? 'rgba(139,92,246,0.15)' : 'rgba(6,182,212,0.15)',
                  border: `1px solid ${i % 2 === 0 ? 'rgba(139,92,246,0.3)' : 'rgba(6,182,212,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <f.icon size={20} color={i % 2 === 0 ? '#8B5CF6' : '#06B6D4'} />
                </div>

                <span style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: i % 2 === 0 ? '#8B5CF6' : '#06B6D4', marginBottom: 10, display: 'block',
                }}>{f.tag}</span>

                <h3 style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
                  letterSpacing: '-0.01em', marginBottom: 12,
                }}>{f.title}</h3>

                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.description}</p>
              </div>
            ))}
          </div>

          {/* Compliance progress mini-dashboard */}
          <div style={{
            marginTop: 48,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20, padding: '32px 36px',
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                Compliance Progress
              </h3>
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: '#06B6D4', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
                padding: '3px 10px', borderRadius: 100,
              }}>Live Dashboard</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {PROGRESS_ITEMS.map((item, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.pct}%</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 100, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${item.pct}%`, borderRadius: 100,
                      background: `linear-gradient(90deg, ${item.color}, ${item.color}aa)`,
                      boxShadow: `0 0 10px ${item.color}66`,
                      transition: 'width 1s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Frameworks ───────────────────────────────────────────────────── */}
      <section id="frameworks" style={{ position: 'relative', zIndex: 1, padding: '60px 24px 100px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 14,
          }}>
            Support for 50+ compliance frameworks
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 48, lineHeight: 1.7 }}>
            From ISO standards to industry-specific regulations, we&apos;ve got you covered
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {FRAMEWORKS.map((fw, i) => (
              <span key={i} style={{
                fontSize: 13, fontWeight: 500,
                padding: '7px 16px', borderRadius: 100,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-secondary)',
                transition: 'all 0.2s', cursor: 'default',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(139,92,246,0.12)'
                  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'
                  e.currentTarget.style.color = '#C4B5FD'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}>
                {fw}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 24px 100px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            borderRadius: 24, padding: '64px 48px', textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(109,40,217,0.35) 50%, rgba(6,182,212,0.15) 100%)',
            border: '1px solid rgba(139,92,246,0.3)',
            backdropFilter: 'blur(20px)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Glow orb */}
            <div style={{
              position: 'absolute', top: -60, right: -60, width: 240, height: 240,
              background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: -40, left: -40, width: 180, height: 180,
              background: 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 700,
              color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 16,
              position: 'relative',
            }}>
              Ready to streamline your compliance?
            </h2>
            <p style={{
              fontSize: 16, color: 'rgba(255,255,255,0.7)', maxWidth: 480, margin: '0 auto 36px',
              lineHeight: 1.7, position: 'relative',
            }}>
              Join hundreds of companies automating their compliance journey with CompliGuard
            </p>
            <Link href="/setup/welcome" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', borderRadius: 10, textDecoration: 'none',
              background: 'white', color: '#1e1b4b', fontWeight: 700, fontSize: 15,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              transition: 'all 0.2s',
              position: 'relative',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)' }}>
              Start Your Free Trial <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{
        position: 'relative', zIndex: 1,
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '60px 24px 40px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }} className="footer-grid">

            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Shield size={15} color="white" />
                </div>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>CompliGuard</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 240 }}>
                AI-powered compliance automation for modern enterprises
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>Product</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Features', 'Frameworks', 'Pricing'].map(l => (
                  <a key={l} href="#" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>{l}</a>
                ))}
              </div>
            </div>

            {/* Company */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>Company</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['About', 'Blog', 'Careers'].map(l => (
                  <a key={l} href="#" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>{l}</a>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>Legal</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Privacy', 'Terms', 'Security'].map(l => (
                  <a key={l} href="#" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>{l}</a>
                ))}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>© 2026 CompliGuard — Enterprise GRC</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {['#8B5CF6', '#06B6D4', '#8B5CF6'].map((c, i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: c, opacity: 0.6 }} />
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── Responsive helpers ───────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .show-mobile { display: block !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (min-width: 769px) {
          .show-mobile { display: none !important; }
        }
      `}</style>

    </div>
  )
}
