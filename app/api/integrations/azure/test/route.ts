import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { decrypt } from '@/lib/encryption'
import { AzureConfig } from '@/lib/integrations/azure'
import { eq, and } from 'drizzle-orm'

// POST /api/integrations/azure/test — Test Azure connection
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const orgId: string = session.orgId

  let config: AzureConfig | undefined

  try {
    const body = await req.json() as Partial<AzureConfig>
    if (body.tenantId && body.clientId && body.clientSecret && body.subscriptionId) {
      config = body as AzureConfig
    }
  } catch {
    // No body or invalid body — use stored credentials
  }

  if (!config) {
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
    if (!integration?.encryptedCredentials) {
      return ApiErrors.badRequest('No Azure credentials provided or stored')
    }

    try {
      const raw = decrypt(integration.encryptedCredentials)
      config = JSON.parse(raw) as AzureConfig
    } catch (e) {
      return ApiErrors.internal(`Failed to decrypt credentials: ${String(e)}`)
    }
  }

  const azureConfig = config

  try {
    // Step 1: Get ARM token
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${azureConfig.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: azureConfig.clientId,
          client_secret: azureConfig.clientSecret,
          scope: 'https://management.azure.com/.default',
        }).toString(),
      },
    )

    if (!tokenRes.ok) {
      const err = await tokenRes.json() as { error_description?: string }
      return NextResponse.json(
        { success: false, error: `Authentication failed: ${err.error_description ?? tokenRes.statusText}` },
        { status: 400 },
      )
    }

    const tokenData = await tokenRes.json() as { access_token?: string }
    if (!tokenData.access_token) {
      return NextResponse.json(
        { success: false, error: 'No access token returned from Azure' },
        { status: 400 },
      )
    }

    // Step 2: List resource groups to verify subscription access
    const rgRes = await fetch(
      `https://management.azure.com/subscriptions/${azureConfig.subscriptionId}/resourcegroups?api-version=2021-04-01&$top=5`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!rgRes.ok) {
      const errText = await rgRes.text()
      return NextResponse.json(
        {
          success: false,
          error: `Subscription access failed (${rgRes.status}): ${errText.slice(0, 200)}`,
        },
        { status: 400 },
      )
    }

    const rgData = await rgRes.json() as { value?: Array<{ name: string; location: string }> }
    const resourceGroups = (rgData.value ?? []).map((rg) => ({ name: rg.name, location: rg.location }))

    return NextResponse.json({
      success: true,
      message: 'Azure connection successful',
      subscriptionId: azureConfig.subscriptionId,
      resourceGroupCount: resourceGroups.length,
      resourceGroups,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: `Connection test failed: ${String(e)}` },
      { status: 500 },
    )
  }
}
