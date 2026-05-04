import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evidence } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import fs from 'fs'
import path from 'path'

const UPLOAD_DIR = '/tmp/evidence-uploads'

/**
 * GET /api/evidence/[id]/download
 * Stream the file associated with an evidence record.
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

  // Only local storage is supported in Phase 2C
  if (record.storageProvider !== 'local' || !record.storageKey) {
    return ApiErrors.notFound('File not available for download')
  }

  const filePath = path.join(UPLOAD_DIR, record.storageKey)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found on server' }, { status: 404 })
  }

  const fileBuffer = fs.readFileSync(filePath)
  const fileName = record.fileName || record.storageKey
  const mimeType = record.mimeType || 'application/octet-stream'

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Content-Length': fileBuffer.length.toString(),
    },
  })
}
