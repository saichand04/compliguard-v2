import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { encrypt, decrypt } from '@/lib/encryption'
import { eq, and } from 'drizzle-orm'

interface AzureCredentials {
  tenantId: string
  clientId: string
  clientSecret: string
  subscriptionId: string
}

// GET /api/integrations/azure — Get Azure integration for this org
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
          eq(integrations.type, 'azure'),
        ),
      )
      .limit(1)

    const integration = rows[0]
    if (!integration) return NextResponse.json({ integration: null })

    let credentials: Partial<AzureCredentials> = {}
    if (integration.encryptedCredentials) {
      try {
        const raw = decrypt(integration.encryptedCredentials)
        const parsed = JSON.parse(raw) as AzureCredentials
        credentials = {
          tenantId: parsed.tenantId,
          clientId: parsed.clientId,
          subscriptionId: parsed.subscriptionId,
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
        credentials,
      },
    })
  } catch (e) {
    console.error('GET /api/integrations/azure error:', e)
    return ApiErrors.internal()
  }
}

// POST /api/integrations/azure — Create or update Azure integration
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const orgId: string = session.orgId

  let body: { tenantId?: string; clientId?: string; clientSecret?: string; subscriptionId?: string; name?: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const { tenantId, clientId, clientSecret, subscriptionId, name } = body

  if (!tenantId || !clientId || !clientSecret || !subscriptionId) {
    return ApiErrors.badRequest('tenantId, clientId, clientSecret, and subscriptionId are required')
  }

  const credentials: AzureCredentials = { tenantId, clientId, clientSecret, subscriptionId }
  const encryptedCredentials = encrypt(JSON.stringify(credentials))

  try {
    const existing = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.organizationId, orgId),
          eq(integrations.type, 'azure'),
        ),
      )
      .limit(1)

    if (existing[0]) {
      await db
        .update(integrations)
        .set({
          name: name ?? 'Azure',
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
          type: 'azure',
          name: name ?? 'Azure',
          status: 'inactive',
          encryptedCredentials,
          configuredBy: session.userId,
        })
        .returning({ id: integrations.id })

      return NextResponse.json({ success: true, id: created[0]?.id, updated: false }, { status: 201 })
    }
  } catch (e) {
    console.error('POST /api/integrations/azure error:', e)
    return ApiErrors.internal()
  }
}

// DELETE /api/integrations/azure — Remove Azure integration
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
          eq(integrations.type, 'azure'),
        ),
      )
      .limit(1)

    if (!existing[0]) return ApiErrors.notFound('Azure integration')

    await db.delete(integrations).where(eq(integrations.id, existing[0].id))

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/integrations/azure error:', e)
    return ApiErrors.internal()
  }
}
