/**
 * Azure Blob Storage adaptor — Phase 2G StorageProvider interface
 * Uses Azure Storage REST API via fetch() — no SDK required.
 * Supports both connection string and account name/key auth.
 */
import crypto from 'crypto'
import type { StorageProvider, StorageFile, UploadOptions, AzureBlobConfig } from './index'
import { assertSafeStorageKey } from '@/lib/security/file-validator'

/** SAS read TTL in seconds — 15 minutes. */
const SAS_TTL_SECONDS = 15 * 60

export class AzureBlobStorageAdaptor implements StorageProvider {
  private accountName: string
  private accountKey: string
  private containerName: string

  constructor(config: AzureBlobConfig) {
    // Parse from connection string if provided
    if (config.connectionString) {
      const m = config.connectionString.match(/AccountName=([^;]+)/)
      const k = config.connectionString.match(/AccountKey=([^;]+)/)
      this.accountName = m?.[1] || config.accountName
      this.accountKey = k?.[1] || config.accountKey
    } else {
      this.accountName = config.accountName
      this.accountKey = config.accountKey
    }
    this.containerName = config.containerName
  }

  private blobUrl(key?: string): string {
    const base = `https://${this.accountName}.blob.core.windows.net/${this.containerName}`
    return key ? `${base}/${encodeURIComponent(key)}` : base
  }

