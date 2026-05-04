import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evidence } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { uploadEvidenceFile } from '@/lib/storage/upload-evidence'

/**
 * GET /api/evidence
 * List evidence with optional filters: search, type, status, frameworkId, dateFrom, dateTo
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_EVIDENCE)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search') || ''
  const type = searchParams.get('type') || ''
  const status = searchParams.get('status') || ''
  const dateFrom = searchParams.get('dateFrom') || ''
  const dateTo = searchParams.get('dateTo') || ''

  const records = await db
    .select()
    .from(evidence)
    .where(eq(evidence.organizationId, session.orgId))
    .orderBy(evidence.createdAt)
    .limit(200)

  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const filtered = records.filter((r) => {
    if (search) {
      const s = search.toLowerCase()
      if (!r.title.toLowerCase().includes(s) && !(r.description?.toLowerCase().includes(s))) return false
    }
    if (type && r.evidenceType !== type) return false
    if (status && r.status !== status) return false
    if (dateFrom && r.createdAt < new Date(dateFrom)) return false
    if (dateTo && r.createdAt > new Date(dateTo)) return false
    return true
  })

  const stats = {
    total: records.length,
    pendingReview: records.filter((r) => r.status === 'pending').length,
    approved: records.filter((r) => r.status === 'approved').length,
    expiringSoon: records.filter((r) => {
      if (!r.expiresAt) return false
      return r.expiresAt > now && r.expiresAt <= thirtyDays
    }).length,
  }

  return NextResponse.json({ evidence: filtered, total: filtered.length, stats })
}

/**
 * POST /api/evidence
 * Create evidence with optional file upload via multipart/form-data
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.UPLOAD_EVIDENCE)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  let title: string
  let description: string | undefined
  let evidenceTypeVal: string
  let expiresAt: string | undefined
  let controlAssignmentId: string | undefined
  let notes: string | undefined
  let fileName: string | undefined
  let fileSize: number | undefined
  let mimeType: string | undefined
  let storageKey: string | undefined
  let storageProvider: string | undefined

  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return ApiErrors.badRequest('Invalid form data')
    }

    title = formData.get('title') as string
    description = formData.get('description') as string | undefined
    evidenceTypeVal = (formData.get('evidenceType') as string) || 'document'
    expiresAt = formData.get('expiresAt') as string | undefined
    controlAssignmentId = formData.get('controlAssignmentId') as string | undefined
    notes = formData.get('notes') as string | undefined

    const file = formData.get('file') as File | null
    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const { key } = await uploadEvidenceFile(buffer, file.name, file.type, session.orgId)

      fileName = file.name
      fileSize = file.size
      mimeType = file.type
      storageKey = key
      storageProvider = 'pluggable'
    }
  } else {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return ApiErrors.badRequest('Invalid JSON body')
    }
    title = body.title as string
    description = body.description as string | undefined
    evidenceTypeVal = (body.evidenceType as string) || 'document'
    expiresAt = body.expiresAt as string | undefined
    controlAssignmentId = body.controlAssignmentId as string | undefined
    notes = body.notes as string | undefined
  }

  if (!title) return ApiErrors.badRequest('Title is required')

  const validTypes = ['screenshot', 'document', 'log', 'automated', 'text', 'video', 'configuration']
  if (!validTypes.includes(evidenceTypeVal)) {
    evidenceTypeVal = 'document'
  }

  const [record] = await db.insert(evidence).values({
    organizationId: session.orgId,
    title,
    description: description || undefined,
    evidenceType: evidenceTypeVal as 'screenshot' | 'document' | 'log' | 'automated' | 'text' | 'video' | 'configuration',
    status: 'pending',
    uploadedBy: session.userId || undefined,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    controlAssignmentId: controlAssignmentId || undefined,
    fileName: fileName || undefined,
    fileSize: fileSize || undefined,
    mimeType: mimeType || undefined,
    storageKey: storageKey || undefined,
    storageProvider: storageProvider || undefined,
    metadata: notes ? { notes } : undefined,
  }).returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'evidence.upload',
    resourceType: 'evidence',
    resourceId: record.id,
    resourceTitle: record.title,
    description: `Uploaded evidence: ${record.title}`,
    request: req,
  })

  return NextResponse.json({ evidence: record }, { status: 201 })
}
