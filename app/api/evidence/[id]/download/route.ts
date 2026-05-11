import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evidence } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { readFile, realpath } from 'fs/promises'
import path from 'path'
import {
  assertSafeStorageKey,
  FileValidationError,
  isActiveContentMime,
  pickServeMime,
  sanitizeFilename,
  sniffMime,
} from '@/lib/security/file-validator'

const UPLOAD_DIR = '/tmp/evidence-uploads'
const SAFE_BASE = path.resolve(UPLOAD_DIR)
const SAFE_BASE_PREFIX = SAFE_BASE.endsWith(path.sep) ? SAFE_BASE : SAFE_BASE + path.sep

/**
 * GET /api/evidence/[id]/download
 * Stream the file associated with an evidence record.
 *
 * Security (A4 / C15):
 *  - storageKey is asserted safe before any FS operation.
 *  - resolved path must remain under SAFE_BASE + path.sep.
 *  - realpath() re-checked after read to defeat symlink escapes.
 *  - Sniffed MIME used for Content-Type; active-content types refused.
 *  - Strict security headers + forced attachment disposition.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_EVIDENCE)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [record] = await db
    .select()
    .from(evidence)
    .where(and(eq(evidence.id, id), eq(evidence.organizationId, session.orgId)))

  if (!record) return ApiErrors.notFound('Evidence')

  // Only local storage is supported via this endpoint
  if (record.storageProvider !== 'local' || !record.storageKey) {
    return ApiErrors.notFound('File not available for download')
  }

  try {
    assertSafeStorageKey(record.storageKey)
  } catch (err) {
    if (err instanceof FileValidationError) {
      return ApiErrors.badRequest('Invalid storage key')
    }
    return ApiErrors.badRequest('Invalid storage key')
  }

  const resolved = path.resolve(SAFE_BASE, record.storageKey)
  if (!resolved.startsWith(SAFE_BASE_PREFIX) && resolved !== SAFE_BASE) {
    return ApiErrors.badRequest('Invalid storage key')
  }

  let fileBuffer: Buffer
  try {
    fileBuffer = await readFile(resolved)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found on server' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 })
  }

  try {
    const real = await realpath(resolved)
    if (!real.startsWith(SAFE_BASE_PREFIX) && real !== SAFE_BASE) {
      return ApiErrors.badRequest('Invalid storage key')
    }
  } catch {
    return ApiErrors.badRequest('Invalid storage key')
  }

  const sniffed = await sniffMime(fileBuffer)
  const fallback = record.mimeType || null

  if (isActiveContentMime(sniffed.mime) || isActiveContentMime(fallback)) {
    return NextResponse.json(
      { error: 'File type cannot be served' },
      { status: 415 },
    )
  }

  const mimeType = pickServeMime(sniffed.mime, fallback)
  const fileName = sanitizeFilename(record.fileName || record.storageKey)
  const encodedName = encodeURIComponent(fileName)

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    },
  })
}
