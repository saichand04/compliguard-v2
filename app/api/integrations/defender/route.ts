/**
 * app/api/integrations/defender/route.ts
 * GET + POST + DELETE for Defender for Cloud / XDR integration config.
 * Stored as type='azure' with name='Microsoft Defender for Cloud'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { encrypt, decrypt } from '@/lib/encryption'

const INTEGRATION_NAME = 'Microsoft Defender for Cloud'
const INTEGRATION_SUBTYPE = 'defender'

type IntegrationType = 'azure'
const INTEGRATION_TYPE: IntegrationType = 'azure'

async function getDefenderRow(orgId: string) {
  const rows = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, INTEGRATION_TYPE),
      ),
    )
  // Filter by subType in config since we share 'azure' type
  return rows.find((r) => (r.config as Record<string, unknown>)?.subType === INTEGRATION_SUBTYPE) ?? null
}

// GET /api/integrations/defender
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const row = await getDefenderRow(session.orgId!)
  if (!row) return NextResponse.json({ connected: false })

  const cfg = (row.config as Record<string, unknown>) ?? {}

  return NextResponse.json({
    connected: row.status === 'active',
    status: row.status,
    lastSyncAt: row.lastSyncAt,
    tenantId: cfg.tenantId ?? '',
    clientId: cfg.clientId ?? '',
    subscriptionId: cfg.subscriptionId ?? '',
    // clientSecret never returned
  })
}

// POST /api/integrations/defender
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  const body = await req.json() as {
    tenantId?: string
    clientId?: string
    clientSecret?: string
    subscriptionId?: string
  }

  if (!body.tenantId || !body.clientId || !body.clientSecret || !body.subscriptionId) {
    return ApiErrors.badRequest('tenantId, clientId, clientSecret, and subscriptionId are required')
  }

  const publicConfig: Record<string, unknown> = {
    subType: INTEGRATION_SUBTYPE,
    tenantId: body.tenantId,
    clientId: body.clientId,
    subscriptionId: body.subscriptionId,
  }

  const encryptedCredentials = encrypt(JSON.stringify({ clientSecret: body.clientSecret }))

  const existing = await getDefenderRow(session.orgId!)

  if (existing) {
    await db.update(integrations).set({
      name: INTEGRATION_NAME,
      status: 'active',
      config: publicConfig,
      encryptedCredentials,
      updatedAt: new Date(),
      errorMessage: null,
    }).where(eq(integrations.id, existing.id))
  } else {
    await db.insert(integrations).values({
      organizationId: session.orgId!,
      type: INTEGRATION_TYPE,
      name: INTEGRATION_NAME,
      status: 'active',
      config: publicConfig,
      encryptedCredentials,
    })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/integrations/defender
export async function DELETE(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!['super_admin', 'admin'].includes(session.role)) return ApiErrors.forbidden()

  const row = await getDefenderRow(session.orgId!)
  if (row) {
    await db.delete(integrations).where(eq(integrations.id, row.id))
  }

  return NextResponse.json({ ok: true })
}

// Helper: get decrypted defender config
export async function getDefenderConfig(orgId: string): Promise<{
  tenantId: string
  clientId: string
  clientSecret: string
  subscriptionId: string
} | null> {
  const row = await getDefenderRow(orgId)
  if (!row) return null

  const cfg = (row.config as Record<string, unknown>) ?? {}
  let clientSecret = ''
  if (row.encryptedCredentials) {
    try {
      const dec = decrypt(row.encryptedCredentials)
      const parsed = JSON.parse(dec) as { clientSecret?: string }
      clientSecret = parsed.clientSecret ?? ''
    } catch {
      return null
    }
  }

  return {
    tenantId: String(cfg.tenantId ?? ''),
    clientId: String(cfg.clientId ?? ''),
    clientSecret,
    subscriptionId: String(cfg.subscriptionId ?? ''),
  }
}
