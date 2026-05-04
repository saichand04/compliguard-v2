import { NextResponse } from 'next/server'
import { MCP_TOOLS } from '@/lib/mcp/tools'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const manifest = {
    name: 'CompliGuard',
    version: '1.0.0',
    description: 'GRC compliance platform MCP server — manage controls, findings, tasks, and evidence',
    mcpVersion: '2024-11-05',
    endpoint: '/api/mcp',
    auth: {
      type: 'bearer',
      scopes: ['mcp:read', 'mcp:write', 'admin:*'],
    },
    tools: MCP_TOOLS,
  }

  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/json',
    },
  })
}
