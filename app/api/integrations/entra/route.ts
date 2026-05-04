import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { encrypt, decrypt } from '@/lib/encryption'
import { eq, and } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  try {
    const rows = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.organizationId, session.orgId),
          eq(integrations.type, 'azure')
        )
      )
      .orderBy(integrations.createdAt)

    const safe = rows.map((r) => ({
      ...r,
      encryptedCredentials: undefined,
      hasCredentials: !!r.encryptedCredentials,
    }))

    return NextResponse.json({ integrations: safe })
  } catch (err) {
    console.error('[entra/GET]', err)
    return ApiErrors.internal()
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  try {
    const body = (await req.json()) as {
      name?: string
      tenantId: string
      clientId: string
      clientSecret: string
    }

    if (!body.tenantId || !body.clientId || !body.clientSecret) {
      return ApiErrors.badRequest('tenantId, clientId, and clientSecret are required')
    }

    const credentials = JSON.stringify({
      tenantId: body.tenantId,
      clientId: body.clientId,
      clientSecret: body.clientSecret,
    })

    // Upsert: try insert, on conflict update
    const existing = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.organizationId, session.orgId), eq(integrations.type, 'azure')))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(integrations)
        .set({
          name: body.name ?? 'Entra ID',
          config: { tenantId: body.tenantId, clientId: body.clientId },
          encryptedCredentials: encrypt(credentials),
          status: 'pending',
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing[0].id))
    } else {
      await db.insert(integrations).values({
        organizationId: session.orgId,
        type: 'azure',
        name: body.name ?? 'Entra ID',
        status: 'pending',
        config: { tenantId: body.tenantId, clientId: body.clientId },
        encryptedCredentials: encrypt(credentials),
        configuredBy: session.userId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[entra/POST]', err)
    return ApiErrors.internal()
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return ApiErrors.badRequest('id is required')

    await db
      .delete(integrations)
      .where(
        and(
          eq(integrations.id, id),
          eq(integrations.organizationId, session.orgId)
        )
      )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[entra/DELETE]', err)
    return ApiErrors.internal()
  }
}

export { decrypt }
