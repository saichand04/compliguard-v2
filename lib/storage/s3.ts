/**
 * AWS S3 storage adaptor — Phase 2G StorageProvider interface
 * Uses @aws-sdk/client-s3 (already in package.json)
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { StorageProvider, StorageFile, UploadOptions, S3Config } from './index'
import { assertSafeStorageKey } from '@/lib/security/file-validator'

export class S3StorageAdaptor implements StorageProvider {
  private client: S3Client
  private bucket: string
  private config: S3Config

  constructor(config: S3Config) {
    this.config = config
    this.bucket = config.bucket

    this.client = new S3Client({
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint
        ? {
            endpoint: config.endpoint,
            forcePathStyle: true,
          }
        : {}),
    })
  }

  async upload(options: UploadOptions): Promise<StorageFile> {
    const { key, buffer, mimeType, metadata } = options
    assertSafeStorageKey(key)
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: metadata,
      })
    )
    const url = await this.getUrl(key)
    return { key, url, size: buffer.length, mimeType, metadata }
  }

  async download(key: string): Promise<Buffer> {
    assertSafeStorageKey(key)
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    )
    if (!response.Body) throw new Error(`S3: empty body for key ${key}`)
    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  async delete(key: string): Promise<void> {
    assertSafeStorageKey(key)
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    )
  }

  async getUrl(key: string): Promise<string> {
    assertSafeStorageKey(key)
    // Generate a presigned GET URL valid for 1 hour
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.client, command, { expiresIn: 3600 })
  }

  async exists(key: string): Promise<boolean> {
    assertSafeStorageKey(key)
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch {
      return false
    }
  }

  async list(prefix: string): Promise<StorageFile[]> {
    if (prefix) assertSafeStorageKey(prefix)
    const response = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix })
    )
    const items = response.Contents || []
    return items.map((item) => ({
      key: item.Key || '',
      size: item.Size,
    }))
  }
}
