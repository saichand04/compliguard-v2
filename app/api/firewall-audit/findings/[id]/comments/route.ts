import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { firewallComments, firewallFindings } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const createCommentSchema = z.object({
  content: z.string().min(1),
  authorName: z.string().max(255).optional().nullable(),
})

/**
 * GET /api/firewall-audit/findings/[id]/comments
 * List comments for a finding.
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

  const comments = await db
    .select()
    .from(firewallComments)
    .where(and(eq(firewallComments.findingId, id), eq(firewallComments.organizationId, session.orgId)))
    .orderBy(asc(firewallComments.createdAt))

  return NextResponse.json({ comments })
}

/**
 * POST /api/firewall-audit/findings/[id]/comments
 * Add a comment to a finding.
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

  const result = createCommentSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data

  const [comment] = await db
    .insert(firewallComments)
    .values({
      findingId: id,
      organizationId: session.orgId,
      content: data.content,
      authorName: data.authorName,
      createdBy: session.userId,
    })
    .returning()

  return NextResponse.json({ comment }, { status: 201 })
}
