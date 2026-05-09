import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'

/** Simple MIME type lookup by extension */
function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
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
  return map[ext] || 'application/octet-stream'
}

const BASE_PATH = process.env.STORAGE_LOCAL_PATH || '/tmp/compliguard-uploads'

/**
 * GET /api/storage/local/[...key]
 * Serve files from local filesystem storage.
 * Requires authentication.
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

  // Sanitize: prevent path traversal
  const sanitized = keyParts.map((part) => part.replace(/\.\./g, '_'))
  const key = sanitized.join('/')
  const filePath = join(BASE_PATH, key)

  // Ensure the resolved path stays within BASE_PATH
  if (!filePath.startsWith(BASE_PATH)) {
    return ApiErrors.badRequest('Invalid key')
  }

  try {
    const buffer = await readFile(filePath)
    const mimeType = getMimeType(filePath)
    const fileName = sanitized[sanitized.length - 1]

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(buffer.length),
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 })
  }
}
