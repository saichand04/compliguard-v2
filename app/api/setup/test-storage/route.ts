import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile, access, unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { getSessionFromRequest } from '@/lib/auth/jwt'

/**
 * POST /api/setup/test-storage
 *
 * Validates a candidate storage provider configuration by uploading and
 * deleting a single test blob. Restricted to authenticated super_admin
 * callers because the request body carries live cloud credentials.
 *
 * SECURITY: this handler MUST NOT mutate `process.env.STORAGE_*`. The
 * candidate credentials are passed directly into the provider client
 * constructed in-scope here, so they cannot leak into the singleton
 * provider used by the rest of the application (see lib/storage).
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { provider?: string; config?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { provider, config = {} } = body

  try {
    if (provider === 'local') {
      const basePath = config.localPath || '/var/lib/compliguard/evidence'
      const testKey = `_test/connection-test-${Date.now()}.txt`
      const testPath = join(basePath, testKey)
      await mkdir(dirname(testPath), { recursive: true })
      await writeFile(testPath, Buffer.from('test'))
      await access(testPath)
      await unlink(testPath)
      return NextResponse.json({ ok: true, message: `Local storage at ${basePath} is writable` })
    }

    if (provider === 's3' || provider === 'minio') {
      const { S3Client, PutObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      const bucket = config.bucket
      const accessKeyId = config.accessKeyId
      const secretAccessKey = config.secretAccessKey
      const endpoint = config.endpoint
      if (!bucket || !accessKeyId || !secretAccessKey) {
        return NextResponse.json({ ok: false, message: 'bucket, accessKeyId and secretAccessKey are required' })
      }
      const client = new S3Client({
        region: config.region || 'us-east-1',
        credentials: { accessKeyId, secretAccessKey },
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      })
      const testKey = `_test/connection-test-${Date.now()}.txt`
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: testKey, Body: Buffer.from('test'), ContentType: 'text/plain' }))
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }))
      return NextResponse.json({
        ok: true,
        message: `${provider === 'minio' ? 'MinIO' : 'S3'} bucket "${bucket}" is accessible`,
      })
    }

    if (provider === 'azure-blob' || provider === 'azure_blob') {
      const { BlobServiceClient } = await import('@azure/storage-blob')
      const connectionString = config.connectionString
      const container = config.container || 'evidence'
      if (!connectionString) {
        return NextResponse.json({ ok: false, message: 'connectionString is required for Azure Blob' })
      }
      const client = BlobServiceClient.fromConnectionString(connectionString)
      const containerClient = client.getContainerClient(container)
      await containerClient.createIfNotExists()
      const testKey = `_test/connection-test-${Date.now()}.txt`
      const blobClient = containerClient.getBlockBlobClient(testKey)
      await blobClient.uploadData(Buffer.from('test'), {
        blobHTTPHeaders: { blobContentType: 'text/plain' },
      })
      await blobClient.deleteIfExists()
      return NextResponse.json({ ok: true, message: `Azure Blob container "${container}" is accessible` })
    }

    if (provider === 'onedrive') {
      // OneDrive testing requires a full OAuth dance; in the wizard we
      // simply confirm that all four required credentials are present.
      const { tenantId, clientId, clientSecret, driveId } = config
      if (!tenantId || !clientId || !clientSecret || !driveId) {
        return NextResponse.json({
          ok: false,
          message: 'tenantId, clientId, clientSecret and driveId are required',
        })
      }
      return NextResponse.json({
        ok: true,
        message: 'OneDrive credentials accepted. Live connection will be validated on first upload.',
      })
    }

    return NextResponse.json({ ok: false, message: `Unknown storage provider: ${provider}` })
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, message: `Storage test error: ${(err as Error).message}` })
  }
}
