import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { uploadEvidenceFile } from '@/lib/storage/upload-evidence'
import { ALLOWED_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES } from '@/lib/email/inbound'

/**
 * POST /api/evidence/upload
 *
 * Evidence upload endpoint. Accepts multipart/form-data with:
 * - file: File
 * - controlAssignmentId: string (optional)
 *
 * Uses the configured storage provider (local/s3/azure_blob/minio/onedrive).
 * Returns the storage key which must be passed to POST /api/evidence to create the DB record.
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

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return ApiErrors.badRequest(`File type not allowed: ${file.type}`)
  }

  // Validate size
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return ApiErrors.badRequest(`File too large: max ${MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024}MB`)
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    const { key, url } = await uploadEvidenceFile(
      buffer,
      file.name,
      file.type,
      session.orgId
    )

    return NextResponse.json({
      ok: true,
      storageKey: key,
      storageUrl: url,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    })
  } catch (err: unknown) {
    return ApiErrors.internal(`Upload failed: ${(err as Error).message}`)
  }
}
