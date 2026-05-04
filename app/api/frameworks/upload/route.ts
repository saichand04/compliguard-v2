/**
 * POST /api/frameworks/upload
 * Accept multipart/form-data with a framework file (CSV or JSON).
 * Parse, normalize, run mapping engine, return preview.
 * Stores an upload record in the framework_uploads table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { frameworkUploads } from '@/lib/db/schema/mapping_engine'
import { mappingEngine } from '@/lib/mapping-engine'
import { validateControls } from '@/lib/mapping-engine/framework-normalizer'
import type { FrameworkFormat } from '@/lib/mapping-engine/framework-normalizer'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.CREATE_CONTROLS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return ApiErrors.badRequest('Invalid multipart/form-data body')
  }

  const file = formData.get('file')
  const frameworkSlugHint = formData.get('frameworkSlug')?.toString() ?? undefined

  if (!file || !(file instanceof File)) {
    return ApiErrors.badRequest('No file provided. Include file field in form data.')
  }

  if (file.size > MAX_FILE_SIZE) {
    return ApiErrors.badRequest('File too large. Maximum 5MB.')
  }

  const filename = file.name.toLowerCase()
  let format: FrameworkFormat

  if (filename.endsWith('.csv')) {
    format = 'csv'
  } else if (filename.endsWith('.json')) {
    format = 'json'
  } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
    format = 'xlsx'
  } else {
    return ApiErrors.badRequest('Unsupported file type. Use CSV, JSON, or XLSX.')
  }

  // Create an upload record in pending state
  const [uploadRecord] = await db
    .insert(frameworkUploads)
    .values({
      organizationId: session.orgId,
      filename: `upload_${Date.now()}_${file.name}`,
      originalFilename: file.name,
      fileType: format,
      status: 'processing',
      uploadedBy: session.userId,
    })
    .returning()

  let content: string

  try {
    if (format === 'xlsx') {
      // XLSX: we can't easily parse binary in edge runtime without a library.
      // Return error asking for CSV export — mark upload as failed.
      await db
        .update(frameworkUploads)
        .set({ status: 'failed', errorMessage: 'XLSX parsing requires server-side processing. Please export to CSV first.' })
        .where(eq(frameworkUploads.id, uploadRecord.id))

      return NextResponse.json(
        {
          error: 'XLSX parsing requires CSV conversion. Please export the spreadsheet as CSV and re-upload.',
          uploadId: uploadRecord.id,
        },
        { status: 422 }
      )
    }

    content = await file.text()
  } catch {
    await db
      .update(frameworkUploads)
      .set({ status: 'failed', errorMessage: 'Failed to read file content' })
      .where(eq(frameworkUploads.id, uploadRecord.id))

    return NextResponse.json({ error: 'Failed to read file content' }, { status: 500 })
  }

  // Parse and normalize
  const controls = mappingEngine.normalizeUpload(content, format, frameworkSlugHint)

  // Auto-detect framework if not provided
  const detectedSlug = frameworkSlugHint ?? mappingEngine.detectFramework(controls) ?? 'unknown'

  // Validate
  const validation = validateControls(controls)

  // Count how many have a canonical hint (= successfully mapped)
  const mappedCount = controls.filter((c) => c.canonicalHint).length

  // Update upload record
  await db
    .update(frameworkUploads)
    .set({
      status: 'complete',
      totalControls: validation.total,
      mappedControls: mappedCount,
      unmappedControls: validation.total - mappedCount,
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(frameworkUploads.id, uploadRecord.id))

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'framework.upload',
    resourceType: 'framework_upload',
    resourceId: uploadRecord.id,
    resourceTitle: file.name,
    description: `Uploaded framework file: ${file.name} (${validation.total} controls, ${mappedCount} mapped)`,
    request: req,
  })

  return NextResponse.json({
    uploadId: uploadRecord.id,
    filename: file.name,
    format,
    detectedFramework: detectedSlug,
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      total: validation.total,
      validCount: validation.validCount,
    },
    stats: {
      total: validation.total,
      mapped: mappedCount,
      unmapped: validation.total - mappedCount,
      mappingRate: validation.total > 0 ? Math.round((mappedCount / validation.total) * 100) : 0,
    },
    // Preview: first 20 controls
    preview: controls.slice(0, 20),
  })
}
