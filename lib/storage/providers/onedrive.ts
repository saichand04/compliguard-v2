import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import type { StorageProvider, UploadResult } from '../types'

/**
 * OneDrive/SharePoint storage provider using Microsoft Graph API.
 * Files are stored in a SharePoint document library identified by STORAGE_ONEDRIVE_DRIVE_ID.
 */
export class OneDriveStorageProvider implements StorageProvider {
  private getClient(): Client {
    const tenantId = process.env.STORAGE_ONEDRIVE_TENANT_ID
    const clientId = process.env.STORAGE_ONEDRIVE_CLIENT_ID
    const clientSecret = process.env.STORAGE_ONEDRIVE_CLIENT_SECRET

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error(
        'OneDrive storage requires STORAGE_ONEDRIVE_TENANT_ID, STORAGE_ONEDRIVE_CLIENT_ID, and STORAGE_ONEDRIVE_CLIENT_SECRET'
      )
    }

    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret)

    return Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await credential.getToken('https://graph.microsoft.com/.default')
          return token?.token || ''
        },
      },
    })
  }

  private getDriveId(): string {
    return process.env.STORAGE_ONEDRIVE_DRIVE_ID || ''
  }

  async upload(buffer: Buffer, key: string, mimeType: string, _orgId: string): Promise<UploadResult> {
    const client = this.getClient()
    const driveId = this.getDriveId()
    // Use the key as the remote path within the drive
    await client
      .api(`/drives/${driveId}/root:/${key}:/content`)
      .header('Content-Type', mimeType)
      .put(buffer)

    return {
      key,
      size: buffer.length,
      mimeType,
      provider: 'onedrive',
      bucket: driveId,
    }
  }

  async download(key: string, _orgId: string): Promise<Buffer> {
    const client = this.getClient()
    const driveId = this.getDriveId()
    const response = await client.api(`/drives/${driveId}/root:/${key}:/content`).get()
    // Graph API returns ArrayBuffer for binary content
    if (response instanceof ArrayBuffer) {
      return Buffer.from(response)
    }
    if (Buffer.isBuffer(response)) {
      return response
    }
    throw new Error(`Unexpected response type from Graph API: ${typeof response}`)
  }

  async delete(key: string, _orgId: string): Promise<void> {
    const client = this.getClient()
    const driveId = this.getDriveId()
    try {
      await client.api(`/drives/${driveId}/root:/${key}`).delete()
    } catch (err: unknown) {
      // Ignore 404 — file already deleted
      if ((err as { statusCode?: number }).statusCode !== 404) {
        throw err
      }
    }
  }

  async getSignedUrl(key: string, expiresIn: number, _orgId: string): Promise<string> {
    const client = this.getClient()
    const driveId = this.getDriveId()
    // Create a sharing link valid for the specified duration
    const response = await client
      .api(`/drives/${driveId}/root:/${key}:/createLink`)
      .post({
        type: 'view',
        scope: 'anonymous',
        expirationDateTime: new Date(Date.now() + expiresIn * 1000).toISOString(),
      })
    return response.link?.webUrl || ''
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const client = this.getClient()
      const driveId = this.getDriveId()
      const drive = await client.api(`/drives/${driveId}`).get()
      return { ok: true, message: `OneDrive drive "${drive.name}" is accessible` }
    } catch (err: unknown) {
      return { ok: false, message: `OneDrive error: ${(err as Error).message}` }
    }
  }
}
