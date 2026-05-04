import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { encrypt, decrypt } from '@/lib/encryption'
import { getComplianceManagerScore } from '@/lib/microsoft/compliance-manager'

// ─── GET — fetch Compliance Manager data ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!
  if (!orgId) return ApiErrors.forbidden()

  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, 'azure')
      )
    )
    .limit(1)

  if (!row) {
    return NextResponse.json({ configured: false })
  }

  const config = row.config as Record<string, unknown> | null

  // Return config without secrets
  return NextResponse.json({
    configured: true,
    status: row.status,
    lastSyncAt: row.lastSyncAt,
    tenantId: config?.tenantId ?? null,
    name: row.name,
    id: row.id,
  })
}

// ─── POST — configure Compliance Manager (uses Azure integration) ──────────────

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!
  if (!orgId) return ApiErrors.forbidden()

  const body = (await req.json()) as {
    tenantId?: string
    clientId?: string
    clientSecret?: string
    name?: string
  }

  const { tenantId, clientId, clientSecret, name } = body

  if (!tenantId || !clientId || !clientSecret) {
    return ApiErrors.badRequest('tenantId, clientId, and clientSecret are required')
  }

  const credentials = { clientId, clientSecret }
  const encryptedCredentials = encrypt(JSON.stringify(credentials))

  const [existing] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, 'azure')
      )
    )
    .limit(1)

  if (existing) {
    await db
      .update(integrations)
      .set({
        name: name ?? 'Microsoft Compliance Manager',
        status: 'active',
        config: { tenantId } as Record<string, unknown>,
        encryptedCredentials,
        updatedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(integrations.id, existing.id))

    return NextResponse.json({ id: existing.id, configured: true })
  }

  const [inserted] = await db
    .insert(integrations)
    .values({
      organizationId: orgId,
      type: 'azure',
      name: name ?? 'Microsoft Compliance Manager',
      status: 'active',
      config: { tenantId } as Record<string, unknown>,
      encryptedCredentials,
    })
    .returning({ id: integrations.id })

  return NextResponse.json({ id: inserted.id, configured: true }, { status: 201 })
}

// ─── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId!
  if (!orgId) return ApiErrors.forbidden()

  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, 'azure')
      )
    )

  return NextResponse.json({ deleted: true })
}
