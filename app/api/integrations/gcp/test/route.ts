import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { integrations } from '@/lib/db/schema'
import { decrypt } from '@/lib/encryption'
import { GCPConfig } from '@/lib/integrations/gcp'
import { eq, and } from 'drizzle-orm'

interface ServiceAccountKey {
  type?: string
  project_id?: string
  private_key_id?: string
  private_key?: string
  client_email?: string
  client_id?: string
}

async function getGCPTestToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as ServiceAccountKey
  if (!sa.client_email || !sa.private_key) {
    throw new Error('Service account JSON must contain client_email and private_key')
  }

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  }
  const header = { alg: 'RS256', typ: 'JWT' }

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url')
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signingInput = `${headerB64}.${payloadB64}`

  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const keyBytes = Buffer.from(pemBody, 'base64')

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, Buffer.from(signingInput).buffer as ArrayBuffer)
  const jwt = `${signingInput}.${Buffer.from(signature).toString('base64url')}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    throw new Error(`Token request failed ${tokenRes.status}: ${text.slice(0, 300)}`)
  }

  const data = await tokenRes.json() as { access_token?: string; error?: string }
  if (!data.access_token) throw new Error(`No access token: ${data.error}`)
  return data.access_token
}

// POST /api/integrations/gcp/test — Test GCP connection
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const orgId: string = session.orgId

  let config: GCPConfig | undefined

  try {
    const body = await req.json() as Partial<GCPConfig>
    if (body.serviceAccountJson && body.projectId) {
      config = body as GCPConfig
    }
  } catch {
    // No body — use stored credentials
  }

  if (!config) {
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
    if (!integration?.encryptedCredentials) {
      return ApiErrors.badRequest('No GCP credentials provided or stored')
    }

    try {
      const raw = decrypt(integration.encryptedCredentials)
      config = JSON.parse(raw) as GCPConfig
    } catch (e) {
      return ApiErrors.internal(`Failed to decrypt credentials: ${String(e)}`)
    }
  }

  const gcpConfig = config

  try {
    const token = await getGCPTestToken(gcpConfig.serviceAccountJson)

    const projectRes = await fetch(
      `https://cloudresourcemanager.googleapis.com/v1/projects/${gcpConfig.projectId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!projectRes.ok) {
      const errText = await projectRes.text()
      return NextResponse.json(
        {
          success: false,
          error: `Project access failed (${projectRes.status}): ${errText.slice(0, 300)}`,
        },
        { status: 400 },
      )
    }

    const projectData = await projectRes.json() as {
      projectId?: string
      name?: string
      projectNumber?: string
      lifecycleState?: string
    }

    return NextResponse.json({
      success: true,
      message: 'GCP connection successful',
      project: {
        projectId: projectData.projectId,
        name: projectData.name,
        projectNumber: projectData.projectNumber,
        lifecycleState: projectData.lifecycleState,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: `Connection test failed: ${String(e)}` },
      { status: 500 },
    )
  }
}
