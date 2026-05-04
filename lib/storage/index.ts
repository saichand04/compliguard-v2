/**
 * Storage Abstraction Layer — Phase 2G
 *
 * Supports: local | s3 | azure_blob | onedrive | minio
 *
 * Provider is configured either via:
 *  1. Database (system_settings.extraConfig.storage) — runtime configurable via settings UI
 *  2. Environment variables (legacy / fallback)
 */

export type StorageProviderType = 'local' | 's3' | 'azure_blob' | 'onedrive' | 'minio'

// ---------------------------------------------------------------------------
// New interface matching Phase 2G spec
// ---------------------------------------------------------------------------
export interface StorageFile {
  key: string
  url?: string
  size?: number
  mimeType?: string
  metadata?: Record<string, string>
}

export interface UploadOptions {
  key: string
  buffer: Buffer
  mimeType: string
  originalName: string
  metadata?: Record<string, string>
}

export interface StorageProvider {
  upload(options: UploadOptions): Promise<StorageFile>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  getUrl(key: string): Promise<string>
  exists(key: string): Promise<boolean>
  list(prefix: string): Promise<StorageFile[]>
}

// ---------------------------------------------------------------------------
// Legacy interface (kept for backward compatibility with existing providers)
// ---------------------------------------------------------------------------
export interface UploadResult {
  key: string
  size: number
  mimeType: string
  provider: StorageProviderType
  bucket?: string
}

export interface LegacyStorageProvider {
  upload(buffer: Buffer, key: string, mimeType: string, orgId: string): Promise<UploadResult>
  download(key: string, orgId: string): Promise<Buffer>
  delete(key: string, orgId: string): Promise<void>
  getSignedUrl(key: string, expiresIn: number, orgId: string): Promise<string>
  testConnection(): Promise<{ ok: boolean; message: string }>
}

// ---------------------------------------------------------------------------
// Storage config types
// ---------------------------------------------------------------------------
export interface LocalConfig {
  enabled: boolean
  basePath?: string
}

export interface S3Config {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string
}

export interface AzureBlobConfig {
  accountName: string
  accountKey: string
  containerName: string
  connectionString?: string
}

export interface MinIOConfig {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  region?: string
}

export interface OneDriveConfig {
  clientId: string
  clientSecret: string
  tenantId: string
  driveId?: string
  folderId?: string
}

