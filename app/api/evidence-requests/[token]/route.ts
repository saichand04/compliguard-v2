import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evidenceRequests, evidence, organizations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getStorageProvider, generateStorageKey } from '@/lib/storage'
import crypto from 'crypto'
import { authLimiter, checkRateLimit } from '@/lib/rate-limiter'
import { ALLOWED_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES } from '@/lib/email/inbound'
import {
  assertAllowedFile,
  FileValidationError,
  sanitizeFilename,
} from '@/lib/security/file-validator'

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

// GET /api/evidence-requests/[token] — validate token and return request details
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const rows = await db
    .select()
    .from(evidenceRequests)
    .where(eq(evidenceRequests.token, token))
    .limit(1)

  const request = rows[0]

  if (!request) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  if (request.isUsed) {
    return NextResponse.json({ error: 'This upload link has already been used', used: true }, { status: 410 })
  }

  if (new Date() > request.expiresAt) {
    return NextResponse.json({ error: 'This upload link has expired', expired: true }, { status: 410 })
  }

  // Fetch org name for display
  const orgRows = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, request.organizationId))
    .limit(1)

  const orgName = orgRows[0]?.name || 'CompliGuard'

  return NextResponse.json({
    id: request.id,
    title: request.title,
    description: request.description,
    recipientName: request.recipientName,
    orgName,
    expiresAt: request.expiresAt,
    controlId: request.controlId,
  })
}

// POST /api/evidence-requests/[token] — accept file upload, create evidence, mark token used
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  // Per-IP rate limit so attackers cannot fuzz tokens or replay uploads.
  const ip = clientIp(req)
  try {
    await checkRateLimit(authLimiter, `ev-req-${ip}`)
  } catch {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const rows = await db
    .select()
    .from(evidenceRequests)
    .where(eq(evidenceRequests.token, token))
    .limit(1)

  const request = rows[0]

  if (!request) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  if (request.isUsed) {
    return NextResponse.json({ error: 'This upload link has already been used' }, { status: 410 })
  }

  if (new Date() > request.expiresAt) {
    return NextResponse.json({ error: 'This upload link has expired' }, { status: 410 })
  }

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 })
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  let sniffedMime: string
  try {
    const result = await assertAllowedFile(fileBuffer, file.type, ALLOWED_MIME_TYPES)
    sniffedMime = result.mime
  } catch (err) {
    if (err instanceof FileValidationError) {
      // Trace token-based upload rejections for incident response.
      console.warn(
        `[EvidenceRequest Upload] rejected requestId=${request.id} ip=${ip} reason=${err.message}`,
      )
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'File rejected' }, { status: 400 })
  }

  const safeName = sanitizeFilename(file.name)
  const fileUuid = crypto.randomUUID()
  const storageKey = generateStorageKey(request.organizationId, safeName, fileUuid)
  const storage = getStorageProvider()

  // One-line traceable log entry per token upload.
  console.info(
    `[EvidenceRequest Upload] accept requestId=${request.id} ip=${ip} key=${storageKey} mime=${sniffedMime} size=${fileBuffer.length}`,
  )

  let uploadResult
  try {
    uploadResult = await storage.upload(fileBuffer, storageKey, sniffedMime, request.organizationId)
  } catch (err) {
    console.error('[EvidenceRequest Upload] Storage error:', err)
    return NextResponse.json({ error: 'File upload failed. Please try again.' }, { status: 500 })
  }

  // Create evidence record
  const [ev] = await db.insert(evidence).values({
    organizationId: request.organizationId,
    controlAssignmentId: null,
    title: request.title,
    description: request.description || `Uploaded via evidence request link`,
    evidenceType: 'document',
    storageProvider: uploadResult.provider,
    storageKey: uploadResult.key,
    storageBucket: uploadResult.bucket,
    fileName: safeName,
    fileSize: fileBuffer.length,
    mimeType: sniffedMime,
    status: 'pending',
    metadata: {
      source: 'evidence_request',
      requestId: request.id,
      recipientEmail: request.recipientEmail,
      token,
    },
  }).returning()

  // Mark token as used
  await db.update(evidenceRequests).set({
    isUsed: true,
    usedAt: new Date(),
    evidenceId: ev.id,
  }).where(eq(evidenceRequests.id, request.id))

  return NextResponse.json({
    ok: true,
    evidenceId: ev.id,
    message: 'Evidence submitted successfully',
  })
}
