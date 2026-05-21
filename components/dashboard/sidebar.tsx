'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Shield, FileText, AlertTriangle,
  ScrollText, ClipboardList, Users2, Search, UsersRound,
  BarChart3, Settings, ChevronLeft, ChevronRight, Menu, X,
  Library, Map, Upload, Bell, FileCheck, Eye, GitBranch, Sparkles, Brain, Calendar, BookOpen,
  UserCheck, Monitor, Sword, Satellite, ShieldOff, Target, CloudLightning, GraduationCap, Globe,
  Cloud, ChevronDown, ChevronRight as ChevronRightIcon, Building2, Cpu, Server,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useModules } from '@/lib/hooks/use-modules'
import type { ModuleToggles } from '@/lib/db/schema/module_config'

// ─── Nav types ─────────────────────────────────────────────────────────────────

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  moduleKey?: keyof ModuleToggles
}

interface NavSubGroup {
  label: string
  icon: React.ElementType
  moduleKey?: keyof ModuleToggles   // hide entire subgroup if module disabled
  items: NavItem[]
}

interface NavGroup {
  label: string
  adminOnly?: boolean
  moduleKey?: keyof ModuleToggles   // hide entire group if module disabled
  subGroups?: NavSubGroup[]         // collapsible sub-sections (Cloud Security)
  items?: NavItem[]
}

