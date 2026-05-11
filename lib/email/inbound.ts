/**
 * Postmark Inbound Email Parser
 *
 * Parses the Postmark inbound webhook payload to extract the upload token
 * (from the Reply-To address) and any file attachments.
 *
 * Inbound email format:
 *   Reply-To: evidence+{token}@inbound.compliguard.app
 */

import {
  assertAllowedFile,
  FileValidationError,
  sniffMime,
} from '@/lib/security/file-validator'

export interface InboundAttachment {
  filename: string
  mimeType: string
  content: Buffer
  size: number
}

export interface ParsedInboundEmail {
  /** The upload token extracted from the To/Reply-To address */
  token: string | null
  /** Raw email from address */
  from: string
  /** Email subject */
  subject: string
  /** Plain text body */
  textBody: string
  /** Extracted attachments */
  attachments: InboundAttachment[]
  /** Raw Postmark payload for debugging */
  rawPayload: PostmarkInboundPayload
}

export interface PostmarkInboundAttachment {
  Name: string
  Content: string // base64-encoded
  ContentType: string
  ContentLength: number
}

export interface PostmarkInboundPayload {
  From?: string
  To?: string
  ReplyTo?: string
  Subject?: string
  TextBody?: string
  HtmlBody?: string
  Attachments?: PostmarkInboundAttachment[]
  Headers?: { Name: string; Value: string }[]
  MessageID?: string
  [key: string]: unknown
}

/**
 * Extract the upload token from an email address like: evidence+abc123@inbound.example.com
 */
function extractToken(email: string): string | null {
  // Match pattern: anything+TOKEN@domain
  const match = email.match(/\+([a-zA-Z0-9_-]+)@/)
  return match ? match[1] : null
}

/**
 * Parse a Postmark inbound webhook payload and extract:
 * - The upload token from the To address (evidence+TOKEN@...)
 * - All binary attachments as Buffers
 */
export function parseInboundEmail(payload: PostmarkInboundPayload): ParsedInboundEmail {
  // Try To address first, then ReplyTo, then deduce from Headers
  const toAddress = payload.To || ''
  const replyToAddress = payload.ReplyTo || ''

  let token: string | null = extractToken(toAddress)
  if (!token) {
    token = extractToken(replyToAddress)
  }

  // Parse attachments
  const attachments: InboundAttachment[] = (payload.Attachments || []).map((att) => ({
    filename: att.Name,
    mimeType: att.ContentType,
    content: Buffer.from(att.Content, 'base64'),
    size: att.ContentLength,
  }))

  return {
    token,
    from: payload.From || '',
    subject: payload.Subject || '',
    textBody: payload.TextBody || '',
    attachments,
    rawPayload: payload,
  }
}

/**
 * Allowed MIME types for evidence attachments.
 * Reject unknown types to prevent malicious uploads.
 */
export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'video/mp4',
  'video/quicktime',
]

export const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

/**
 * Validate an attachment by sniffing its actual MIME type from the file
 * bytes (the declared Postmark ContentType is attacker-controlled) and
 * enforcing the allowlist + size cap.
 *
 * Returns the canonical sniffed MIME on success so callers can persist that
 * instead of the declared one.
 */
export async function validateAttachment(
  att: InboundAttachment,
): Promise<{ valid: true; mime: string } | { valid: false; reason: string }> {
  if (att.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      valid: false,
      reason: `File too large: ${att.size} bytes (max ${MAX_ATTACHMENT_SIZE_BYTES})`,
    }
  }

  try {
    const result = await assertAllowedFile(att.content, att.mimeType, ALLOWED_MIME_TYPES)
    return { valid: true, mime: result.mime }
  } catch (err) {
    if (err instanceof FileValidationError) {
      return { valid: false, reason: err.message }
    }
    return { valid: false, reason: 'Attachment rejected' }
  }
}

/**
 * Detect the MIME type of an attachment from its bytes.  Exposed for callers
 * that want the sniffed MIME without the full allowlist enforcement.
 */
export async function detectAttachmentMime(
  att: InboundAttachment,
): Promise<string | null> {
  const result = await sniffMime(att.content)
  return result.mime
}
