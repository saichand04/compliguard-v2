'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Shield, CheckSquare, Link2, FileText, AlertTriangle,
  ScrollText, ClipboardList, Users2, Search, Bug, UsersRound,
  BarChart3, Plug, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/frameworks', label: 'Frameworks', icon: Shield },
  { href: '/controls', label: 'Controls', icon: CheckSquare },
  { href: '/control-mapping', label: 'Control Mapping', icon: Link2 },
  { href: '/evidence', label: 'Evidence', icon: FileText },
  { href: '/risks', label: 'Risks', icon: AlertTriangle },
  { href: '/policies', label: 'Policies', icon: ScrollText },
  { href: '/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/vendors', label: 'Vendors', icon: Users2 },
  { href: '/findings', label: 'Findings', icon: Search },
  { href: '/people', label: 'People', icon: UsersRound },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/integrations', label: 'Integrations', icon: Plug },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function DashboardSidebar({ role }: { role: string }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn(
      'flex flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-200',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="white"/>
          </svg>
        </div>
        {!collapsed && <span className="font-bold text-slate-900 dark:text-white text-sm">CompliGuard</span>}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  )
}
