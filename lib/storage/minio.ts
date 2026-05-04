/**
 * MinIO storage adaptor — Phase 2G StorageProvider interface
 * MinIO is S3-compatible, so this wraps S3StorageAdaptor with endpoint override.
 */
import { S3StorageAdaptor } from './s3'
import type { StorageProvider, StorageFile, UploadOptions, MinIOConfig } from './index'

export class MinIOStorageAdaptor implements StorageProvider {
  private s3: S3StorageAdaptor

  constructor(config: MinIOConfig) {
    this.s3 = new S3StorageAdaptor({
      bucket: config.bucket,
      region: config.region || 'us-east-1',
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      endpoint: config.endpoint,
    })
  }

  upload(options: UploadOptions): Promise<StorageFile> {
    return this.s3.upload(options)
  }

  download(key: string): Promise<Buffer> {
    return this.s3.download(key)
  }

  delete(key: string): Promise<void> {
    return this.s3.delete(key)
  }

  getUrl(key: string): Promise<string> {
    return this.s3.getUrl(key)
  }

  exists(key: string): Promise<boolean> {
    return this.s3.exists(key)
  }

  list(prefix: string): Promise<StorageFile[]> {
    return this.s3.list(prefix)
  }
}
