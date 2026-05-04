import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { generateApiKey } from '@/lib/api/api-key-auth'

/**
 * GET /api/settings/api-keys
 * List all API keys for the organization (masked, no full key).
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      status: apiKeys.status,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.organizationId, session.orgId))
    .orderBy(desc(apiKeys.createdAt))

  return NextResponse.json({ keys })
}

/**
 * POST /api/settings/api-keys
 * Create a new API key. Returns the full key ONCE.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: { name: string; scopes: string[]; expiresIn?: number | null; expiresAt?: string | null }
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  if (!body.name || typeof body.name !== 'string') {
    return ApiErrors.badRequest('name is required')
  }

  if (!Array.isArray(body.scopes) || body.scopes.length === 0) {
    return ApiErrors.badRequest('scopes must be a non-empty array')
  }

  const { key, hash, prefix } = generateApiKey()

  let expiresAt: Date | null = null
  if (body.expiresAt) {
    expiresAt = new Date(body.expiresAt)
  } else if (body.expiresIn) {
    expiresAt = new Date(Date.now() + body.expiresIn * 24 * 60 * 60 * 1000)
  }

  const [apiKey] = await db.insert(apiKeys).values({
    organizationId: session.orgId,
    createdBy: session.userId,
    name: body.name,
    keyHash: hash,
    keyPrefix: prefix,
    scopes: body.scopes,
    status: 'active',
    expiresAt: expiresAt ?? undefined,
  }).returning({
    id: apiKeys.id,
    name: apiKeys.name,
    keyPrefix: apiKeys.keyPrefix,
    scopes: apiKeys.scopes,
    status: apiKeys.status,
    expiresAt: apiKeys.expiresAt,
    createdAt: apiKeys.createdAt,
  })

  return NextResponse.json({
    apiKey,
    // Full key — shown only once
    key,
  }, { status: 201 })
}
