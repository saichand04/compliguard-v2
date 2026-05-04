import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { evidenceRequests, users } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getEmailProvider } from '@/lib/email'
import { evidenceRequestEmail } from '@/lib/email/templates/evidence-request'

// GET /api/evidence-requests — list all evidence requests for org
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.badRequest('No organization')

  const requests = await db
    .select()
    .from(evidenceRequests)
    .where(eq(evidenceRequests.organizationId, session.orgId))
    .orderBy(desc(evidenceRequests.createdAt))

  return NextResponse.json(requests)
}

// POST /api/evidence-requests — create a new evidence request and send email
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.badRequest('No organization')

  const body = await req.json() as {
    recipientEmail?: string
    recipientName?: string
    title?: string
    description?: string
    controlId?: string
    expiryDays?: number
  }

  const { recipientEmail, recipientName, title, description, controlId, expiryDays = 7 } = body

  if (!recipientEmail || !title) {
    return ApiErrors.badRequest('recipientEmail and title are required')
  }

  // Generate token and expiry
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)

  // Get requester's name
  const userRows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
  const requester = userRows[0]
  const requestedByName = [requester?.firstName, requester?.lastName].filter(Boolean).join(' ') || session.email

  const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://compliguard.app'
  const uploadUrl = `${baseUrl}/upload/${token}`

  // Save to DB
  const [request] = await db.insert(evidenceRequests).values({
    organizationId: session.orgId,
    controlId: controlId || null,
    requestedBy: session.userId,
    recipientEmail: recipientEmail.toLowerCase(),
    recipientName: recipientName || null,
    title,
    description: description || null,
    token,
    expiresAt,
  }).returning()

  // Send email
  try {
    const provider = await getEmailProvider()
    const html = evidenceRequestEmail({
      recipientName: recipientName || recipientEmail,
      requestedBy: requestedByName,
      controlName: title,
      description: description || '',
      uploadUrl,
      expiresAt,
    })

    await provider.send({
      to: { email: recipientEmail, name: recipientName },
      subject: `Evidence Request: ${title}`,
      htmlBody: html,
      textBody: `Hi,\n\n${requestedByName} has requested evidence: "${title}"\n\nUpload your evidence here: ${uploadUrl}\n\nThis link expires on ${expiresAt.toDateString()}.`,
      tag: 'evidence-request',
      metadata: { requestId: request.id },
    })
  } catch (err) {
    // Email failure should not fail the request creation
    console.error('[EvidenceRequests] Failed to send email:', err)
  }

  return NextResponse.json({
    id: request.id,
    token: request.token,
    uploadUrl,
    expiresAt,
  }, { status: 201 })
}