export interface StorageConfig {
  provider: StorageProviderType
  local?: LocalConfig
  s3?: S3Config
  azure_blob?: AzureBlobConfig
  minio?: MinIOConfig
  onedrive?: OneDriveConfig
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Singleton instance (legacy API — env-based)
// ---------------------------------------------------------------------------
let legacyInstance: LegacyStorageProvider | null = null

/**
 * Legacy factory — reads from environment variables.
 * Returns a LegacyStorageProvider compatible with existing upload routes.
 */
export function getStorageProvider(): LegacyStorageProvider {
  if (legacyInstance) return legacyInstance

  const providerType = (process.env.STORAGE_PROVIDER || 'local') as StorageProviderType

  switch (providerType) {
    case 's3':
    case 'minio': {
      const { S3StorageProvider } = require('./providers/s3')
      legacyInstance = new S3StorageProvider()
      break
    }
    case 'azure_blob':
    case 'azure-blob' as StorageProviderType: {
      const { AzureBlobStorageProvider } = require('./providers/azure-blob')
      legacyInstance = new AzureBlobStorageProvider()
      break
    }
    case 'onedrive': {
      const { OneDriveStorageProvider } = require('./providers/onedrive')
      legacyInstance = new OneDriveStorageProvider()
      break
    }
    case 'local':
    default: {
      const { LocalStorageProvider } = require('./providers/local')
      legacyInstance = new LocalStorageProvider()
      break
    }
  }

  return legacyInstance!
}

/**
 * Reset the singleton (useful for testing or after config changes).
 */
export function resetStorageProvider(): void {
  legacyInstance = null
  storageInstance = null
}

// ---------------------------------------------------------------------------
// New async factory — reads config from DB system_settings
// ---------------------------------------------------------------------------
let storageInstance: StorageProvider | null = null
let storageInstanceProvider: StorageProviderType | null = null

/**
 * Get a StorageProvider based on the database configuration.
 * Falls back to local storage if DB is unavailable or not configured.
 */
export async function getStorageProviderAsync(config?: StorageConfig): Promise<StorageProvider> {
  // If a config was explicitly passed, build a fresh provider
  if (config) {
    return buildStorageProvider(config)
  }

  // Return cached singleton
  if (storageInstance) return storageInstance

  // Try to load from DB
  try {
    const { db } = await import('@/lib/db')
    const { systemSettings } = await import('@/lib/db/schema')
    const { decryptConfig } = await import('@/lib/encryption')

    const rows = await db.select().from(systemSettings).limit(1)
    if (rows.length > 0) {
      const row = rows[0]
      const extraConfig = row.extraConfig as Record<string, unknown> | null
      if (extraConfig?.storage) {
        const storageConfig = decryptConfig(extraConfig.storage as Record<string, unknown>) as unknown as StorageConfig
        storageInstance = buildStorageProvider(storageConfig)
        storageInstanceProvider = storageConfig.provider as StorageProviderType
        return storageInstance
      }
      // Use DB-level storageProvider field + env vars
      if (row.storageProvider) {
        const envConfig = buildConfigFromEnv(row.storageProvider as StorageProviderType)
        storageInstance = buildStorageProvider(envConfig)
        storageInstanceProvider = row.storageProvider as StorageProviderType
        return storageInstance
      }
    }
  } catch {
    // DB not available — fall through to local
  }

  // Default: local storage
  const { LocalStorageAdaptor } = await import('./local')
  storageInstance = new LocalStorageAdaptor()
  storageInstanceProvider = 'local'
  return storageInstance
}

function buildConfigFromEnv(provider: StorageProviderType): StorageConfig {
  return {
    provider,
    local: { enabled: true },
    s3: {
      bucket: process.env.STORAGE_S3_BUCKET || '',
      region: process.env.STORAGE_S3_REGION || 'us-east-1',
      accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY || '',
      endpoint: process.env.STORAGE_S3_ENDPOINT,
    },
    azure_blob: {
      accountName: process.env.STORAGE_AZURE_ACCOUNT_NAME || '',
      accountKey: process.env.STORAGE_AZURE_ACCOUNT_KEY || '',
      containerName: process.env.STORAGE_AZURE_CONTAINER || 'evidence',
      connectionString: process.env.STORAGE_AZURE_CONNECTION_STRING,
    },
    minio: {
      endpoint: process.env.STORAGE_S3_ENDPOINT || '',
      bucket: process.env.STORAGE_S3_BUCKET || '',
      accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY || '',
    },
    onedrive: {
      clientId: process.env.STORAGE_ONEDRIVE_CLIENT_ID || '',
      clientSecret: process.env.STORAGE_ONEDRIVE_CLIENT_SECRET || '',
      tenantId: process.env.STORAGE_ONEDRIVE_TENANT_ID || '',
      driveId: process.env.STORAGE_ONEDRIVE_DRIVE_ID,
    },
  }
}

function buildStorageProvider(config: StorageConfig): StorageProvider {
  switch (config.provider) {
    case 's3': {
      const { S3StorageAdaptor } = require('./s3')
      return new S3StorageAdaptor(config.s3!)
    }
    case 'minio': {
      const { MinIOStorageAdaptor } = require('./minio')
      return new MinIOStorageAdaptor(config.minio!)
    }
    case 'azure_blob': {
      const { AzureBlobStorageAdaptor } = require('./azure-blob')
      return new AzureBlobStorageAdaptor(config.azure_blob!)
    }
    case 'onedrive': {
      const { OneDriveStorageAdaptor } = require('./onedrive')
      return new OneDriveStorageAdaptor(config.onedrive!)
    }
    case 'local':
    default: {
      const { LocalStorageAdaptor } = require('./local')
      return new LocalStorageAdaptor(config.local)
    }
  }
}

/**
 * Lazy singleton with get() method as specified in task.
 */
export const storage = {
  async get(): Promise<StorageProvider> {
    return getStorageProviderAsync()
  },
}

// Re-export legacy helpers
export { generateStorageKey } from './types'
export type { UploadResult as LegacyUploadResult } from './types'
