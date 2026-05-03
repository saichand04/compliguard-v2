import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evidence } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

/**
 * GET /api/evidence?controlAssignmentId=&status=
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_EVIDENCE)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const { searchParams } = req.nextUrl
  const controlAssignmentId = searchParams.get('controlAssignmentId')
  const status = searchParams.get('status')

  const records = await db
    .select()
    .from(evidence)
    .where(eq(evidence.organizationId, session.orgId))
    .limit(100)

  const filtered = records.filter((e) => {
    if (controlAssignmentId && e.controlAssignmentId !== controlAssignmentId) return false
    if (status && e.status !== status) return false
    return true
  })

  // Generate signed URLs for each record if it has a storage key
  const withUrls = await Promise.all(
    filtered.map(async (record) => {
      if (!record.storageKey) return { ...record, downloadUrl: null }

      try {
        const { getStorageProvider } = await import('@/lib/storage')
        const provider = getStorageProvider()
        const downloadUrl = await provider.getSignedUrl(record.storageKey, 3600, session.orgId!)
        return { ...record, downloadUrl }
      } catch {
        return { ...record, downloadUrl: null }
      }
    })
  )

  return NextResponse.json({ evidence: withUrls, total: withUrls.length })
}

const createEvidenceSchema = z.object({
  controlAssignmentId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  evidenceType: z.enum(['screenshot', 'document', 'log', 'automated', 'text', 'video', 'configuration']),
  storageKey: z.string().optional(),
  storageProvider: z.string().optional(),
  storageBucket: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  textContent: z.string().optional(),
})

/**
 * POST /api/evidence
 * Create an evidence record after the file has already been uploaded via /api/evidence/upload.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.UPLOAD_EVIDENCE)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = createEvidenceSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.errors[0].message)
  }

  const [record] = await db.insert(evidence).values({
    ...result.data,
    organizationId: session.orgId,
    uploadedBy: session.userId,
    status: 'pending',
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
