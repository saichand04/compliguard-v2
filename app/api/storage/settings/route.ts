import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { encryptConfig, decryptConfig } from '@/lib/encryption'
import { resetStorageProvider } from '@/lib/storage'
import type { StorageConfig } from '@/lib/storage'

/**
 * GET /api/storage/settings
 * Returns the current storage configuration (sensitive fields masked).
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'admin') return ApiErrors.forbidden()

  const rows = await db.select().from(systemSettings).limit(1)
  const row = rows[0]

  if (!row) {
    return NextResponse.json({
      provider: 'local',
      local: { enabled: true },
    })
  }

  const extraConfig = (row.extraConfig as Record<string, unknown> | null) || {}
  const storageConfig = extraConfig.storage as StorageConfig | undefined

  if (!storageConfig) {
    return NextResponse.json({
      provider: row.storageProvider || 'local',
      local: { enabled: true },
    })
  }

  // Decrypt for reading, then mask secrets for UI display
  const decrypted = decryptConfig(storageConfig as unknown as Record<string, unknown>) as unknown as StorageConfig
  const masked = maskSecrets(decrypted as unknown as Record<string, unknown>)
  return NextResponse.json(masked)
}

/**
 * POST /api/storage/settings
 * Save (and encrypt) provider configuration.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'admin') return ApiErrors.forbidden()

  let body: StorageConfig
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON')
  }

  if (!body.provider) {
    return ApiErrors.badRequest('provider is required')
  }

  // Fetch current config to merge (preserve existing encrypted values if new value is masked)
  const rows = await db.select().from(systemSettings).limit(1)
  const row = rows[0]
  const currentExtra = (row?.extraConfig as Record<string, unknown> | null) || {}
  const currentStorage = currentExtra.storage
    ? decryptConfig(currentExtra.storage as Record<string, unknown>) as unknown as StorageConfig
    : undefined

  // Merge: if a field was masked (***), keep the existing decrypted value
  const merged = mergeConfig(body, currentStorage)

  // Encrypt sensitive values before storing
  const encrypted = encryptConfig(merged as unknown as Record<string, unknown>) as unknown as StorageConfig

  const newExtra = {
    ...currentExtra,
    storage: encrypted,
  }

  if (row) {
    await db.update(systemSettings).set({
      storageProvider: body.provider,
      extraConfig: newExtra,
      updatedAt: new Date(),
    })
  } else {
    await db.insert(systemSettings).values({
      storageProvider: body.provider,
      extraConfig: newExtra,
    })
  }

  // Reset cached provider singleton so next request uses new config
  resetStorageProvider()

  return NextResponse.json({ ok: true, provider: body.provider })
}

/** Replace masked values (***) with the existing decrypted values */
function mergeConfig(incoming: StorageConfig, existing?: StorageConfig): StorageConfig {
  if (!existing) return incoming

  const result = { ...incoming } as Record<string, unknown>
  const sensitiveKeys = ['secretAccessKey', 'accountKey', 'clientSecret', 'connectionString']

  for (const [providerKey, providerConfig] of Object.entries(incoming)) {
    if (typeof providerConfig === 'object' && providerConfig !== null && providerKey !== 'provider') {
      const existingProvider = (existing as Record<string, unknown>)[providerKey] as Record<string, unknown> | undefined
      if (existingProvider) {
        const mergedProvider = { ...(providerConfig as Record<string, unknown>) }
        for (const sensitiveKey of sensitiveKeys) {
          const val = (providerConfig as Record<string, unknown>)[sensitiveKey] as string | undefined
          if (val && val.includes('*') && existingProvider[sensitiveKey]) {
            mergedProvider[sensitiveKey] = existingProvider[sensitiveKey]
          }
        }
        result[providerKey] = mergedProvider
      }
    }
  }

  return result as unknown as StorageConfig
}

/** Mask sensitive fields for UI display */
function maskSecrets<T extends Record<string, unknown>>(config: T): T {
  const sensitiveKeys = ['secretAccessKey', 'accountKey', 'clientSecret', 'connectionString']
  const result = { ...config } as Record<string, unknown>

  for (const [key, value] of Object.entries(result)) {
    if (sensitiveKeys.includes(key) && typeof value === 'string' && value) {
      result[key] = '***'
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = maskSecrets(value as Record<string, unknown>)
    }
  }

  return result as T
}
