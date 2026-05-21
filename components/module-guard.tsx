'use client'

/**
 * ModuleGuard — page-level module enforcement
 *
 * Wraps a page and shows a "Module Disabled" screen when the module
 * is turned off — instead of just hiding the sidebar link.
 * This prevents direct URL navigation to disabled modules.
 *
 * Usage:
 *   <ModuleGuard moduleKey="firewallAudit" label="Firewall Audit">
 *     <YourPageContent />
 *   </ModuleGuard>
 */

import { useModules } from '@/lib/hooks/use-modules'
import type { ModuleToggles } from '@/lib/db/schema/module_config'
import { ShieldOff, Lock } from 'lucide-react'

interface ModuleGuardProps {
  moduleKey: keyof ModuleToggles
  label: string
  children: React.ReactNode
}

export function ModuleGuard({ moduleKey, label, children }: ModuleGuardProps) {
  const { isEnabled, modules } = useModules()

  // modules loaded from cache immediately — no flash
  // _cache starts null so on first render we use DEFAULT (all true) — no flicker
  if (!isEnabled(moduleKey)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 400,
        gap: 16,
        textAlign: 'center',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Lock size={28} color="#ef4444" />
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            {label} is Disabled
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, maxWidth: 340 }}>
            This module has been disabled by your administrator.
            Enable it from <strong style={{ color: 'var(--text-secondary)' }}>Settings → Platform Modules</strong> to restore access.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
