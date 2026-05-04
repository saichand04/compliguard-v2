import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq, and, or, isNull, gt } from 'drizzle-orm'

/**
 * Validate API key from Authorization header: "Bearer cgk_..."
 * Returns the apiKey record context or null on failure.
 */
export async function validateApiKey(
  request: NextRequest
): Promise<{ apiKeyId: string; orgId: string; scopes: string[] } | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const token = authHeader.slice(7).trim()
  if (!token || !token.startsWith('cgk_')) return null

  const hash = crypto.createHash('sha256').update(token).digest('hex')

  const now = new Date()

  const [keyRecord] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, hash),
        eq(apiKeys.status, 'active'),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now))
      )
    )
    .limit(1)

  if (!keyRecord) return null

  // Update lastUsedAt asynchronously (fire and forget)
  db.update(apiKeys)
    .set({ lastUsedAt: now })
    .where(eq(apiKeys.id, keyRecord.id))
    .catch(() => {/* ignore */})

  const scopes = Array.isArray(keyRecord.scopes) ? (keyRecord.scopes as string[]) : []

  return {
    apiKeyId: keyRecord.id,
    orgId: keyRecord.organizationId,
    scopes,
  }
}

/**
 * Generate a new API key.
 * key format: 'cgk_' + 64 hex chars
 * Returns { key, hash, prefix }
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = crypto.randomBytes(32).toString('hex')
  const key = `cgk_${raw}`
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  const prefix = key.slice(0, 12)
  return { key, hash, prefix }
}

/**
 * Check if a set of scopes includes a required scope.
 * Supports wildcards: 'admin:*' matches everything.
 * 'read:*' matches 'read:findings', 'read:controls', etc.
 */
export function hasScope(scopes: string[], required: string): boolean {
  if (scopes.includes('admin:*')) return true
  if (scopes.includes(required)) return true

  // Wildcard matching: 'read:*' matches 'read:findings'
  const [reqNs] = required.split(':')
  if (scopes.includes(`${reqNs}:*`)) return true

  return false
}
