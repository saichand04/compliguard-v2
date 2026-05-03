import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { provider, config } = body

  try {
    // Set env vars temporarily for the test
    if (provider === 'local' || provider === 'minio' || provider === 's3' || provider === 'azure-blob' || provider === 'onedrive') {
      // Import the provider and test it
      const { resetStorageProvider, getStorageProvider } = await import('@/lib/storage')

      // Temporarily set env vars from config
      if (provider === 'local' && config?.localPath) {
        process.env.STORAGE_LOCAL_PATH = config.localPath
      } else if ((provider === 's3' || provider === 'minio') && config) {
        if (config.bucket) process.env.STORAGE_S3_BUCKET = config.bucket
        if (config.accessKeyId) process.env.STORAGE_S3_ACCESS_KEY_ID = config.accessKeyId
        if (config.secretAccessKey) process.env.STORAGE_S3_SECRET_ACCESS_KEY = config.secretAccessKey
        if (config.endpoint) process.env.STORAGE_S3_ENDPOINT = config.endpoint
      } else if (provider === 'azure-blob' && config) {
        if (config.connectionString) process.env.STORAGE_AZURE_CONNECTION_STRING = config.connectionString
        if (config.container) process.env.STORAGE_AZURE_CONTAINER = config.container
      } else if (provider === 'onedrive' && config) {
        if (config.tenantId) process.env.STORAGE_ONEDRIVE_TENANT_ID = config.tenantId
        if (config.clientId) process.env.STORAGE_ONEDRIVE_CLIENT_ID = config.clientId
        if (config.clientSecret) process.env.STORAGE_ONEDRIVE_CLIENT_SECRET = config.clientSecret
        if (config.driveId) process.env.STORAGE_ONEDRIVE_DRIVE_ID = config.driveId
      }

      process.env.STORAGE_PROVIDER = provider
      resetStorageProvider()
      const storageProvider = getStorageProvider()
      const result = await storageProvider.testConnection()
      return NextResponse.json(result)
    }

    return NextResponse.json({ ok: false, message: `Unknown storage provider: ${provider}` })
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, message: `Storage test error: ${(err as Error).message}` })
  }
}
