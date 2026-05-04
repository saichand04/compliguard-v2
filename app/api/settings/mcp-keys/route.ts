import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mcpApiKeys } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { generateApiKey } from '@/lib/api/api-key-auth'

/**
 * GET /api/settings/mcp-keys
 * List all MCP API keys for the organization (masked).
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const keys = await db
    .select({
      id: mcpApiKeys.id,
      name: mcpApiKeys.name,
      keyPrefix: mcpApiKeys.keyPrefix,
      permissions: mcpApiKeys.permissions,
      status: mcpApiKeys.status,
      lastUsedAt: mcpApiKeys.lastUsedAt,
      expiresAt: mcpApiKeys.expiresAt,
      createdAt: mcpApiKeys.createdAt,
    })
    .from(mcpApiKeys)
    .where(eq(mcpApiKeys.organizationId, session.orgId))
    .orderBy(desc(mcpApiKeys.createdAt))

  return NextResponse.json({ keys })
}

/**
 * POST /api/settings/mcp-keys
 * Create a new MCP API key. Returns the full key ONCE.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: { name: string; permissions?: string[]; expiresIn?: number | null }
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  if (!body.name || typeof body.name !== 'string') {
    return ApiErrors.badRequest('name is required')
  }

  const { key, hash, prefix } = generateApiKey()

  let expiresAt: Date | undefined
  if (body.expiresIn) {
    expiresAt = new Date(Date.now() + body.expiresIn * 24 * 60 * 60 * 1000)
  }

  const [mcpKey] = await db.insert(mcpApiKeys).values({
    organizationId: session.orgId,
    createdBy: session.userId,
    name: body.name,
    keyHash: hash,
    keyPrefix: prefix,
    permissions: body.permissions ?? [],
    status: 'active',
    expiresAt,
  }).returning({
    id: mcpApiKeys.id,
    name: mcpApiKeys.name,
    keyPrefix: mcpApiKeys.keyPrefix,
    permissions: mcpApiKeys.permissions,
    status: mcpApiKeys.status,
    expiresAt: mcpApiKeys.expiresAt,
    createdAt: mcpApiKeys.createdAt,
  })

  return NextResponse.json({ mcpKey, key }, { status: 201 })
}
