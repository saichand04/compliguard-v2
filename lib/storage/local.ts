/**
 * Local filesystem storage adaptor — Phase 2G StorageProvider interface
 * Stores files at /tmp/compliguard-uploads/[orgId or prefix]/[key]
 */
import { mkdir, writeFile, readFile, unlink, access, readdir, stat } from 'fs/promises'
import { join, dirname, basename } from 'path'
import type { StorageProvider, StorageFile, UploadOptions, LocalConfig } from './index'

const DEFAULT_BASE_PATH = '/tmp/compliguard-uploads'

export class LocalStorageAdaptor implements StorageProvider {
  private basePath: string

  constructor(config?: LocalConfig) {
    this.basePath = config?.basePath || process.env.STORAGE_LOCAL_PATH || DEFAULT_BASE_PATH
  }

  private fullPath(key: string): string {
    // Sanitize key to prevent path traversal
    const safe = key.replace(/\.\./g, '_').replace(/^\//, '')
    return join(this.basePath, safe)
  }

  async upload(options: UploadOptions): Promise<StorageFile> {
    const { key, buffer, mimeType, metadata } = options
    const fp = this.fullPath(key)
    await mkdir(dirname(fp), { recursive: true })
    await writeFile(fp, buffer)
    return {
      key,
      url: `/api/storage/local/${key}`,
      size: buffer.length,
      mimeType,
      metadata,
    }
  }

  async download(key: string): Promise<Buffer> {
    const fp = this.fullPath(key)
    return readFile(fp)
  }

  async delete(key: string): Promise<void> {
    const fp = this.fullPath(key)
    try {
      await unlink(fp)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }

  async getUrl(key: string): Promise<string> {
    return `/api/storage/local/${key}`
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.fullPath(key))
      return true
    } catch {
      return false
    }
  }

  async list(prefix: string): Promise<StorageFile[]> {
    const dir = this.fullPath(prefix)
    const results: StorageFile[] = []
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile()) {
          const key = `${prefix}/${entry.name}`
          const fp = this.fullPath(key)
          try {
            const s = await stat(fp)
            results.push({ key, size: s.size, url: `/api/storage/local/${key}` })
          } catch {
            results.push({ key })
          }
        }
      }
    } catch {
      // Directory doesn't exist — return empty list
    }
    return results
  }
}
