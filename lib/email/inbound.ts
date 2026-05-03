/**
 * Postmark Inbound Email Parser
 * 
 * Parses the Postmark inbound webhook payload to extract the upload token
 * (from the Reply-To address) and any file attachments.
 * 
 * Inbound email format:
 *   Reply-To: evidence+{token}@inbound.compliguard.app
 */

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
 * Validate an attachment by MIME type and size.
 */
export function validateAttachment(att: InboundAttachment): { valid: boolean; reason?: string } {
  if (!ALLOWED_MIME_TYPES.includes(att.mimeType)) {
    return { valid: false, reason: `File type not allowed: ${att.mimeType}` }
  }
  if (att.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return { valid: false, reason: `File too large: ${att.size} bytes (max ${MAX_ATTACHMENT_SIZE_BYTES})` }
  }
  return { valid: true }
}
