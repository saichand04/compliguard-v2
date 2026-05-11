import { mkdir, writeFile, readFile, unlink, access } from 'fs/promises'
import path from 'path'
import { join, dirname } from 'path'
import { SignJWT } from 'jose'
import type { StorageProvider, UploadResult } from '../types'
import { assertSafeStorageKey } from '@/lib/security/file-validator'

const DEFAULT_PATH = '/var/lib/compliguard/evidence'

export class LocalStorageProvider implements StorageProvider {
  private basePath: string
  private safeBase: string

  constructor() {
    this.basePath = process.env.STORAGE_LOCAL_PATH || DEFAULT_PATH
    this.safeBase = path.resolve(this.basePath)
  }

  private getFullPath(key: string): string {
    assertSafeStorageKey(key)
    const resolved = path.resolve(this.safeBase, key)
    const prefix = this.safeBase.endsWith(path.sep) ? this.safeBase : this.safeBase + path.sep
    if (!resolved.startsWith(prefix) && resolved !== this.safeBase) {
      throw new Error('Resolved storage path escaped base directory')
    }
    return resolved
  }

  async upload(buffer: Buffer, key: string, mimeType: string, orgId: string): Promise<UploadResult> {
    const fullPath = this.getFullPath(key)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, buffer)
    return {
      key,
      size: buffer.length,
      mimeType,
      provider: 'local',
      bucket: this.basePath,
    }
  }

  async download(key: string, _orgId: string): Promise<Buffer> {
    const fullPath = this.getFullPath(key)
    return readFile(fullPath)
  }

  async delete(key: string, _orgId: string): Promise<void> {
    const fullPath = this.getFullPath(key)
    try {
      await unlink(fullPath)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err
      }
    }
  }

  async getSignedUrl(key: string, expiresIn: number, _orgId: string): Promise<string> {
    assertSafeStorageKey(key)
    // Generate a signed JWT download token that the API route will validate
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET not set')
    
    const token = await new SignJWT({ key, type: 'download' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
      .sign(new TextEncoder().encode(secret))

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return `${baseUrl}/api/storage/download?token=${token}`
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const testKey = `_test/connection-test-${Date.now()}.txt`
      const testPath = this.getFullPath(testKey)
      await mkdir(dirname(testPath), { recursive: true })
      await writeFile(testPath, Buffer.from('test'))
      await access(testPath)
      await unlink(testPath)
      return { ok: true, message: `Local storage at ${this.basePath} is writable` }
    } catch (err: unknown) {
      return { ok: false, message: `Local storage error: ${(err as Error).message}` }
    }
  }
}