  /** Build the SharedKey Authorization header for an Azure Blob REST call */
  private buildAuthHeader(method: string, url: string, headers: Record<string, string>): string {
    const parsedUrl = new URL(url)
    const canonicalizedResource = `/${this.accountName}${parsedUrl.pathname}${parsedUrl.search ? '\n' + parsedUrl.search.slice(1).split('&').sort().join('\n') : ''}`

    const contentLength = headers['content-length'] || ''
    const contentType = headers['content-type'] || ''
    const date = headers['x-ms-date'] || ''

    // Build canonicalized headers (x-ms-* headers sorted)
    const xmsHeaders = Object.entries(headers)
      .filter(([k]) => k.toLowerCase().startsWith('x-ms-'))
      .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`)
      .sort()
      .join('\n')

    const stringToSign = [
      method.toUpperCase(),
      '', // Content-MD5
      contentType,
      '', // Date (we use x-ms-date instead)
      xmsHeaders,
      canonicalizedResource,
    ].join('\n')

    const keyBuffer = Buffer.from(this.accountKey, 'base64')
    const signature = crypto.createHmac('sha256', keyBuffer).update(stringToSign, 'utf8').digest('base64')

    return `SharedKey ${this.accountName}:${signature}`
  }

  private async request(
    method: string,
    key: string,
    opts: {
      body?: Buffer
      extraHeaders?: Record<string, string>
    } = {}
  ): Promise<Response> {
    const url = this.blobUrl(key)
    const date = new Date().toUTCString()
    const headers: Record<string, string> = {
      'x-ms-date': date,
      'x-ms-version': '2021-06-08',
      ...opts.extraHeaders,
    }

    if (opts.body) {
      headers['content-length'] = String(opts.body.length)
    }

    const authHeader = this.buildAuthHeader(method, url, headers)
    headers['authorization'] = authHeader

    const response = await fetch(url, {
      method,
      headers,
      body: opts.body ? new Uint8Array(opts.body) : undefined,
    })

    if (!response.ok && response.status !== 404) {
      const text = await response.text().catch(() => '')
      throw new Error(`Azure Blob ${method} ${key} → ${response.status}: ${text}`)
    }

    return response
  }

  async upload(options: UploadOptions): Promise<StorageFile> {
    const { key, buffer, mimeType, metadata } = options
    assertSafeStorageKey(key)

    const extraHeaders: Record<string, string> = {
      'content-type': mimeType,
      'x-ms-blob-type': 'BlockBlob',
    }

    if (metadata) {
      for (const [k, v] of Object.entries(metadata)) {
        extraHeaders[`x-ms-meta-${k}`] = v
      }
    }

    await this.request('PUT', key, { body: buffer, extraHeaders })

    const url = await this.getUrl(key)
    return { key, url, size: buffer.length, mimeType, metadata }
  }

  async download(key: string): Promise<Buffer> {
    assertSafeStorageKey(key)
    const response = await this.request('GET', key)
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async delete(key: string): Promise<void> {
    assertSafeStorageKey(key)
    const url = this.blobUrl(key)
    const date = new Date().toUTCString()
    const headers: Record<string, string> = {
      'x-ms-date': date,
      'x-ms-version': '2021-06-08',
      'x-ms-delete-snapshots': 'include',
    }
    const authHeader = this.buildAuthHeader('DELETE', url, headers)
    headers['authorization'] = authHeader

    const response = await fetch(url, { method: 'DELETE', headers })
    if (!response.ok && response.status !== 404) {
      const text = await response.text().catch(() => '')
      throw new Error(`Azure Blob DELETE ${key} → ${response.status}: ${text}`)
    }
  }

  /**
   * Generate a SAS URL for a blob.
   *
   * Security (A4):
   *  - signedProtocol is 'https' (no HTTP fallback).
   *  - TTL is hard-capped at SAS_TTL_SECONDS (15 minutes).
   *  - opts.clientIp (if provided) pins the SAS to a single client IP via
   *    signedIP.  If omitted the SAS is unpinned — callers should pass the
   *    requester's IP whenever possible.  This is a documented trade-off.
   */
  async getUrl(key: string, opts?: { clientIp?: string }): Promise<string> {
    assertSafeStorageKey(key)
    const start = new Date()
    const expiry = new Date(start.getTime() + SAS_TTL_SECONDS * 1000)

    const toISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

    const signedPermissions = 'r'
    const signedStart = toISO(start)
    const signedExpiry = toISO(expiry)
    const canonicalizedResource = `/blob/${this.accountName}/${this.containerName}/${key}`
    const signedIP = opts?.clientIp || ''
    const signedProtocol = 'https'
    const signedVersion = '2021-06-08'
    const signedResource = 'b'

    const stringToSign = [
      signedPermissions,
      signedStart,
      signedExpiry,
      canonicalizedResource,
      '', // signedIdentifier
      signedIP,
      signedProtocol,
      signedVersion,
      signedResource,
      '', // snapshot
      '', // encryptionScope
      '', // rscc
      '', // rscd
      '', // rsce
      '', // rscl
      '', // rsct
    ].join('\n')

    const keyBuffer = Buffer.from(this.accountKey, 'base64')
    const signature = crypto.createHmac('sha256', keyBuffer).update(stringToSign, 'utf8').digest('base64')

    const params = new URLSearchParams({
      sv: signedVersion,
      se: signedExpiry,
      sr: signedResource,
      sp: signedPermissions,
      spr: signedProtocol,
      sig: signature,
    })
    if (signedIP) params.set('sip', signedIP)

    return `${this.blobUrl(key)}?${params.toString()}`
  }

  async exists(key: string): Promise<boolean> {
    assertSafeStorageKey(key)
    const url = this.blobUrl(key)
    const date = new Date().toUTCString()
    const headers: Record<string, string> = {
      'x-ms-date': date,
      'x-ms-version': '2021-06-08',
    }
    const authHeader = this.buildAuthHeader('HEAD', url, headers)
    headers['authorization'] = authHeader

    const response = await fetch(url, { method: 'HEAD', headers })
    return response.ok
  }

  async list(prefix: string): Promise<StorageFile[]> {
    if (prefix) assertSafeStorageKey(prefix)
    const url = `https://${this.accountName}.blob.core.windows.net/${this.containerName}?restype=container&comp=list&prefix=${encodeURIComponent(prefix)}`
    const date = new Date().toUTCString()
    const headers: Record<string, string> = {
      'x-ms-date': date,
      'x-ms-version': '2021-06-08',
    }
    const authHeader = this.buildAuthHeader('GET', url, headers)
    headers['authorization'] = authHeader

    const response = await fetch(url, { method: 'GET', headers })
    if (!response.ok) return []

    const text = await response.text()
    // Parse XML to extract blob names and sizes
    const results: StorageFile[] = []
    const nameMatches = text.matchAll(/<Name>([^<]+)<\/Name>/g)
    const sizeMatches = [...text.matchAll(/<Content-Length>(\d+)<\/Content-Length>/g)]
    let i = 0
    for (const match of nameMatches) {
      const key = match[1]
      const size = sizeMatches[i] ? parseInt(sizeMatches[i][1]) : undefined
      results.push({ key, size })
      i++
    }
    return results
  }
}
