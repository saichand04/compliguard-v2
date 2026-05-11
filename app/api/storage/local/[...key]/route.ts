import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { readFile, realpath } from 'fs/promises'
import path from 'path'
import { extname } from 'path'
import {
  assertSafeStorageKey,
  FileValidationError,
  isActiveContentMime,
  pickServeMime,
  sanitizeFilename,
  sniffMime,
} from '@/lib/security/file-validator'

/** Fallback extension → MIME map (only used when content sniffing yields nothing). */
function extToMime(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.zip': 'application/zip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.log': 'text/plain',
  }
  return map[ext] ?? null
}

const BASE_PATH = process.env.STORAGE_LOCAL_PATH || '/tmp/compliguard-uploads'
const SAFE_BASE = path.resolve(BASE_PATH)
const SAFE_BASE_PREFIX = SAFE_BASE.endsWith(path.sep) ? SAFE_BASE : SAFE_BASE + path.sep

/**
 * GET /api/storage/local/[...key]
 * Serve files from local filesystem storage.
 * Requires authentication.
 *
 * Security (A4 / C15):
 *  - sanitized key is validated via assertSafeStorageKey, then path.resolve
 *    must remain under SAFE_BASE + path.sep (not merely startsWith(SAFE_BASE)).
 *  - after readFile, realpath() is re-checked under SAFE_BASE + path.sep so
 *    symlinks cannot escape.
 *  - Content-Type is determined by sniffing the first bytes; HTML/SVG/XML
 *    and executable types are refused.
 *  - Response is forced as attachment + strict CSP, X-Content-Type-Options,
 *    X-Frame-Options, Referrer-Policy.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const { key: keyParts } = await context.params
  if (!keyParts || keyParts.length === 0) {
    return ApiErrors.badRequest('No key provided')
  }

  const sanitizedKey = keyParts.join('/')

  try {
    assertSafeStorageKey(sanitizedKey)
  } catch (err) {
    if (err instanceof FileValidationError) {
      return ApiErrors.badRequest('Invalid key')
    }
    return ApiErrors.badRequest('Invalid key')
  }

  // Resolve against an absolute base.  The resolved path must remain inside
  // SAFE_BASE + path.sep — startsWith(SAFE_BASE) alone would allow a sibling
  // like "/tmp/compliguard-uploads-evil/...".
  const resolved = path.resolve(SAFE_BASE, sanitizedKey)
  if (!resolved.startsWith(SAFE_BASE_PREFIX) && resolved !== SAFE_BASE) {
    return ApiErrors.badRequest('Invalid key')
  }

  let buffer: Buffer
  try {
    buffer = await readFile(resolved)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 })
  }

  // Defeat symlink escapes by re-resolving the real path.
  try {
    const real = await realpath(resolved)
    if (!real.startsWith(SAFE_BASE_PREFIX) && real !== SAFE_BASE) {
      return ApiErrors.badRequest('Invalid key')
    }
  } catch {
    return ApiErrors.badRequest('Invalid key')
  }

  // Sniff actual content; refuse anything that browsers would render as
  // active content.
  const sniffed = await sniffMime(buffer)
  const fallback = extToMime(resolved)

  if (isActiveContentMime(sniffed.mime) || isActiveContentMime(fallback)) {
    return NextResponse.json(
      { error: 'File type cannot be served' },
      { status: 415 },
    )
  }

  const mimeType = pickServeMime(sniffed.mime, fallback)
  const fileName = sanitizeFilename(keyParts[keyParts.length - 1] || 'file')
  const encodedName = encodeURIComponent(fileName)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    },
  })
}
