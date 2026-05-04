import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { validateApiKey } from '@/lib/api/api-key-auth'
import { hasMCPReadAccess } from '@/lib/mcp/auth'
import { executeNLQuery } from '@/lib/mcp/nl-query'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Rate limit — 10 NL queries per minute per user/key (in-memory)
// ---------------------------------------------------------------------------

interface RLState { count: number; resetAt: number }
const nlRateLimitMap = new Map<string, RLState>()

function checkNLRateLimit(id: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  let state = nlRateLimitMap.get(id)

  if (!state || state.resetAt < now) {
    nlRateLimitMap.set(id, { count: 1, resetAt: now + 60_000 })
    return { allowed: true }
  }

  if (state.count >= 10) {
    return { allowed: false, retryAfter: Math.ceil((state.resetAt - now) / 1000) }
  }

  state.count += 1
  return { allowed: true }
}

// ---------------------------------------------------------------------------
// POST /api/mcp/nl-query
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // --- Auth: session first, fall back to API key ---
  let orgId: string
  let userId: string
  let rateLimitKey: string

  const session = await requireAuth(req)

  if (session) {
    orgId = session.orgId!
    userId = session.userId
    rateLimitKey = `session:${userId}`
  } else {
    // Try API key auth
    const apiKeyCtx = await validateApiKey(req)
    if (!apiKeyCtx) {
      return ApiErrors.unauthorized()
    }
    if (!hasMCPReadAccess(apiKeyCtx.scopes)) {
      return NextResponse.json({ error: 'Insufficient scopes. mcp:read required.' }, { status: 403 })
    }
    orgId = apiKeyCtx.orgId
    userId = `apikey:${apiKeyCtx.apiKeyId}`
    rateLimitKey = `apikey:${apiKeyCtx.apiKeyId}`
  }

  // --- Rate limit ---
  const rl = checkNLRateLimit(rateLimitKey)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 10 NL queries per minute.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfter ?? 60) },
      }
    )
  }

  // --- Parse body ---
  let body: {
    query?: string
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
    stream?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const { query, history, stream } = body

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return ApiErrors.badRequest('query is required')
  }

  const startedAt = Date.now()

  // --- Log audit entry ---
  const logAudit = async (success: boolean) => {
    try {
      await db.insert(auditLogs).values({
        organizationId: orgId,
        userId: userId.startsWith('apikey:') ? null : userId,
        action: 'mcp.nl_query',
        resourceType: 'mcp',
        resourceId: undefined,
        resourceTitle: 'nl_query',
        description: `NL query: "${query.slice(0, 120)}${query.length > 120 ? '...' : ''}"`,
        metadata: {
          success,
          latencyMs: Date.now() - startedAt,
          rateLimitKey,
        },
      })
    } catch {
      // audit failures must not break the request
    }
  }

  try {
    const result = await executeNLQuery({
      query: query.trim(),
      orgId,
      userId,
      conversationHistory: history ?? [],
      maxToolCalls: 3,
    })

    await logAudit(true)

    // --- Streaming (SSE) ---
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        start(controller) {
          // Emit the full response as a single SSE event for simplicity
          // (true streaming requires token-by-token AI output, which needs provider-specific streaming)
          const data = JSON.stringify(result)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // --- JSON response ---
    return NextResponse.json(result)
  } catch (err) {
    await logAudit(false)
    console.error('[/api/mcp/nl-query]', err)
    return ApiErrors.internal('Failed to process query')
  }
}
