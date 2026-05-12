import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { firewallEvidence, firewallFindings } from '@/lib/db/schema'
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
 * GET /api/firewall-audit/findings/[id]/evidence
 * List evidence files for a finding.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  // Verify finding belongs to org
  const [finding] = await db
    .select()
    .from(firewallFindings)
    .where(and(eq(firewallFindings.id, id), eq(firewallFindings.organizationId, session.orgId)))

  if (!finding) return ApiErrors.notFound('Firewall Finding')

  const evidence = await db
    .select()
    .from(firewallEvidence)
    .where(and(eq(firewallEvidence.findingId, id), eq(firewallEvidence.organizationId, session.orgId)))
    .orderBy(desc(firewallEvidence.createdAt))

  return NextResponse.json({ evidence })
}

/**
 * POST /api/firewall-audit/findings/[id]/evidence
 * Upload/attach evidence to a finding.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  // Verify finding belongs to org
  const [finding] = await db
    .select()
    .from(firewallFindings)
    .where(and(eq(firewallFindings.id, id), eq(firewallFindings.organizationId, session.orgId)))

  if (!finding) return ApiErrors.notFound('Firewall Finding')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = uploadEvidenceSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data

  const [evidence] = await db
    .insert(firewallEvidence)
    .values({
      organizationId: session.orgId,
      findingId: id,
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
