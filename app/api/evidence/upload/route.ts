import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { uploadEvidenceFile } from '@/lib/storage/upload-evidence'
import { ALLOWED_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES } from '@/lib/email/inbound'
import {
  assertAllowedFile,
  FileValidationError,
  sanitizeFilename,
} from '@/lib/security/file-validator'

/**
 * POST /api/evidence/upload
 *
 * Evidence upload endpoint. Accepts multipart/form-data with:
 * - file: File
 * - controlAssignmentId: string (optional)
 *
 * Uses the configured storage provider (local/s3/azure_blob/minio/onedrive).
 * Returns the storage key which must be passed to POST /api/evidence to create the DB record.
 *
 * Security (A4):
 *  - file.type is NOT trusted; we sniff the magic bytes via assertAllowedFile
 *    and persist the sniffed MIME on the storage record.
 *  - filename is sanitized before being stored or echoed back.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.UPLOAD_EVIDENCE)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return ApiErrors.badRequest('Expected multipart/form-data')
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return ApiErrors.badRequest('No file provided')
  }

  // Validate size up-front so we don't buffer multi-GB uploads.
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return ApiErrors.badRequest(`File too large: max ${MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024}MB`)
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let sniffedMime: string
  try {
    const result = await assertAllowedFile(buffer, file.type, ALLOWED_MIME_TYPES)
    sniffedMime = result.mime
  } catch (err) {
    if (err instanceof FileValidationError) {
      return ApiErrors.badRequest(err.message)
    }
    return ApiErrors.badRequest('File rejected')
  }

  const safeName = sanitizeFilename(file.name)

  try {
    const { key, url } = await uploadEvidenceFile(
      buffer,
      safeName,
      sniffedMime,
      session.orgId,
    )

    return NextResponse.json({
      ok: true,
      storageKey: key,
      storageUrl: url,
      fileName: safeName,
      fileSize: buffer.length,
      mimeType: sniffedMime,
    })
  } catch (err: unknown) {
    return ApiErrors.internal(`Upload failed: ${(err as Error).message}`)
  }
}
