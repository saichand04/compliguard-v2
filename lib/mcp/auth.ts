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
// Rate limiting — sliding-window, in-memory
// 100 req/min for mcp:read, 20 req/min for mcp:write
// ---------------------------------------------------------------------------

export interface RateLimitState {
  count: number
  resetAt: number // Unix timestamp (ms)
}

const rateLimitMap = new Map<string, RateLimitState>()

const RATE_LIMIT_READ  = 100
const RATE_LIMIT_WRITE = 20
const WINDOW_MS        = 60_000 // 1 minute

export function checkRateLimit(
  keyId: string,
  isWrite: boolean,
): { allowed: boolean; retryAfter?: number } {
  const limit = isWrite ? RATE_LIMIT_WRITE : RATE_LIMIT_READ
  const now   = Date.now()

  let state = rateLimitMap.get(keyId)

  if (!state || state.resetAt < now) {
    // New or expired window — reset
    state = { count: 1, resetAt: now + WINDOW_MS }
    rateLimitMap.set(keyId, state)
    return { allowed: true }
  }

  if (state.count >= limit) {
    const retryAfter = Math.ceil((state.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  state.count += 1
  return { allowed: true }
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
