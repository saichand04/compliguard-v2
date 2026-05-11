// MCP/OpenClaw specific auth utilities

import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Scope definitions
// ---------------------------------------------------------------------------

export const MCP_SCOPES = {
  'mcp:read':  'Read frameworks, controls, findings, tasks, evidence',
  'mcp:write': 'Create and update findings and tasks',
  'mcp:admin': 'Full MCP access including sensitive data',
} as const

export type MCPScope = keyof typeof MCP_SCOPES

// ---------------------------------------------------------------------------
// Scope checks
// admin:* grants everything; mcp:read is minimum for read tools; mcp:write for write tools
// ---------------------------------------------------------------------------

export function hasMCPReadAccess(scopes: string[]): boolean {
  if (scopes.includes('admin:*')) return true
  if (scopes.includes('mcp:admin')) return true
  if (scopes.includes('mcp:read')) return true
  if (scopes.includes('mcp:write')) return true // write implies read
  return false
}

export function hasMCPWriteAccess(scopes: string[]): boolean {
  if (scopes.includes('admin:*')) return true
  if (scopes.includes('mcp:admin')) return true
  if (scopes.includes('mcp:write')) return true
  return false
}

export function hasMCPAdminAccess(scopes: string[]): boolean {
  if (scopes.includes('admin:*')) return true
  if (scopes.includes('mcp:admin')) return true
  return false
}

// ---------------------------------------------------------------------------
// Rate limiting — true sliding-window, in-memory
// 100 req/min for mcp:read, 20 req/min for mcp:write
//
// Strategy: per-key deque of request timestamps. On each call we discard
// entries older than `now - WINDOW_MS` and append the new one; we refuse the
// request if the resulting deque size exceeds the limit. This avoids the
// fixed-window burst problem (where the old `count`/`resetAt` scheme would
// let a caller fire `limit` requests just before the boundary and another
// `limit` requests immediately after).
// ---------------------------------------------------------------------------

export class RateLimitError extends Error {
  retryAfter: number
  constructor(message: string, retryAfter: number) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

export type MCPRateScope = 'read' | 'write'

const rateLimitBuckets = new Map<string, number[]>()

const RATE_LIMIT_READ  = 100
const RATE_LIMIT_WRITE = 20
const WINDOW_MS        = 60_000 // 1 minute

function bucketKey(keyId: string, scope: MCPRateScope): string {
  return `${scope}:${keyId}`
}

function pruneAndAppend(
  key: string,
  now: number,
  limit: number,
): { allowed: boolean; retryAfter: number; size: number } {
  const windowStart = now - WINDOW_MS
  let timestamps = rateLimitBuckets.get(key)
  if (!timestamps) {
    timestamps = []
    rateLimitBuckets.set(key, timestamps)
  }

  // Drop entries older than the window. Timestamps are monotonically appended,
  // so the array is sorted ascending — find the first index >= windowStart.
  let drop = 0
  while (drop < timestamps.length && timestamps[drop] <= windowStart) {
    drop++
  }
  if (drop > 0) {
    timestamps.splice(0, drop)
  }

  if (timestamps.length >= limit) {
    // Oldest timestamp dictates when one slot frees up.
    const oldest = timestamps[0] ?? now
    const retryAfter = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000))
    return { allowed: false, retryAfter, size: timestamps.length }
  }

  timestamps.push(now)
  return { allowed: true, retryAfter: 0, size: timestamps.length }
}

/**
 * Non-throwing check, retained for callers that want a boolean result.
 */
export function checkRateLimit(
  keyId: string,
  isWrite: boolean,
): { allowed: boolean; retryAfter?: number } {
  const scope: MCPRateScope = isWrite ? 'write' : 'read'
  const limit = isWrite ? RATE_LIMIT_WRITE : RATE_LIMIT_READ
  const res = pruneAndAppend(bucketKey(keyId, scope), Date.now(), limit)
  return res.allowed ? { allowed: true } : { allowed: false, retryAfter: res.retryAfter }
}

/**
 * Enforce the MCP rate limit. Throws RateLimitError when exceeded.
 */
export async function enforceMcpRateLimit(
  keyId: string,
  scope: MCPRateScope,
): Promise<void> {
  const limit = scope === 'write' ? RATE_LIMIT_WRITE : RATE_LIMIT_READ
  const res = pruneAndAppend(bucketKey(keyId, scope), Date.now(), limit)
  if (!res.allowed) {
    throw new RateLimitError(
      `MCP ${scope} rate limit exceeded (${limit} req/${WINDOW_MS / 1000}s)`,
      res.retryAfter,
    )
  }
}

// Periodic cleanup of empty / fully-expired buckets so the Map doesn't grow
// unboundedly across long-lived processes. Runs every 5 minutes; safe to skip
// during tests / cold starts because all reads also prune.
const CLEANUP_INTERVAL_MS = 5 * 60_000
let cleanupTimer: ReturnType<typeof setInterval> | null = null

function startRateLimitCleanup(): void {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS
    for (const [key, ts] of rateLimitBuckets) {
      // Drop expired entries.
      let drop = 0
      while (drop < ts.length && ts[drop] <= cutoff) drop++
      if (drop > 0) ts.splice(0, drop)
      if (ts.length === 0) rateLimitBuckets.delete(key)
    }
  }, CLEANUP_INTERVAL_MS)
  // Don't keep the event loop alive just for cleanup.
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref()
}

// Initialize on module load in long-lived runtimes.
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  try { startRateLimitCleanup() } catch { /* ignore */ }
}

/** Test-only helper to reset internal state. */
export function __resetMcpRateLimitForTests(): void {
  rateLimitBuckets.clear()
}

// ---------------------------------------------------------------------------
// Audit logging for MCP tool calls
// ---------------------------------------------------------------------------

export async function logMCPAccess(params: {
  orgId: string
  keyId: string
  tool: string
  success: boolean
  latencyMs?: number
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      organizationId: params.orgId,
      userId: null,
      action: 'mcp.tool_call',
      resourceType: 'mcp',
      resourceId: undefined,
      resourceTitle: params.tool,
      description: `MCP tool '${params.tool}' called via API key ${params.keyId.slice(0, 8)}... — ${params.success ? 'success' : 'failure'}`,
      metadata: {
        keyId: params.keyId,
        tool: params.tool,
        success: params.success,
        latencyMs: params.latencyMs ?? null,
      },
    })
  } catch {
    // Audit failures must not break the request
  }
}
