import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
} from '@azure/storage-blob'
import type { StorageProvider, UploadResult } from '../types'
import { assertSafeStorageKey } from '@/lib/security/file-validator'

/** SAS read TTL in seconds — 15 minutes. */
const SAS_TTL_SECONDS = 15 * 60

export class AzureBlobStorageProvider implements StorageProvider {
  private client: BlobServiceClient
  private container: string

  constructor() {
    const connectionString = process.env.STORAGE_AZURE_CONNECTION_STRING
    if (!connectionString) {
      throw new Error('STORAGE_AZURE_CONNECTION_STRING is required for Azure Blob storage')
    }
    this.client = BlobServiceClient.fromConnectionString(connectionString)
    this.container = process.env.STORAGE_AZURE_CONTAINER || 'evidence'
  }

  private getContainerClient() {
    return this.client.getContainerClient(this.container)
  }

  async upload(buffer: Buffer, key: string, mimeType: string, _orgId: string): Promise<UploadResult> {
    assertSafeStorageKey(key)
    const containerClient = this.getContainerClient()
    // Ensure container exists
    await containerClient.createIfNotExists()

    const blobClient = containerClient.getBlockBlobClient(key)
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: mimeType },
    })

    return {
      key,
      size: buffer.length,
      mimeType,
      provider: 'azure-blob',
      bucket: this.container,
    }
  }

  async download(key: string, _orgId: string): Promise<Buffer> {
    assertSafeStorageKey(key)
    const blobClient = this.getContainerClient().getBlobClient(key)
    const response = await blobClient.download()
    if (!response.readableStreamBody) {
      throw new Error(`Azure Blob: empty stream for key ${key}`)
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      response.readableStreamBody!.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      response.readableStreamBody!.on('end', () => resolve(Buffer.concat(chunks)))
      response.readableStreamBody!.on('error', reject)
    })
  }

  async delete(key: string, _orgId: string): Promise<void> {
    assertSafeStorageKey(key)
    const blobClient = this.getContainerClient().getBlobClient(key)
    await blobClient.deleteIfExists()
  }

  /**
   * Generate a SAS URL for a single blob.
   *
   * Security (A4):
   *  - protocol: HTTPS only (never include 'http' in the SAS).
   *  - TTL is clamped to SAS_TTL_SECONDS (15 minutes) regardless of caller.
   *  - clientIp (optional) is passed via opts.clientIp; when provided the SAS
   *    is bound to that IP via ipRange.  When omitted we still issue a SAS but
   *    without IP pinning — the trade-off is documented inline.
   */
  async getSignedUrl(
    key: string,
    expiresIn: number,
    _orgId: string,
    opts?: { clientIp?: string },
  ): Promise<string> {
    assertSafeStorageKey(key)
    // Parse account name and key from connection string for SAS generation
    const connStr = process.env.STORAGE_AZURE_CONNECTION_STRING || ''
    const accountNameMatch = connStr.match(/AccountName=([^;]+)/)
    const accountKeyMatch = connStr.match(/AccountKey=([^;]+)/)

    if (!accountNameMatch || !accountKeyMatch) {
      // Fallback: use blob URL without SAS (less secure)
      const blobClient = this.getContainerClient().getBlobClient(key)
      return blobClient.url
    }

    const accountName = accountNameMatch[1]
    const accountKey = accountKeyMatch[1]
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey)

    // Hard cap on TTL — never longer than SAS_TTL_SECONDS even if caller asks
    // for more (some legacy callsites pass 3600).
    const effectiveTtl = Math.min(Math.max(60, expiresIn), SAS_TTL_SECONDS)

    const sasOptions: Parameters<typeof generateBlobSASQueryParameters>[0] = {
      containerName: this.container,
      blobName: key,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(),
      expiresOn: new Date(Date.now() + effectiveTtl * 1000),
      protocol: SASProtocol.Https,
    }

    if (opts?.clientIp) {
      // Pin the SAS to the requesting client IP.
      sasOptions.ipRange = { start: opts.clientIp, end: opts.clientIp }
    }
    // Trade-off: when clientIp is not supplied (legacy callsites) the SAS can
    // be replayed from any IP within its 15-minute window.  Callers SHOULD
    // pass the requester's IP whenever it is known.

    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString()
    const blobClient = this.getContainerClient().getBlobClient(key)
    return `${blobClient.url}?${sasToken}`
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const containerClient = this.getContainerClient()
      await containerClient.createIfNotExists()
      const testKey = `_test/connection-test-${Date.now()}.txt`
      const blobClient = containerClient.getBlockBlobClient(testKey)
      await blobClient.uploadData(Buffer.from('test'), {
        blobHTTPHeaders: { blobContentType: 'text/plain' },
      })
      await blobClient.deleteIfExists()
      return { ok: true, message: `Azure Blob container "${this.container}" is accessible` }
    } catch (err: unknown) {
      return { ok: false, message: `Azure Blob error: ${(err as Error).message}` }
    }
  }
}
