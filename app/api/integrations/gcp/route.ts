import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { encrypt, decrypt } from '@/lib/encryption'
import { eq, and } from 'drizzle-orm'

interface GCPCredentials {
  serviceAccountJson: string
  projectId: string
}

// GET /api/integrations/gcp — Get GCP integration for this org
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const orgId: string = session.orgId

  try {
    const rows = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.organizationId, orgId),
          eq(integrations.type, 'gcp'),
        ),
      )
      .limit(1)

    const integration = rows[0]
    if (!integration) return NextResponse.json({ integration: null })

    let projectId: string | undefined
    let serviceAccountEmail: string | undefined

    if (integration.encryptedCredentials) {
      try {
        const raw = decrypt(integration.encryptedCredentials)
        const parsed = JSON.parse(raw) as GCPCredentials
        projectId = parsed.projectId
        try {
          const saJson = JSON.parse(parsed.serviceAccountJson) as { client_email?: string }
          serviceAccountEmail = saJson.client_email
        } catch {
          // ignore
        }
      } catch {
        // ignore decryption errors
      }
    }

    return NextResponse.json({
      integration: {
        id: integration.id,
        name: integration.name,
        status: integration.status,
        lastSyncAt: integration.lastSyncAt,
        errorMessage: integration.errorMessage,
        createdAt: integration.createdAt,
        projectId,
        serviceAccountEmail,
      },
    })
  } catch (e) {
    console.error('GET /api/integrations/gcp error:', e)
    return ApiErrors.internal()
  }
}

// POST /api/integrations/gcp — Create or update GCP integration
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const orgId: string = session.orgId

  let body: { serviceAccountJson?: string; projectId?: string; name?: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const { serviceAccountJson, projectId, name } = body

  if (!serviceAccountJson || !projectId) {
    return ApiErrors.badRequest('serviceAccountJson and projectId are required')
  }

  try {
    const parsed = JSON.parse(serviceAccountJson) as Record<string, unknown>
    if (!parsed.private_key || !parsed.client_email) {
      return ApiErrors.badRequest('serviceAccountJson must contain private_key and client_email fields')
    }
  } catch {
    return ApiErrors.badRequest('serviceAccountJson must be valid JSON')
  }

  const credentials: GCPCredentials = { serviceAccountJson, projectId }
  const encryptedCredentials = encrypt(JSON.stringify(credentials))

  try {
    const existing = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.organizationId, orgId),
          eq(integrations.type, 'gcp'),
        ),
      )
      .limit(1)

    if (existing[0]) {
      await db
        .update(integrations)
        .set({
          name: name ?? 'Google Cloud Platform',
          encryptedCredentials,
          status: 'inactive',
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing[0].id))

      return NextResponse.json({ success: true, id: existing[0].id, updated: true })
    } else {
      const created = await db
        .insert(integrations)
        .values({
          organizationId: orgId,
          type: 'gcp',
          name: name ?? 'Google Cloud Platform',
          status: 'inactive',
          encryptedCredentials,
          configuredBy: session.userId,
        })
        .returning({ id: integrations.id })

      return NextResponse.json({ success: true, id: created[0]?.id, updated: false }, { status: 201 })
    }
  } catch (e) {
    console.error('POST /api/integrations/gcp error:', e)
    return ApiErrors.internal()
  }
}

// DELETE /api/integrations/gcp — Remove GCP integration
export async function DELETE(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const orgId: string = session.orgId

  try {
    const existing = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.organizationId, orgId),
          eq(integrations.type, 'gcp'),
        ),
      )
      .limit(1)

    if (!existing[0]) return ApiErrors.notFound('GCP integration')

    await db.delete(integrations).where(eq(integrations.id, existing[0].id))

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/integrations/gcp error:', e)
    return ApiErrors.internal()
  }
}
