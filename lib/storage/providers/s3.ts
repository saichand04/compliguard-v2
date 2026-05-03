import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { StorageProvider, UploadResult, StorageProviderType } from '../types'

export class S3StorageProvider implements StorageProvider {
  private client: S3Client
  private bucket: string
  private providerType: StorageProviderType

  constructor() {
    const endpoint = process.env.STORAGE_S3_ENDPOINT
    this.providerType = endpoint ? 'minio' : 's3'
    this.bucket = process.env.STORAGE_S3_BUCKET || 'evidence'

    this.client = new S3Client({
      region: process.env.STORAGE_S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY || '',
      },
      ...(endpoint
        ? {
            endpoint,
            forcePathStyle: true, // Required for MinIO
          }
        : {}),
    })
  }

  async upload(buffer: Buffer, key: string, mimeType: string, _orgId: string): Promise<UploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
    await this.client.send(command)
    return {
      key,
      size: buffer.length,
      mimeType,
      provider: this.providerType,
      bucket: this.bucket,
    }
  }

  async download(key: string, _orgId: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })
    const response = await this.client.send(command)
    if (!response.Body) throw new Error(`S3: empty response body for key ${key}`)

    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  async delete(key: string, _orgId: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })
    await this.client.send(command)
  }

  async getSignedUrl(key: string, expiresIn: number, _orgId: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })
    return getSignedUrl(this.client, command, { expiresIn })
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const testKey = `_test/connection-test-${Date.now()}.txt`
      const uploadCmd = new PutObjectCommand({
        Bucket: this.bucket,
        Key: testKey,
        Body: Buffer.from('test'),
        ContentType: 'text/plain',
      })
      await this.client.send(uploadCmd)
      const deleteCmd = new DeleteObjectCommand({ Bucket: this.bucket, Key: testKey })
      await this.client.send(deleteCmd)
      return {
        ok: true,
        message: `${this.providerType === 'minio' ? 'MinIO' : 'S3'} bucket "${this.bucket}" is accessible`,
      }
    } catch (err: unknown) {
      return { ok: false, message: `S3/MinIO error: ${(err as Error).message}` }
    }
  }
}
