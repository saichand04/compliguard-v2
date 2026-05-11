/**
 * Local filesystem storage adaptor — Phase 2G StorageProvider interface
 * Stores files at /tmp/compliguard-uploads/[orgId or prefix]/[key]
 */
import { mkdir, writeFile, readFile, unlink, access, readdir, stat } from 'fs/promises'
import path from 'path'
import { join, dirname, basename } from 'path'
import type { StorageProvider, StorageFile, UploadOptions, LocalConfig } from './index'
import { assertSafeStorageKey } from '@/lib/security/file-validator'

const DEFAULT_BASE_PATH = '/tmp/compliguard-uploads'

export class LocalStorageAdaptor implements StorageProvider {
  private basePath: string
  private safeBase: string

  constructor(config?: LocalConfig) {
    this.basePath = config?.basePath || process.env.STORAGE_LOCAL_PATH || DEFAULT_BASE_PATH
    this.safeBase = path.resolve(this.basePath)
  }

  private fullPath(key: string): string {
    assertSafeStorageKey(key)
    const resolved = path.resolve(this.safeBase, key)
    const prefix = this.safeBase.endsWith(path.sep) ? this.safeBase : this.safeBase + path.sep
    if (!resolved.startsWith(prefix) && resolved !== this.safeBase) {
      throw new Error('Resolved storage path escaped base directory')
    }
    return resolved
  }

  async upload(options: UploadOptions): Promise<StorageFile> {
    const { key, buffer, mimeType, metadata } = options
    const fp = this.fullPath(key)
    await mkdir(dirname(fp), { recursive: true })
    await writeFile(fp, buffer)
    return {
      key,
      url: this.publicUrl(key),
      size: buffer.length,
      mimeType,
      metadata,
    }
  }

  private publicUrl(key: string): string {
    // key is already asserted safe upstream; encode each segment so spaces/etc
    // don't break the URL.
    return `/api/storage/local/${key.split('/').map(encodeURIComponent).join('/')}`
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
    assertSafeStorageKey(key)
    return this.publicUrl(key)
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
    // Allow an empty-string prefix to list the root.
    const dir = prefix ? this.fullPath(prefix) : this.safeBase
    const results: StorageFile[] = []
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile()) {
          const key = `${prefix}/${entry.name}`
          const fp = this.fullPath(key)
          try {
            const s = await stat(fp)
            results.push({ key, size: s.size, url: this.publicUrl(key) })
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
