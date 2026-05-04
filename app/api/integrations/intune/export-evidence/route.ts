import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { evidence } from '@/lib/db/schema'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const orgId = session.orgId

  try {
    const body = (await req.json()) as {
      scanId?: string
      category?: string
      summary?: Record<string, unknown>
      results?: unknown[]
      title?: string
    }

    const title = body.title ?? `Intune Compliance Scan — ${new Date().toISOString().split('T')[0]}`
    const description = body.category
      ? `Intune scan evidence for category: ${body.category}`
      : 'Full Intune compliance scan export'

    const textContent = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        scanId: body.scanId,
        category: body.category,
        summary: body.summary,
        results: body.results,
      },
      null,
      2
    )

    const [record] = await db
      .insert(evidence)
      .values({
        organizationId: orgId,
        title,
        description,
        evidenceType: 'automated',
        status: 'pending',
        textContent,
        fileName: `intune-scan-${Date.now()}.json`,
        mimeType: 'application/json',
        fileSize: Buffer.byteLength(textContent, 'utf8'),
        uploadedBy: session.userId,
        metadata: {
          source: 'intune_scan',
          scanId: body.scanId,
          category: body.category,
          exportedAt: new Date().toISOString(),
        } as unknown as Record<string, unknown>,
      })
      .returning()

    return NextResponse.json({ success: true, evidenceId: record?.id, title })
  } catch (err) {
    console.error('[intune/export-evidence/POST]', err)
    return ApiErrors.internal()
  }
}
