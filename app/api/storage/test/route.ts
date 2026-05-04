import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { getStorageProviderAsync, resetStorageProvider } from '@/lib/storage'
import { decryptConfig } from '@/lib/encryption'
import type { StorageConfig } from '@/lib/storage'

/**
 * POST /api/storage/test
 * Test storage connectivity by uploading and deleting a tiny test file.
 * Accepts an optional config payload to test before saving.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'admin') return ApiErrors.forbidden()

  let testConfig: StorageConfig | undefined
  try {
    const body = await req.json()
    if (body?.provider) {
      testConfig = body as StorageConfig
    }
  } catch {
    // No config body — test the currently configured provider
  }

  try {
    let provider
    if (testConfig) {
      // Temporarily reset to get a fresh provider from the provided config
      // Decrypt any ENCRYPTED: values that may have been passed
      const decrypted = decryptConfig(testConfig as unknown as Record<string, unknown>) as unknown as StorageConfig
      provider = await getStorageProviderAsync(decrypted)
    } else {
      resetStorageProvider()
      provider = await getStorageProviderAsync()
    }

    const testKey = `_test/compliguard-storage-test-${Date.now()}.txt`
    const testBuffer = Buffer.from('CompliGuard storage connection test')

    // Upload
    await provider.upload({
      key: testKey,
      buffer: testBuffer,
      mimeType: 'text/plain',
      originalName: 'connection-test.txt',
    })

    // Download and verify
    const downloaded = await provider.download(testKey)
    if (downloaded.toString() !== testBuffer.toString()) {
      throw new Error('Downloaded content does not match uploaded content')
    }

    // Check exists
    const exists = await provider.exists(testKey)
    if (!exists) {
      throw new Error('File not found after upload')
    }

    // Get URL
    const url = await provider.getUrl(testKey)

    // Clean up
    await provider.delete(testKey)

    return NextResponse.json({
      ok: true,
      message: 'Storage connection successful',
      url,
    })
  } catch (err: unknown) {
    const message = (err as Error).message || 'Unknown error'
    return NextResponse.json(
      { ok: false, message: `Storage test failed: ${message}` },
      { status: 200 } // Return 200 so the client can read the error message
    )
  }
}
