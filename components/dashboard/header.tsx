'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, ChevronDown, LogOut, Settings, User } from 'lucide-react'

interface HeaderProps {
  firstName: string
  lastName: string
  email: string
  role: string
}

export function DashboardHeader({ firstName, lastName, email, role }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationCount] = useState(0)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/auth/signin')
  }

  const breadcrumb = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '))
    .join(' / ')

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || email.charAt(0).toUpperCase()

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      {/* Breadcrumb */}
      <div className="text-sm text-slate-500">
        <span className="font-medium text-slate-900 dark:text-white">{breadcrumb || 'Dashboard'}</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button className="relative p-2 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
            <span className="hidden sm:block">{firstName || email.split('@')[0]}</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20 py-1">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{firstName} {lastName}</p>
                  <p className="text-xs text-slate-400 truncate">{email}</p>
                  <span className="inline-block mt-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded capitalize">{role.replace('_', ' ')}</span>
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); router.push('/profile') }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <User className="w-3.5 h-3.5" /> My Profile
                </button>
                <button
                  onClick={() => { setUserMenuOpen(false); router.push('/settings') }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" /> Settings
                </button>
                <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
