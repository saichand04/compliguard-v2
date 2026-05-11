/**
 * POST /api/frameworks/upload
 * Accept multipart/form-data with a framework file (CSV, JSON, or XLSX).
 * Parse, normalize, run mapping engine, return preview.
 * Stores an upload record in the framework_uploads table.
 *
 * Security (A4):
 *  - XLSX is parsed via the `exceljs` package — `xlsx` (sheetjs) has known
 *    prototype-pollution + ReDoS CVEs and is no longer a dependency.
 *  - At module load we freeze Object.prototype and Object.getPrototypeOf({})
 *    application-wide so a malicious workbook cannot pollute the JS engine's
 *    base prototypes.  This is intentional.
 *  - Both the Content-Length header and the actual buffer size are checked
 *    against a 10 MB cap before any parsing happens.
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

// Defense-in-depth against prototype-pollution payloads embedded in untrusted
// workbooks.  This is module-load-time, app-wide, and intentional.
try {
  Object.freeze(Object.prototype)
  Object.freeze(Object.getPrototypeOf({}))
} catch {
  // Already frozen in some test environments — ignore.
}

// Max file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * Parse an XLSX buffer into a CSV-like content string for the normalizer.
 * Uses the `exceljs` package; returns null on parse failure.
 */
async function parseXlsx(buffer: Buffer): Promise<string | null> {
  try {
    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    // exceljs accepts a Node Buffer or an ArrayBuffer-like input.
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)

    const sheet = wb.worksheets[0]
    if (!sheet) return null

    // Build rows: header row first (assumed row 1), then data rows.
    const rows: Record<string, string>[] = []
    let headers: string[] = []

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // row.values is 1-indexed; element 0 is always undefined.
      const values = (row.values as unknown[]).slice(1).map((v) => {
        if (v == null) return ''
        if (typeof v === 'object' && v !== null) {
          // exceljs can return rich-text / formula objects.
          const obj = v as { text?: string; result?: unknown; richText?: { text: string }[] }
          if (typeof obj.text === 'string') return obj.text
          if (Array.isArray(obj.richText)) {
            return obj.richText.map((r) => r.text).join('')
          }
          if (obj.result != null) return String(obj.result)
          return ''
        }
        return String(v)
      })

      if (rowNumber === 1) {
        headers = values.map((v) => v.trim() || `col${headers.length + 1}`)
        return
      }

      const obj: Record<string, string> = {}
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]] = values[i] ?? ''
      }
      rows.push(obj)
    })

    if (headers.length === 0 || rows.length === 0) return null

    const idCol =
      headers.find((h) => /^(id|control.?id|control.?number|ctrl.?id|identifier|ref)/i.test(h)) ??
      headers[0]

    const titleCol =
      headers.find((h) => /^(title|name|control.?name|control.?title|description|requirement)/i.test(h)) ??
      headers[1] ??
      headers[0]

    const descCol =
      headers.find(
        (h) => /^(description|detail|guidance|objective|requirement|text)/i.test(h) && h !== titleCol,
      ) ?? ''

    const catCol =
      headers.find((h) => /^(category|domain|family|area|group|section)/i.test(h)) ?? ''

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

  // Reject oversized requests before we buffer multipart data.
  const contentLength = Number(req.headers.get('content-length') || '0')
  if (contentLength > 0 && contentLength > MAX_FILE_SIZE + 64 * 1024) {
    return ApiErrors.badRequest('File too large. Maximum 10MB.')
  }

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
    return ApiErrors.badRequest('File too large. Maximum 10MB.')
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
      const buffer = Buffer.from(await file.arrayBuffer())
      if (buffer.length > MAX_FILE_SIZE) {
        await db
          .update(frameworkUploads)
          .set({ status: 'failed', errorMessage: 'File too large' })
          .where(eq(frameworkUploads.id, uploadRecord.id))
        return ApiErrors.badRequest('File too large. Maximum 10MB.')
      }

      const csvContent = await parseXlsx(buffer)

      if (csvContent === null) {
        await db
          .update(frameworkUploads)
          .set({
            status: 'failed',
            errorMessage: 'XLSX parsing failed. The file may be corrupt or unreadable.',
          })
          .where(eq(frameworkUploads.id, uploadRecord.id))

        return NextResponse.json(
          {
            error:
              'XLSX parsing failed. Please verify the file is a valid Excel workbook, or export as CSV and re-upload.',
            hint: 'Export the spreadsheet as CSV: File → Save As → CSV (Comma delimited)',
            uploadId: uploadRecord.id,
          },
          { status: 422 },
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
