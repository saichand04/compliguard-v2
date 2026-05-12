'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Shield, FileText, AlertTriangle,
  ScrollText, ClipboardList, Users2, Search, UsersRound,
  BarChart3, Plug, Settings, ChevronLeft, ChevronRight, Menu, X,
  Zap, Library, Map, Upload, Bell, FileCheck, Eye, GitBranch, ShieldCheck, Sparkles, Brain, Calendar, FlaskConical, BookOpen, MessageSquare,
  UserCheck, Monitor, Sword, Satellite, ShieldOff, Target, CloudLightning, Key, Webhook, GraduationCap, Server, Globe,
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface NavGroup {
  label: string
  adminOnly?: boolean
  items: { href: string; label: string; icon: React.ElementType }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
      { href: '/reports',        label: 'Reports',        icon: BarChart3 },
      { href: '/notifications',  label: 'Notifications',  icon: Bell },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { href: '/frameworks',        label: 'Frameworks',       icon: Shield },
      { href: '/roadmap',           label: 'Roadmap',          icon: Calendar },
      { href: '/evidence',          label: 'Evidence',         icon: FileText },
      { href: '/policies',          label: 'Policies',         icon: ScrollText },
      { href: '/soa',               label: 'Statement of App', icon: FileCheck },
      { href: '/audit',             label: 'Auditor View',     icon: Eye },
      { href: '/pentest',           label: 'Pen Testing',      icon: Target },
      { href: '/firewall-audit',    label: 'Firewall Audit',   icon: ShieldOff },
      { href: '/dns-audit',         label: 'DNS Audit',        icon: Globe },
    ],
  },
  {
    label: 'Controls',
    items: [
      { href: '/controls',          label: 'Controls Library',  icon: Library },
      { href: '/mappings',          label: 'Mapping Explorer',  icon: Map },
      { href: '/frameworks/upload', label: 'Upload Framework',  icon: Upload },
    ],
  },
  {
    label: 'Risk & Audit',
    items: [
      { href: '/risks',    label: 'Risks',    icon: AlertTriangle },
      { href: '/findings', label: 'Findings', icon: Search },
      { href: '/tasks',    label: 'Tasks',    icon: ClipboardList },
    ],
  },
  {
    label: 'Organization',
    items: [
      { href: '/vendors',   label: 'Vendors',    icon: Users2 },
      { href: '/people',    label: 'People',     icon: UsersRound },
      { href: '/org-chart', label: 'Org Chart',  icon: GitBranch },
      { href: '/training',  label: 'Training',   icon: GraduationCap },
    ],
  },

  {
    label: 'AI',
    items: [
      { href: '/ai-assistant',          label: 'AI Assistant',  icon: Sparkles },
      { href: '/ai-assistant/nl-query', label: 'NL Query',      icon: MessageSquare },
      { href: '/context-hub',           label: 'Context Hub',   icon: Brain },
      { href: '/knowledge',             label: 'Knowledge Base', icon: BookOpen },
    ],
  },
  {
    label: 'Microsoft 365',
    items: [
      { href: '/integrations/entra',              label: 'Entra ID',          icon: UserCheck },
      { href: '/integrations/intune',             label: 'Intune',            icon: Monitor },
      { href: '/integrations/defender',           label: 'Defender',          icon: Sword },
      { href: '/integrations/sentinel',           label: 'Sentinel',          icon: Satellite },
      { href: '/integrations/purview',            label: 'Purview',           icon: ShieldOff },
      { href: '/integrations/compliance-manager', label: 'Compliance Mgr',   icon: Target },
      { href: '/integrations/azure-scan',         label: 'Azure Scan',        icon: CloudLightning },
    ],
  },
  {
    label: 'Settings',
    adminOnly: true,
    items: [
      { href: '/integrations',          label: 'Integrations',  icon: Plug },
      { href: '/integrations/nl-tests', label: 'NL Tests',      icon: FlaskConical },
      { href: '/settings',              label: 'Settings',      icon: Settings },
      { href: '/settings/roles',        label: 'Roles',         icon: ShieldCheck },
      { href: '/settings/api-keys',     label: 'API Keys',      icon: Key },
      { href: '/settings/webhooks',     label: 'Webhooks',      icon: Webhook },
      { href: '/settings/teams-bot',    label: 'Teams Bot',     icon: MessageSquare },
      { href: '/settings/mcp',          label: 'MCP Server',    icon: Server },
      { href: '/settings/openclaw',     label: 'OpenClaw',      icon: Satellite },
    ],
  },
]

