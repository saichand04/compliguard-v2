/**
 * Shared evidence upload utility — Phase 2G
 * Uses the configured storage provider to upload evidence files.
 */
import { randomUUID } from 'crypto'
import { getStorageProviderAsync } from './index'

/**
 * Upload an evidence file using the active storage provider.
 * Returns the storage key and public/presigned URL.
 */
export async function uploadEvidenceFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  orgId: string
): Promise<{ key: string; url: string }> {
  const uuid = randomUUID()
  const key = generateEvidenceKey(orgId, originalName, uuid)

  const provider = await getStorageProviderAsync()
  const file = await provider.upload({
    key,
    buffer,
    mimeType,
    originalName,
    metadata: {
      orgId,
      originalName,
      uploadedAt: new Date().toISOString(),
    },
  })

  return {
    key: file.key,
    url: file.url || (await provider.getUrl(file.key)),
  }
}

/**
 * Generate a consistent storage key for evidence files.
 */
export function generateEvidenceKey(orgId: string, fileName: string, uuid: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  return `evidence/${orgId}/${year}/${month}/${uuid}-${safeName}`
}
