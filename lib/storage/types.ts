export type StorageProviderType = 'local' | 's3' | 'azure-blob' | 'onedrive' | 'minio'

export interface UploadResult {
  /** Storage key (relative path/key within provider — NOT a full URL) */
  key: string
  /** File size in bytes */
  size: number
  /** MIME type of the uploaded file */
  mimeType: string
  /** Which provider stored this file */
  provider: StorageProviderType
  /** Bucket/container name at time of upload */
  bucket?: string
}

export interface StorageProvider {
  /**
   * Upload a file buffer to storage.
   * Key format: evidence/{orgId}/{year}/{month}/{uuid}-{filename}
   */
  upload(buffer: Buffer, key: string, mimeType: string, orgId: string): Promise<UploadResult>

  /**
   * Download a file as a Buffer.
   */
  download(key: string, orgId: string): Promise<Buffer>

  /**
   * Delete a file from storage.
   */
  delete(key: string, orgId: string): Promise<void>

  /**
   * Generate a pre-signed/temporary URL for direct download.
   * @param expiresIn - Expiry time in seconds
   */
  getSignedUrl(key: string, expiresIn: number, orgId: string): Promise<string>

  /**
   * Test the storage connection — write a small test file and read it back.
   */
  testConnection(): Promise<{ ok: boolean; message: string }>
}

/**
 * Generate a storage key for evidence files.
 */
export function generateStorageKey(orgId: string, fileName: string, uuid: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `evidence/${orgId}/${year}/${month}/${uuid}-${safeName}`
}
