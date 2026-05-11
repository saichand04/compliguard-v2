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
  Headers?: Array<{ Name: string; Value: string }>
  Attachments?: Array<{
    Name: string
    Content: string  // base64
    ContentType: string
    ContentLength: number
  }>
}

const SYSTEM_UNVERIFIED_EMAIL = 'inbound-unverified@compliguard.local'

/**
 * Verify Postmark inbound webhook authentication via HTTP Basic Auth.
 *
 * Postmark documents Basic Auth as the supported mechanism for inbound webhook
 * authentication (not HMAC). Configure it on the Postmark side:
 *   Inbound webhook URL: https://USER:PASS@compliguard.example.com/api/webhooks/postmark/inbound
 * and set POSTMARK_INBOUND_USER / POSTMARK_INBOUND_PASS in the environment.
 *
 * In production both env vars MUST be set; otherwise we 401 fail-closed.
 * In non-production an unset secret allows requests through to ease local dev.
 */
function verifyBasicAuth(authHeader: string | null): boolean {
  const user = process.env.POSTMARK_INBOUND_USER
  const pass = process.env.POSTMARK_INBOUND_PASS
  const isProd = process.env.NODE_ENV === 'production'

  if (!user || !pass) {
    // Fail closed in production, open in dev.
    return !isProd
  }
  if (!authHeader || !authHeader.toLowerCase().startsWith('basic ')) return false

  const b64 = authHeader.slice('basic '.length).trim()
  let decoded: string
  try {
    decoded = Buffer.from(b64, 'base64').toString('utf8')
  } catch {
    return false
  }
  const idx = decoded.indexOf(':')
  if (idx < 0) return false
  const suppliedUser = decoded.slice(0, idx)
  const suppliedPass = decoded.slice(idx + 1)

  const expectedUserBuf = Buffer.from(user, 'utf8')
  const expectedPassBuf = Buffer.from(pass, 'utf8')
  const suppliedUserBuf = Buffer.from(suppliedUser, 'utf8')
  const suppliedPassBuf = Buffer.from(suppliedPass, 'utf8')

  // Equal-length precheck — timingSafeEqual throws on length mismatch.
  if (suppliedUserBuf.length !== expectedUserBuf.length) return false
  if (suppliedPassBuf.length !== expectedPassBuf.length) return false

  try {
    const okUser = crypto.timingSafeEqual(suppliedUserBuf, expectedUserBuf)
    const okPass = crypto.timingSafeEqual(suppliedPassBuf, expectedPassBuf)
    return okUser && okPass
  } catch {
    return false
  }
}

/**
 * Inspect Postmark Headers JSON for an Authentication-Results header that says
 * DKIM passed. Returns true only when an unambiguous "dkim=pass" is present.
 */
function dkimPassed(headers: PostmarkInboundPayload['Headers']): boolean {
  if (!Array.isArray(headers)) return false
  for (const h of headers) {
    const name = (h?.Name ?? '').toLowerCase()
    const value = (h?.Value ?? '').toLowerCase()
    if (name === 'authentication-results' && /\bdkim=pass\b/.test(value)) {
      return true
    }
  }
  return false
}

// POST /api/webhooks/postmark/inbound
export async function POST(req: NextRequest) {
  // Postmark requires 200 OK regardless, otherwise it will retry
  try {
    // (C8) Basic Auth — replaces the prior HMAC path that did not match
    // Postmark's documented inbound auth mechanism.
    const authHeader = req.headers.get('authorization')
    if (!verifyBasicAuth(authHeader)) {
      console.warn('[PostmarkInbound] Invalid Basic Auth — rejecting')
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const rawBody = await req.text()
    const payload = JSON.parse(rawBody) as PostmarkInboundPayload

    const fromEmail = payload.FromFull?.Email || payload.From || ''
    const fromName = payload.FromFull?.Name || ''
    const subject = payload.Subject || '(no subject)'
    const textBody = payload.TextBody || ''
    const messageId = payload.MessageID || `inbound-${Date.now()}`
    const attachments = payload.Attachments || []

    // DKIM check — only trust FromFull.Email as the uploader identity when
    // the email's DKIM signature actually verifies. Otherwise insert under a
    // shared system user so admins can review.
    const dkimOk = dkimPassed(payload.Headers)

    // Look up uploader user — prefer DKIM-verified sender, otherwise system user.
    let lookupEmail = fromEmail.toLowerCase()
    if (!dkimOk) {
      console.warn(`[PostmarkInbound] DKIM did not pass for ${fromEmail} — falling back to system user`)
      lookupEmail = SYSTEM_UNVERIFIED_EMAIL
    }

    const userRows = await db.select().from(users).where(eq(users.email, lookupEmail)).limit(1)
    const user = userRows[0]

    if (!user || !user.organizationId) {
      console.log(`[PostmarkInbound] Uploader user not found (lookupEmail=${lookupEmail}, dkimOk=${dkimOk}) — skipping`)
      return NextResponse.json({ ok: true, skipped: dkimOk ? 'unknown_sender' : 'dkim_failed_and_no_system_user' })
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
          `Submitted via email${dkimOk ? '' : ' (DKIM unverified)'}`,
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
            dkimVerified: dkimOk,
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
            dkimVerified: dkimOk,
          },
        }).returning()
        if (ev) createdEvidenceIds.push(ev.id)
      } catch (err) {
        console.error('[PostmarkInbound] Failed to create text evidence:', err)
      }
    }

    // Notify the org admins when DKIM was missing — they should triage these
    // before treating the content as trusted evidence.
    if (createdEvidenceIds.length > 0) {
      try {
        if (!dkimOk) {
          // Find admins of this org and create notifications for each.
          const admins = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.organizationId, orgId))
            .limit(20)
          for (const admin of admins) {
            await db.insert(notifications).values({
              organizationId: orgId,
              userId: admin.id,
              type: 'evidence_request',
              title: 'Inbound email evidence (DKIM unverified)',
              body: `${createdEvidenceIds.length} item(s) received from ${fromEmail} — DKIM did not pass. Please review before approving.`,
              link: '/evidence',
              metadata: { evidenceIds: createdEvidenceIds, source: 'email', dkimVerified: false },
            })
          }
        } else {
          await db.insert(notifications).values({
            organizationId: orgId,
            userId: user.id,
            type: 'evidence_request',
            title: 'Evidence received via email',
            body: `${createdEvidenceIds.length} item(s) received from ${fromEmail} — "${subject}"`,
            link: '/evidence',
            metadata: { evidenceIds: createdEvidenceIds, source: 'email', dkimVerified: true },
          })
        }
      } catch (err) {
        console.error('[PostmarkInbound] Failed to create notification:', err)
      }
    }

    return NextResponse.json({
      ok: true,
      evidenceCreated: createdEvidenceIds.length,
      evidenceIds: createdEvidenceIds,
      dkimVerified: dkimOk,
    })
  } catch (err) {
    // Always return 200 to prevent Postmark retries
    console.error('[PostmarkInbound] Unhandled error:', err)
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 200 })
  }
}
