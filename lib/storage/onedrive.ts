/**
 * Microsoft OneDrive storage adaptor — Phase 2G StorageProvider interface
 * Uses Microsoft Graph API via fetch() — no SDK needed.
 * OAuth2 client credentials flow for access token.
 */
import type { StorageProvider, StorageFile, UploadOptions, OneDriveConfig } from './index'

export class OneDriveStorageAdaptor implements StorageProvider {
  private config: OneDriveConfig
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(config: OneDriveConfig) {
    this.config = config
  }

  /** Obtain an OAuth2 access token using client credentials flow. */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    const { clientId, clientSecret, tenantId } = this.config
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`OneDrive token error ${response.status}: ${text}`)
    }

    const data = await response.json() as {
      access_token: string
      expires_in: number
    }
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
    return this.accessToken
  }

  private driveBase(): string {
    const driveId = this.config.driveId
    return driveId
      ? `https://graph.microsoft.com/v1.0/drives/${driveId}`
      : 'https://graph.microsoft.com/v1.0/me/drive'
  }

  private itemPath(key: string): string {
    const folder = this.config.folderId
    if (folder) {
      return `${this.driveBase()}/items/${folder}:/${encodeURIComponent(key)}:`
    }
    return `${this.driveBase()}/root:/${encodeURIComponent(key)}:`
  }

  async upload(options: UploadOptions): Promise<StorageFile> {
    const { key, buffer, mimeType, metadata } = options
    const token = await this.getAccessToken()

    // Use upload session for large files, or direct PUT for ≤4MB
    if (buffer.length <= 4 * 1024 * 1024) {
      const url = `${this.itemPath(key)}/content`
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': mimeType,
        },
        body: new Uint8Array(buffer),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`OneDrive upload error ${response.status}: ${text}`)
      }

      const item = await response.json() as {
        id: string
        name: string
        size: number
        '@microsoft.graph.downloadUrl'?: string
        webUrl?: string
      }

      const url2 = item['@microsoft.graph.downloadUrl'] || item.webUrl || ''
      return { key, url: url2, size: item.size, mimeType, metadata }
    } else {
      // Upload session for files > 4MB
      const sessionUrl = `${this.itemPath(key)}/createUploadSession`
      const sessionResp = await fetch(sessionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
      })

      if (!sessionResp.ok) {
        throw new Error(`OneDrive upload session error: ${sessionResp.status}`)
      }

      const { uploadUrl } = await sessionResp.json() as { uploadUrl: string }

      // Upload in chunks (10MB each)
      const chunkSize = 10 * 1024 * 1024
      let uploadedItem: { size?: number; '@microsoft.graph.downloadUrl'?: string; webUrl?: string } = {}

      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const chunk = buffer.slice(offset, Math.min(offset + chunkSize, buffer.length))
        const end = offset + chunk.length - 1
        const resp = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Length': String(chunk.length),
            'Content-Range': `bytes ${offset}-${end}/${buffer.length}`,
          },
          body: new Uint8Array(chunk),
        })

        if (resp.status === 200 || resp.status === 201) {
          uploadedItem = await resp.json()
        } else if (resp.status !== 202) {
          throw new Error(`OneDrive chunk upload error: ${resp.status}`)
        }
      }

      const downloadUrl = uploadedItem['@microsoft.graph.downloadUrl'] || uploadedItem.webUrl || ''
      return { key, url: downloadUrl, size: buffer.length, mimeType, metadata }
    }
  }

  async download(key: string): Promise<Buffer> {
    const token = await this.getAccessToken()
    const url = `${this.itemPath(key)}/content`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'follow',
    })

    if (!response.ok) {
      throw new Error(`OneDrive download error ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async delete(key: string): Promise<void> {
    const token = await this.getAccessToken()
    const url = this.itemPath(key)
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok && response.status !== 404) {
      throw new Error(`OneDrive delete error ${response.status}`)
    }
  }

  async getUrl(key: string): Promise<string> {
    const token = await this.getAccessToken()
    const url = `${this.itemPath(key)}/createLink`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'view',
        scope: 'anonymous',
        expirationDateTime: new Date(Date.now() + 3600 * 1000).toISOString(),
      }),
    })

    if (!response.ok) {
      // Fallback: try direct download URL via item metadata
      try {
        const metaUrl = `${this.itemPath(key)}`
        const metaResp = await fetch(metaUrl, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (metaResp.ok) {
          const item = await metaResp.json() as {
            '@microsoft.graph.downloadUrl'?: string
            webUrl?: string
          }
          return item['@microsoft.graph.downloadUrl'] || item.webUrl || ''
        }
      } catch {
        // ignore
      }
      return ''
    }

    const data = await response.json() as { link?: { webUrl?: string } }
    return data.link?.webUrl || ''
  }

  async exists(key: string): Promise<boolean> {
    try {
      const token = await this.getAccessToken()
      const url = this.itemPath(key)
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.ok
    } catch {
      return false
    }
  }

  async list(prefix: string): Promise<StorageFile[]> {
    try {
      const token = await this.getAccessToken()
      const folder = this.config.folderId
      let url: string
      if (folder) {
        url = `${this.driveBase()}/items/${folder}/children`
      } else {
        url = `${this.driveBase()}/root:/${encodeURIComponent(prefix)}:/children`
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) return []

      const data = await response.json() as {
        value: Array<{
          name: string
          size: number
          '@microsoft.graph.downloadUrl'?: string
          webUrl?: string
        }>
      }

      return data.value.map((item) => ({
        key: `${prefix}/${item.name}`,
        size: item.size,
        url: item['@microsoft.graph.downloadUrl'] || item.webUrl,
      }))
    } catch {
      return []
    }
  }
}
