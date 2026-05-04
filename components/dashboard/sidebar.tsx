'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Shield, FileText, AlertTriangle,
  ScrollText, ClipboardList, Users2, Search, UsersRound,
  BarChart3, Plug, Settings, ChevronLeft, ChevronRight, Menu, X,
  Zap, Library, Map, Upload, Bell, FileCheck, Eye,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const NAV_GROUPS = [
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
      { href: '/evidence',          label: 'Evidence',         icon: FileText },
      { href: '/policies',          label: 'Policies',         icon: ScrollText },
      { href: '/soa',               label: 'Statement of App', icon: FileCheck },
      { href: '/audit',             label: 'Auditor View',     icon: Eye },
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
      { href: '/vendors', label: 'Vendors', icon: Users2 },
      { href: '/people',  label: 'People',  icon: UsersRound },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/integrations', label: 'Integrations', icon: Plug },
      { href: '/settings',     label: 'Settings',     icon: Settings },
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
        {NAV_GROUPS.map((group) => (
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

      {/* AI badge — only when expanded */}
      {(!collapsed || isMobile) && (
        <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border-glass)', flexShrink: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 12px',
            background: 'var(--violet-dim)',
            border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 'var(--radius-md)',
          }}>
            <Zap size={13} style={{ color: 'var(--violet)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--violet)' }}>AI Mapping Active</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Controls engine running</div>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <div style={{ padding: '8px', borderTop: '1px solid var(--border-glass)', flexShrink: 0 }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="btn-icon"
            style={{ width: '100%' }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      )}
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
      {!isMobile && sidebarContent}
    </>
  )
}
