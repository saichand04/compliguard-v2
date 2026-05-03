import type { StorageProvider, StorageProviderType } from './types'

let instance: StorageProvider | null = null

/**
 * Factory function that returns a singleton StorageProvider based on the STORAGE_PROVIDER env var.
 * Supported values: local | s3 | azure-blob | onedrive | minio
 * 
 * MinIO uses the S3 provider under the hood with STORAGE_S3_ENDPOINT set.
 */
export function getStorageProvider(): StorageProvider {
  if (instance) return instance

  const providerType = (process.env.STORAGE_PROVIDER || 'local') as StorageProviderType

  switch (providerType) {
    case 'local': {
      const { LocalStorageProvider } = require('./providers/local')
      instance = new LocalStorageProvider()
      break
    }
    case 's3':
    case 'minio': {
      const { S3StorageProvider } = require('./providers/s3')
      instance = new S3StorageProvider()
      break
    }
    case 'azure-blob': {
      const { AzureBlobStorageProvider } = require('./providers/azure-blob')
      instance = new AzureBlobStorageProvider()
      break
    }
    case 'onedrive': {
      const { OneDriveStorageProvider } = require('./providers/onedrive')
      instance = new OneDriveStorageProvider()
      break
    }
    default: {
      const { LocalStorageProvider } = require('./providers/local')
      instance = new LocalStorageProvider()
    }
  }

  return instance!
}

/**
 * Reset the singleton (useful for testing or after config changes).
 */
export function resetStorageProvider(): void {
  instance = null
}

export { generateStorageKey } from './types'
export type { StorageProvider, UploadResult, StorageProviderType } from './types'
