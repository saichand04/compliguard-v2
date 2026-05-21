'use client'

/**
 * useModules — shared module state hook
 *
 * Single source of truth for which modules are enabled.
 * Uses a custom DOM event ('cg:modules-updated') to broadcast
 * state changes across all hook consumers in the same tab,
 * so toggling a module in Settings immediately updates
 * the sidebar AND any page-level guards — no page refresh needed.
 */

import { useState, useEffect, useCallback } from 'react'
import type { ModuleToggles } from '@/lib/db/schema/module_config'
import { DEFAULT_MODULE_TOGGLES } from '@/lib/db/schema/module_config'

const EVENT_NAME = 'cg:modules-updated'

let _cache: ModuleToggles | null = null
let _fetchPromise: Promise<ModuleToggles> | null = null

async function fetchModules(): Promise<ModuleToggles> {
  if (_fetchPromise) return _fetchPromise
  _fetchPromise = fetch('/api/settings/modules')
    .then(r => r.ok ? r.json() : { modules: {} })
    .then(data => {
      const m = { ...DEFAULT_MODULE_TOGGLES, ...(data.modules ?? {}) } as ModuleToggles
      _cache = m
      _fetchPromise = null
      return m
    })
    .catch(() => {
      _fetchPromise = null
      return { ...DEFAULT_MODULE_TOGGLES }
    })
  return _fetchPromise
}

/** Broadcast module state change to all hook consumers */
export function broadcastModulesUpdate(modules: ModuleToggles) {
  _cache = modules
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: modules }))
  }
}

/** Hook — returns current module state, re-renders on any change */
export function useModules() {
  const [modules, setModules] = useState<ModuleToggles>(_cache ?? DEFAULT_MODULE_TOGGLES)

  useEffect(() => {
    // Load from API on mount (use cache if available)
    if (_cache) {
      setModules(_cache)
    } else {
      fetchModules().then(setModules)
    }

    // Listen for live updates broadcast by ModuleToggles settings component
    const handler = (e: Event) => {
      const evt = e as CustomEvent<ModuleToggles>
      setModules(evt.detail)
    }
    window.addEventListener(EVENT_NAME, handler)
    return () => window.removeEventListener(EVENT_NAME, handler)
  }, [])

  const isEnabled = useCallback((key: keyof ModuleToggles) => modules[key] ?? true, [modules])

  return { modules, isEnabled }
}
