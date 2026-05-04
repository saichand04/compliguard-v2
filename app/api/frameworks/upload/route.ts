/**
 * POST /api/frameworks/upload
 * Accept multipart/form-data with a framework file (CSV, JSON, or XLSX).
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

/**
 * Parse an XLSX buffer into CSV-like content string for the normalizer.
 * Uses dynamic import so the xlsx package is optional — returns null if unavailable.
 */
async function parseXlsx(buffer: Buffer): Promise<string | null> {
  try {
    // Dynamic import — xlsx is an optional peer dependency
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Use the first sheet
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return null

    const sheet = workbook.Sheets[sheetName]
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) return null

    // Convert to CSV-like normalized content
    // Try to detect common column names for control ID and title
    const headers = Object.keys(rows[0])

    // Map each row to a NormalizedControl-compatible CSV row
    const idCol = headers.find((h) =>
      /^(id|control.?id|control.?number|ctrl.?id|identifier|ref)/i.test(h)
    ) ?? headers[0]

    const titleCol = headers.find((h) =>
      /^(title|name|control.?name|control.?title|description|requirement)/i.test(h)
    ) ?? headers[1] ?? headers[0]

    const descCol = headers.find((h) =>
      /^(description|detail|guidance|objective|requirement|text)/i.test(h) && h !== titleCol
    ) ?? ''

    const catCol = headers.find((h) =>
      /^(category|domain|family|area|group|section)/i.test(h)
    ) ?? ''

    // Build CSV: id,title,description,category
    const csvLines: string[] = ['id,title,description,category']
    for (const row of rows) {
      const id = String(row[idCol] ?? '').trim()
      const title = String(row[titleCol] ?? '').replace(/"/g, '""').trim()
      const desc = descCol ? String(row[descCol] ?? '').replace(/"/g, '""').trim() : ''
      const cat = catCol ? String(row[catCol] ?? '').replace(/"/g, '""').trim() : ''

      if (!id && !title) continue
      csvLines.push(`"${id}","${title}","${desc}","${cat}"`)
    }

    return csvLines.join('\n')
  } catch {
    return null
  }
}

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
      // Parse XLSX using dynamic import of the xlsx package
      const buffer = Buffer.from(await file.arrayBuffer())
      const csvContent = await parseXlsx(buffer)

      if (csvContent === null) {
        // xlsx package not available or parsing failed
        await db
          .update(frameworkUploads)
          .set({
            status: 'failed',
            errorMessage: 'XLSX parsing unavailable. Please install the xlsx package (npm install xlsx) or export to CSV.',
          })
          .where(eq(frameworkUploads.id, uploadRecord.id))

        return NextResponse.json(
          {
            error: 'XLSX parsing is not available in this deployment. Please export your spreadsheet as CSV and re-upload, or contact your administrator to install the xlsx package.',
            hint: 'Export the spreadsheet as CSV: File → Save As → CSV (Comma delimited)',
            uploadId: uploadRecord.id,
          },
          { status: 422 }
        )
      }

      // Successfully parsed XLSX as CSV — continue processing as CSV
      content = csvContent
      format = 'csv' // treat as CSV from here on
    } else {
      content = await file.text()
    }
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
    format: file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') ? 'xlsx' : format,
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
