import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob'
import type { StorageProvider, UploadResult } from '../types'

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
    const containerClient = this.getContainerClient()
    // Ensure container exists
    await containerClient.createIfNotExists({ access: 'private' })

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
    const blobClient = this.getContainerClient().getBlobClient(key)
    await blobClient.deleteIfExists()
  }

  async getSignedUrl(key: string, expiresIn: number, _orgId: string): Promise<string> {
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

    const sasOptions = {
      containerName: this.container,
      blobName: key,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(),
      expiresOn: new Date(Date.now() + expiresIn * 1000),
    }

    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString()
    const blobClient = this.getContainerClient().getBlobClient(key)
    return `${blobClient.url}?${sasToken}`
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const containerClient = this.getContainerClient()
      await containerClient.createIfNotExists({ access: 'private' })
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
