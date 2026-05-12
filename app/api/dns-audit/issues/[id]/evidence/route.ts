import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dnsEvidence, dnsIssues } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const uploadEvidenceSchema = z.object({
  fileName: z.string().min(1).max(500),
  fileUrl: z.string().min(1),
  fileType: z.string().max(50).default('other'),
  fileSizeBytes: z.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
})

/**
 * GET /api/dns-audit/issues/[id]/evidence
 * List evidence files for a DNS issue.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  // Verify issue belongs to org
  const [issue] = await db
    .select()
    .from(dnsIssues)
    .where(and(eq(dnsIssues.id, id), eq(dnsIssues.organizationId, session.orgId)))

  if (!issue) return ApiErrors.notFound('DNS Issue')

  const evidence = await db
    .select()
    .from(dnsEvidence)
    .where(and(eq(dnsEvidence.issueId, id), eq(dnsEvidence.organizationId, session.orgId)))
    .orderBy(desc(dnsEvidence.createdAt))

  return NextResponse.json({ evidence })
}

/**
 * POST /api/dns-audit/issues/[id]/evidence
 * Upload/attach evidence to a DNS issue.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  // Verify issue belongs to org
  const [issue] = await db
    .select()
    .from(dnsIssues)
    .where(and(eq(dnsIssues.id, id), eq(dnsIssues.organizationId, session.orgId)))

  if (!issue) return ApiErrors.notFound('DNS Issue')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = uploadEvidenceSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data

  const [evidence] = await db
    .insert(dnsEvidence)
    .values({
      organizationId: session.orgId,
      issueId: id,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      fileSizeBytes: data.fileSizeBytes,
      description: data.description,
      uploadedBy: session.userId,
    })
    .returning()

  return NextResponse.json({ evidence }, { status: 201 })
}
