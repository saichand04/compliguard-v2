import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'
import { MCP_TOOLS, dispatchTool } from '@/lib/mcp/tools'
import type { MCPRequest, MCPResponse } from '@/lib/mcp/types'
import { enforceMcpRateLimit, RateLimitError } from '@/lib/mcp/auth'
import { authLimiter } from '@/lib/rate-limiter'

const MCP_WRITE_TOOLS = new Set(['create_finding', 'update_task_status'])
function isWriteTool(name: string): boolean {
  return MCP_WRITE_TOOLS.has(name)
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export const dynamic = 'force-dynamic'

const PROTOCOL_VERSION = '2024-11-05'
const SERVER_INFO = {
  name: 'CompliGuard',
  version: '1.0.0',
  protocolVersion: PROTOCOL_VERSION,
}

function jsonRpcError(
  id: string | number,
  code: number,
  message: string,
  data?: unknown
): MCPResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  }
}

function jsonRpcResult(id: string | number, result: unknown): MCPResponse {
  return { jsonrpc: '2.0', id, result }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Per-IP brute-force limit on failed auth attempts. We only *consume* on
  // failure (below) so legitimate callers aren't punished.
  const clientIp = getClientIp(request)

  // API key authentication
  const keyCtx = await validateApiKey(request)
  if (!keyCtx) {
    // Consume a failed-auth point. After 10 failures in 15 minutes the IP is
    // blocked for 15 minutes (configured in lib/rate-limiter.ts).
    try {
      await authLimiter.consume(`mcp-auth:${clientIp}`)
    } catch {
      return NextResponse.json(
        { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Too many failed authentication attempts. Try again later.' } },
        { status: 429 }
      )
    }
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized: valid Bearer API key required' } },
      { status: 401 }
    )
  }

  // Require mcp:* or admin:* scope
  const hasMcpScope = hasScope(keyCtx.scopes, 'mcp:read') ||
    hasScope(keyCtx.scopes, 'mcp:write') ||
    hasScope(keyCtx.scopes, 'admin:*')

  if (!hasMcpScope) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32003, message: 'Forbidden: API key lacks mcp:read or mcp:write scope' } },
      { status: 403 }
    )
  }

  let body: MCPRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: invalid JSON' } },
      { status: 400 }
    )
  }

  const { id, method, params } = body

  // Validate JSON-RPC structure
  if (body.jsonrpc !== '2.0' || id === undefined || !method) {
    return NextResponse.json(
      jsonRpcError(id ?? null as unknown as string, -32600, 'Invalid Request'),
      { status: 400 }
    )
  }

  try {
    switch (method) {
      case 'initialize': {
        const response = jsonRpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        })
        return NextResponse.json(response)
      }

      case 'ping': {
        return NextResponse.json(jsonRpcResult(id, {}))
      }

      case 'tools/list': {
        return NextResponse.json(
          jsonRpcResult(id, { tools: MCP_TOOLS })
        )
      }

      case 'tools/call': {
        const toolParams = params as { name?: string; arguments?: Record<string, unknown> } | undefined
        const toolName = toolParams?.name
        const toolArgs = toolParams?.arguments ?? {}

        if (!toolName) {
          return NextResponse.json(
            jsonRpcError(id, -32602, 'Invalid params: missing tool name'),
            { status: 400 }
          )
        }

        // Check tool exists
        const toolDef = MCP_TOOLS.find((t) => t.name === toolName)
        if (!toolDef) {
          return NextResponse.json(
            jsonRpcError(id, -32602, `Unknown tool: ${toolName}`),
            { status: 400 }
          )
        }

        // For write tools, require mcp:write or admin:*
        const writeTool = isWriteTool(toolName)
        if (writeTool) {
          const hasWrite = hasScope(keyCtx.scopes, 'mcp:write') || hasScope(keyCtx.scopes, 'admin:*')
          if (!hasWrite) {
            return NextResponse.json(
              jsonRpcError(id, -32003, 'Forbidden: mcp:write scope required for this tool'),
              { status: 403 }
            )
          }
        }

        // Per-API-key sliding-window rate limit (read vs write scope).
        try {
          await enforceMcpRateLimit(keyCtx.apiKeyId, writeTool ? 'write' : 'read')
        } catch (rlErr) {
          if (rlErr instanceof RateLimitError) {
            return NextResponse.json(
              { ...jsonRpcError(id, -32002, 'rate limit exceeded'), retryAfter: rlErr.retryAfter },
              { status: 429, headers: { 'Retry-After': String(rlErr.retryAfter) } },
            )
          }
          throw rlErr
        }

        const result = await dispatchTool(toolName, toolArgs, keyCtx.orgId)
        return NextResponse.json(jsonRpcResult(id, result))
      }

      default: {
        return NextResponse.json(
          jsonRpcError(id, -32601, 'Method not found'),
          { status: 404 }
        )
      }
    }
  } catch (err) {
    console.error('[MCP] Internal error:', err)
    return NextResponse.json(
      jsonRpcError(id, -32603, 'Internal error'),
      { status: 500 }
    )
  }
}