// ─── Navigation definition ─────────────────────────────────────────────────────
// To add a new module: add items here with a moduleKey, add the key to
// ModuleToggles, and optionally wrap the page with <ModuleGuard>.

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
      { href: '/pentest',           label: 'Pen Testing',      icon: Target,    moduleKey: 'pentest' },
      { href: '/firewall-audit',    label: 'Firewall Audit',   icon: ShieldOff, moduleKey: 'firewallAudit' },
      { href: '/dns-audit',         label: 'DNS Audit',        icon: Globe,     moduleKey: 'dnsAudit' },
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
      { href: '/vendors',   label: 'Vendors',    icon: Users2,        moduleKey: 'vendors' },
      { href: '/people',    label: 'People',     icon: UsersRound },
      { href: '/org-chart', label: 'Org Chart',  icon: GitBranch },
      { href: '/training',  label: 'Training',   icon: GraduationCap, moduleKey: 'training' },
    ],
  },
  {
    label: 'AI',
    items: [
      { href: '/ai-assistant', label: 'AI Assistant',  icon: Sparkles },
      { href: '/context-hub',  label: 'Context Hub',   icon: Brain },
      { href: '/knowledge',    label: 'Knowledge Base', icon: BookOpen },
    ],
  },
  // ── Cloud Security — expandable subgroups ───────────────────────────────────
  {
    label: 'Cloud Security',
    subGroups: [
      {
        label: 'Microsoft',
        icon: Building2,
        moduleKey: 'cloudMicrosoft',
        items: [
          { href: '/integrations/entra',              label: 'Entra ID',         icon: UserCheck },
          { href: '/integrations/intune',             label: 'Intune',           icon: Monitor },
          { href: '/integrations/defender',           label: 'Defender',         icon: Sword },
          { href: '/integrations/sentinel',           label: 'Sentinel',         icon: Satellite },
          { href: '/integrations/purview',            label: 'Purview',          icon: ShieldOff },
          { href: '/integrations/compliance-manager', label: 'Compliance Mgr',   icon: Target },
          { href: '/integrations/azure-scan',         label: 'Azure Scan',       icon: CloudLightning },
        ],
      },
      {
        label: 'AWS',
        icon: Cloud,
        moduleKey: 'cloudAWS',
        items: [
          { href: '/integrations/aws-security-hub',  label: 'Security Hub',      icon: Shield },
          { href: '/integrations/aws-guardduty',     label: 'GuardDuty',         icon: Eye },
          { href: '/integrations/aws-config',        label: 'AWS Config',        icon: Server },
        ],
      },
      {
        label: 'GCP',
        icon: Cpu,
        moduleKey: 'cloudGCP',
        items: [
          { href: '/integrations/gcp-scc',           label: 'Security Command',  icon: Shield },
          { href: '/integrations/gcp-iam',           label: 'IAM Analyzer',      icon: UserCheck },
        ],
      },
    ],
  },
  {
    label: 'Settings',
    adminOnly: true,
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

// ─── Sidebar Props ─────────────────────────────────────────────────────────────
interface SidebarProps {
  role: string
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function DashboardSidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  // Track which Cloud Security subgroups are expanded
  const [expandedSubGroups, setExpandedSubGroups] = useState<Record<string, boolean>>({
    Microsoft: true,
    AWS: false,
    GCP: false,
  })

  // Module state from shared hook — updates instantly when Settings page toggles
  const { isEnabled } = useModules()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Auto-expand subgroup when navigating to one of its pages
  useEffect(() => {
    NAV_GROUPS.forEach(group => {
      if (!group.subGroups) return
      group.subGroups.forEach(sg => {
        if (sg.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))) {
          setExpandedSubGroups(prev => ({ ...prev, [sg.label]: true }))
        }
      })
    })
  }, [pathname])

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === href || pathname.startsWith(href + '/')

  const toggleSubGroup = (label: string) => {
    setExpandedSubGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  // Filter groups/items based on role and module state
  const visibleGroups = NAV_GROUPS
    .filter(g => {
      if (g.adminOnly) return ['super_admin', 'admin'].includes(role)
      if (g.moduleKey) return isEnabled(g.moduleKey)
      return true
    })
    .map(g => {
      if (g.subGroups) {
        return {
          ...g,
          subGroups: g.subGroups
            .filter(sg => !sg.moduleKey || isEnabled(sg.moduleKey))
            .map(sg => ({
              ...sg,
              items: sg.items.filter(item => !item.moduleKey || isEnabled(item.moduleKey)),
            }))
            .filter(sg => sg.items.length > 0),
        }
      }
      return {
        ...g,
        items: (g.items ?? []).filter(item => !item.moduleKey || isEnabled(item.moduleKey)),
      }
    })
    .filter(g => {
      if (g.subGroups) return g.subGroups.length > 0
      return (g.items ?? []).length > 0
    })

  // ── Render a single nav item ──────────────────────────────────────────────
  const renderNavItem = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
      style={{
        justifyContent: collapsed && !isMobile ? 'center' : undefined,
        padding: collapsed && !isMobile ? '9px 0' : undefined,
        marginBottom: 1,
      }}
      {...(collapsed && !isMobile ? { 'data-tooltip': item.label } : {})}
    >
      <item.icon size={16} className="nav-icon" style={{ flexShrink: 0 }} />
      {(!collapsed || isMobile) && (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
      )}
    </Link>
  )

  // ── Render a subgroup (Microsoft / AWS / GCP) ──────────────────────────────
  const renderSubGroup = (sg: NavSubGroup) => {
    const expanded = expandedSubGroups[sg.label] ?? false
    const hasActive = sg.items.some(item => isActive(item.href))

    return (
      <div key={sg.label}>
        {/* Subgroup header — collapsible */}
        <button
          onClick={() => !collapsed && toggleSubGroup(sg.label)}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: collapsed && !isMobile ? '9px 0' : '7px 10px',
            justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 8,
            color: hasActive ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 500,
            transition: 'background 0.15s ease, color 0.15s ease',
            marginBottom: 1,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
          {...(collapsed && !isMobile ? { 'data-tooltip': sg.label } : {})}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <sg.icon
              size={16}
              style={{ flexShrink: 0, color: hasActive ? '#8b5cf6' : 'var(--text-muted)' }}
            />
            {(!collapsed || isMobile) && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sg.label}</span>
            )}
          </div>
          {(!collapsed || isMobile) && (
            <ChevronDown
              size={13}
              style={{
                color: 'var(--text-muted)',
                transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.2s ease',
                flexShrink: 0,
              }}
            />
          )}
        </button>

        {/* Subgroup items — slide open/closed */}
        {(expanded || (collapsed && !isMobile)) && (
          <div style={{
            marginLeft: collapsed && !isMobile ? 0 : 14,
            borderLeft: collapsed && !isMobile ? 'none' : '1px solid rgba(255,255,255,0.07)',
            paddingLeft: collapsed && !isMobile ? 0 : 8,
          }}>
            {sg.items.map(renderNavItem)}
          </div>
        )}
      </div>
    )
  }

  // ── Sidebar content ─────────────────────────────────────────────────────────
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
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="btn-icon" style={{ marginLeft: 'auto' }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 8px' }}>
        {visibleGroups.map((group) => (
          <div key={group.label}>
            {/* Section label */}
            {(!collapsed || isMobile) && (
              <div className="nav-section-label">{group.label}</div>
            )}
            {collapsed && !isMobile && (
              <div style={{ margin: '12px 0 2px', borderTop: '1px solid var(--border-glass)', opacity: 0.5 }} />
            )}

            {/* Subgroups (Cloud Security) */}
            {group.subGroups
              ? group.subGroups.map(sg => renderSubGroup(sg))
              : (group.items ?? []).map(renderNavItem)
            }
          </div>
        ))}
      </nav>
    </aside>
  )

  return (
    <>
      {isMobile && (
        <>
          {mobileOpen && (
            <div className="sidebar-backdrop" style={{ zIndex: 40 }} onClick={() => setMobileOpen(false)} />
          )}
          {sidebarContent}
          <button
            onClick={() => setMobileOpen(true)}
            className="btn-icon"
            style={{
              position: 'fixed', top: 14, left: 14, zIndex: 35,
              background: 'rgba(8,11,24,0.75)',
              border: '1px solid var(--border-glass)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Menu size={18} />
          </button>
        </>
      )}

      {/* Desktop — wrapper div needed so collapse button can be positioned at sidebar edge */}
      {!isMobile && (
        <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
          {sidebarContent}

          {/*
            Collapse toggle — sits exactly at the right edge of the sidebar,
            vertically centered on the header/content boundary (56px header ÷ 2 = 28px),
            brought fully to the front with z-index: 100 so it's never clipped.
          */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              position: 'absolute',
              // Right edge of sidebar — half the button overhangs outside
              right: -13,
              // 56px header height: center of button at bottom edge of header = 56px
              // so top of button (24px tall) = 56 - 12 = 44px → gives intersection look
              top: 44,
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'var(--bg-surface, #1a1a2e)',
              border: '1.5px solid rgba(139,92,246,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              // Above sidebar AND main content
              zIndex: 100,
              color: 'rgba(255,255,255,0.75)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.15)',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = '#8b5cf6'
              el.style.borderColor = '#8b5cf6'
              el.style.color = 'white'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'var(--bg-surface, #1a1a2e)'
              el.style.borderColor = 'rgba(139,92,246,0.35)'
              el.style.color = 'rgba(255,255,255,0.75)'
            }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <ChevronRightIcon size={13} />
              : <ChevronLeft size={13} />
            }
          </button>
        </div>
      )}
    </>
  )
}
