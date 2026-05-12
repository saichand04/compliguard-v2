import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dnsComments, dnsIssues } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const createCommentSchema = z.object({
  content: z.string().min(1),
  authorName: z.string().max(255).optional().nullable(),
})

/**
 * GET /api/dns-audit/issues/[id]/comments
 * List comments for a DNS issue.
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

  const comments = await db
    .select()
    .from(dnsComments)
    .where(and(eq(dnsComments.issueId, id), eq(dnsComments.organizationId, session.orgId)))
    .orderBy(asc(dnsComments.createdAt))

  return NextResponse.json({ comments })
}

/**
 * POST /api/dns-audit/issues/[id]/comments
 * Add a comment to a DNS issue.
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

  const result = createCommentSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data

  const [comment] = await db
    .insert(dnsComments)
    .values({
      issueId: id,
      organizationId: session.orgId,
      content: data.content,
      authorName: data.authorName,
      createdBy: session.userId,
    })
    .returning()

  return NextResponse.json({ comment }, { status: 201 })
}