interface SidebarProps {
  role: string
}

export function DashboardSidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === href || pathname.startsWith(href + '/')

  const visibleGroups = NAV_GROUPS.filter(g => {
    if (g.adminOnly) return ['super_admin', 'admin'].includes(role)
    return true
  })

  const sidebarContent = (
    <aside
      className="glass-sidebar"
      style={{
        width: isMobile ? 260 : collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: isMobile
          ? 'left 0.28s cubic-bezier(0.4,0,0.2,1)'
          : 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        flexShrink: 0,
        position: isMobile ? 'fixed' : 'relative',
        left: isMobile ? (mobileOpen ? 0 : -280) : undefined,
        top: 0,
        zIndex: isMobile ? 50 : undefined,
      } as React.CSSProperties}
    >
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: collapsed && !isMobile ? '0' : '0 16px',
        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
        borderBottom: '1px solid var(--border-glass)',
        flexShrink: 0,
        height: 56,
        minHeight: 56,
      }}>
        <div style={{
          width: 30,
          height: 30,
          background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
          borderRadius: 9,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 0 14px rgba(109,40,217,0.40)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="white" opacity="0.95"/>
          </svg>
        </div>
        {(!collapsed || isMobile) && (
          <div style={{ overflow: 'hidden', animation: 'fade-in 0.2s ease' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              CompliGuard
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              GRC Platform
            </div>
          </div>
        )}
        {/* Mobile close */}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="btn-icon"
            style={{ marginLeft: 'auto' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 8px' }}>
        {visibleGroups.map((group) => (
          <div key={group.label}>
            {/* Section label — only when expanded */}
            {(!collapsed || isMobile) && (
              <div className="nav-section-label">{group.label}</div>
            )}
            {collapsed && !isMobile && (
              <div style={{ margin: '12px 0 2px', borderTop: '1px solid var(--border-glass)', opacity: 0.5 }} />
            )}

            {group.items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`nav-item ${isActive(href) ? 'active' : ''}`}
                style={{
                  justifyContent: collapsed && !isMobile ? 'center' : undefined,
                  padding: collapsed && !isMobile ? '9px 0' : undefined,
                  marginBottom: 1,
                }}
                {...(collapsed && !isMobile ? { 'data-tooltip': label } : {})}
              >
                <Icon
                  size={16}
                  className="nav-icon"
                  style={{ flexShrink: 0 }}
                />
                {(!collapsed || isMobile) && (
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )

  return (
    <>
      {/* Mobile hamburger — rendered by Header, but also provide the state setter */}
      {isMobile && (
        <>
          {/* Overlay backdrop */}
          {mobileOpen && (
            <div
              className="sidebar-backdrop"
              style={{ zIndex: 40 }}
              onClick={() => setMobileOpen(false)}
            />
          )}
          {sidebarContent}
          {/* Hamburger trigger - floated in top left on mobile */}
          <button
            onClick={() => setMobileOpen(true)}
            className="btn-icon"
            style={{
              position: 'fixed',
              top: 14,
              left: 14,
              zIndex: 35,
              background: 'rgba(8,11,24,0.75)',
              border: '1px solid var(--border-glass)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Menu size={18} />
          </button>
        </>
      )}

      {/* Desktop only — floating toggle at right edge of sidebar */}
      {!isMobile && (
        <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
          {sidebarContent}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              position: 'absolute',
              right: -12,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#1e1e2e',
              border: '1px solid rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              color: 'rgba(255,255,255,0.7)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>
      )}
    </>
  )
}
