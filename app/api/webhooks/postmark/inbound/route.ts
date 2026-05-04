import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, evidence, notifications } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStorageProvider, generateStorageKey } from '@/lib/storage'
import crypto from 'crypto'

export interface PostmarkInboundPayload {
  From: string
  FromFull: { Email: string; Name: string }
  To: string
  Subject: string
  TextBody?: string
  HtmlBody?: string
  Date: string
  MessageID: string
  Attachments?: Array<{
    Name: string
    Content: string  // base64
    ContentType: string
    ContentLength: number
  }>
}

/**
 * Verify Postmark inbound webhook HMAC signature.
 * Postmark sends X-Postmark-Signature header with HMAC-MD5 of the raw body.
 */
function verifyPostmarkSignature(
  body: string,
  signature: string | null,
  secret: string | undefined
): boolean {
  // If no webhook secret configured, skip verification (allow all inbound)
  if (!secret) return true
  if (!signature) return false

  const expectedSig = crypto
    .createHmac('md5', secret)
    .update(body)
    .digest('base64')

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    )
  } catch {
    return false
  }
}

// POST /api/webhooks/postmark/inbound
export async function POST(req: NextRequest) {
  // Postmark requires 200 OK regardless, otherwise it will retry
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-postmark-signature')
    const webhookSecret = process.env.POSTMARK_WEBHOOK_SECRET

    if (!verifyPostmarkSignature(rawBody, signature, webhookSecret)) {
      console.warn('[PostmarkInbound] Invalid HMAC signature — rejecting')
      return NextResponse.json({ ok: false }, { status: 200 })
    }

    const payload = JSON.parse(rawBody) as PostmarkInboundPayload

    const fromEmail = payload.FromFull?.Email || payload.From || ''
    const fromName = payload.FromFull?.Name || ''
    const subject = payload.Subject || '(no subject)'
    const textBody = payload.TextBody || ''
    const messageId = payload.MessageID || `inbound-${Date.now()}`
    const attachments = payload.Attachments || []

    // Look up user by sender email
    const userRows = await db.select().from(users).where(eq(users.email, fromEmail.toLowerCase())).limit(1)
    const user = userRows[0]

    if (!user || !user.organizationId) {
      console.log(`[PostmarkInbound] Unknown sender: ${fromEmail} — ignoring`)
      // Optionally send auto-reply here (skip to avoid loops)
      return NextResponse.json({ ok: true, skipped: 'unknown_sender' })
    }

    const orgId = user.organizationId
    const storage = getStorageProvider()
    const createdEvidenceIds: string[] = []

    // Create evidence records for each attachment
    for (const att of attachments) {
      try {
        const fileBuffer = Buffer.from(att.Content, 'base64')
        const storageKey = generateStorageKey(orgId, att.Name, crypto.randomUUID())
        const uploadResult = await storage.upload(fileBuffer, storageKey, att.ContentType, orgId)

        const descriptionText = [
          `Submitted via email`,
          subject ? `Subject: ${subject}` : null,
          textBody ? `Message: ${textBody.slice(0, 500)}` : null,
        ].filter(Boolean).join('\n')

        const [ev] = await db.insert(evidence).values({
          organizationId: orgId,
          title: att.Name,
          description: descriptionText,
          evidenceType: 'document',
          storageProvider: uploadResult.provider,
          storageKey: uploadResult.key,
          storageBucket: uploadResult.bucket,
          fileName: att.Name,
          fileSize: att.ContentLength,
          mimeType: att.ContentType,
          status: 'pending',
          uploadedBy: user.id,
          collectedViaEmail: true,
          metadata: {
            source: 'email',
            fromEmail,
            fromName,
            subject,
            messageId,
          },
        }).returning()

        if (ev) createdEvidenceIds.push(ev.id)
      } catch (err) {
        console.error('[PostmarkInbound] Failed to process attachment:', att.Name, err)
      }
    }

    // If no attachments, create a text evidence record from the email body
    if (attachments.length === 0 && textBody.trim()) {
      try {
        const [ev] = await db.insert(evidence).values({
          organizationId: orgId,
          title: subject || 'Email Evidence',
          description: textBody.slice(0, 5000),
          evidenceType: 'text',
          textContent: textBody,
          status: 'pending',
          uploadedBy: user.id,
          collectedViaEmail: true,
          metadata: {
            source: 'email',
            fromEmail,
            fromName,
            subject,
            messageId,
          },
        }).returning()
        if (ev) createdEvidenceIds.push(ev.id)
      } catch (err) {
        console.error('[PostmarkInbound] Failed to create text evidence:', err)
      }
    }

    // Create notification for the user
    if (createdEvidenceIds.length > 0) {
      try {
        await db.insert(notifications).values({
          organizationId: orgId,
          userId: user.id,
          type: 'evidence_request',
          title: 'Evidence received via email',
          body: `${createdEvidenceIds.length} item(s) received from ${fromEmail} — "${subject}"`,
          link: '/evidence',
          metadata: { evidenceIds: createdEvidenceIds, source: 'email' },
        })
      } catch (err) {
        console.error('[PostmarkInbound] Failed to create notification:', err)
      }
    }

    return NextResponse.json({
      ok: true,
      evidenceCreated: createdEvidenceIds.length,
      evidenceIds: createdEvidenceIds,
    })
  } catch (err) {
    // Always return 200 to prevent Postmark retries
    console.error('[PostmarkInbound] Unhandled error:', err)
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 200 })
  }
}
