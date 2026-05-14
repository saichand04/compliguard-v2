import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Mail, HardDrive, Brain, Building2, Users, ChevronRight,
  CheckCircle, AlertCircle, Settings,
  Target, ShieldOff, Globe, FlaskConical, Server, Satellite,
  GraduationCap, Users2, ShieldCheck, Key, Webhook, Plug, MessageSquare,
} from 'lucide-react'
import { getSession } from '@/lib/auth/jwt'
import { ModuleToggles } from '@/components/settings/module-toggles'
import { MasterResetSection } from '@/components/settings/master-reset'

const SETTINGS_SECTIONS = [
  {
    href: '/settings/organization',
    icon: Building2,
    title: 'Organization',
    description: 'Company name, logo, contact details, and branding',
    color: '#8B5CF6',
    status: 'configured' as const,
  },
  {
    href: '/settings/users',
    icon: Users,
    title: 'Users & Roles',
    description: 'Manage team members, roles, and access permissions',
    color: '#06B6D4',
    status: 'configured' as const,
  },
  {
    href: '/settings/email',
    icon: Mail,
    title: 'Email',
    description: 'Configure outbound email, inbound parsing, and notification templates',
    color: '#8B5CF6',
    status: 'skipped' as const,
  },
  {
    href: '/settings/storage',
    icon: HardDrive,
    title: 'Storage',
    description: 'Evidence files, policy documents, and attachment storage providers',
    color: '#06B6D4',
    status: 'skipped' as const,
  },
  {
    href: '/settings/ai',
    icon: Brain,
    title: 'AI Provider',
    description: 'OpenAI or Gemini API keys for control mapping and compliance assistant',
    color: '#8B5CF6',
    status: 'skipped' as const,
  },
  {
    href: '/integrations',
    icon: Plug,
    title: 'Integrations',
    description: 'Connect third-party services, ITSM platforms, and cloud providers',
    color: '#06B6D4',
    status: 'configured' as const,
  },
  {
    href: '/settings/teams-bot',
    icon: MessageSquare,
    title: 'Teams Bot',
    description: 'Microsoft Teams bot configuration and notification settings',
    color: '#8B5CF6',
    status: 'skipped' as const,
  },
  {
    href: '/settings/mcp',
    icon: Server,
    title: 'MCP Server',
    description: 'Model Context Protocol server settings and tool configurations',
    color: '#06B6D4',
    status: 'skipped' as const,
  },
  {
    href: '/settings/openclaw',
    icon: Satellite,
    title: 'OpenClaw',
    description: 'OpenClaw AI integration settings and API configuration',
    color: '#10B981',
    status: 'skipped' as const,
  },
  {
    href: '/settings/roles',
    icon: ShieldCheck,
    title: 'Roles & Permissions',
    description: 'Manage user roles and access control policies',
    color: '#F59E0B',
    status: 'configured' as const,
  },
  {
    href: '/settings/api-keys',
    icon: Key,
    title: 'API Keys',
    description: 'Manage API keys for external integrations and automation',
    color: '#EF4444',
    status: 'skipped' as const,
  },
  {
    href: '/settings/webhooks',
    icon: Webhook,
    title: 'Webhooks',
    description: 'Configure outbound webhooks for event notifications',
    color: '#8B5CF6',
    status: 'skipped' as const,
  },
]

export default async function SettingsPage() {
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

  const skippedCount = SETTINGS_SECTIONS.filter(s => s.status === 'skipped').length

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Settings size={18} color="#8B5CF6" />
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 24, fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '-0.02em',
          }}>
            Settings
          </h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Manage your platform configuration. You can update any settings skipped during setup at any time.
        </p>
      </div>

      {/* ── SECTION 1: Platform Modules ── */}
      <div style={{
        marginBottom: 36,
        padding: '24px 26px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        backdropFilter: 'blur(20px)',
      }}>
        {/* Section header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Target size={15} color="#8B5CF6" />
            </div>
            <h2 style={{
              fontSize: 16, fontWeight: 700,
              color: 'var(--text-primary)', margin: 0,
            }}>
              Platform Modules
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            Enable or disable modules for your organization. Changes take effect immediately.
          </p>
        </div>

        {/* Module toggle grid — client component */}
        <ModuleToggles />
      </div>

      {/* ── SECTION 2: Settings navigation cards ── */}

      {/* Skipped banner */}
      {skippedCount > 0 && (
        <div style={{
          marginBottom: 28,
          padding: '14px 18px', borderRadius: 12,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <AlertCircle size={16} color="#FBBF24" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: 'rgba(251,191,36,0.9)', lineHeight: 1.5 }}>
            <strong>{skippedCount} settings</strong> were skipped during setup. Configure them here whenever you&apos;re ready.
          </p>
        </div>
      )}

      {/* Settings cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SETTINGS_SECTIONS.map((section) => (
          <Link key={section.href} href={section.href} style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '18px 22px',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${section.status === 'skipped' ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 14, backdropFilter: 'blur(20px)',
              display: 'flex', alignItems: 'center', gap: 16,
              transition: 'all 0.2s', cursor: 'pointer',
            }}>

              {/* Icon */}
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: `${section.color}18`, border: `1px solid ${section.color}35`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <section.icon size={17} color={section.color} />
              </div>

              {/* Text */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {section.title}
                  </span>
                  {section.status === 'skipped' ? (
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: '#FBBF24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)',
                      padding: '2px 7px', borderRadius: 100,
                    }}>Not configured</span>
                  ) : (
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: '#4ADE80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)',
                      padding: '2px 7px', borderRadius: 100,
                    }}>Configured</span>
                  )}
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {section.description}
                </p>
              </div>

              {/* Arrow */}
              <ChevronRight size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            </div>
          </Link>
        ))}
      </div>

      {/* Wizard re-run */}
      <div style={{
        marginTop: 28, padding: '16px 20px', borderRadius: 12,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
            Re-run Setup Wizard
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Walk through the full guided setup again at any time
          </p>
        </div>
        <Link href="/setup/welcome" style={{
          fontSize: 13, fontWeight: 600, color: 'white', textDecoration: 'none',
          padding: '8px 16px', borderRadius: 8,
          background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          Run Setup Wizard
        </Link>
      </div>

      {/* ── Danger Zone — super_admin only ── */}
      {session.role === 'super_admin' && <MasterResetSection />}

    </div>
  )
}
