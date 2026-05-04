import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpenClawInstance {
  id: string
  name: string
  url: string
  registeredAt: string
  lastPingAt: string | null
}

type ExtraConfig = {
  openclawInstances?: OpenClawInstance[]
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSettings() {
  const [row] = await db.select().from(systemSettings).limit(1)
  return row ?? null
}

async function getInstances(): Promise<OpenClawInstance[]> {
  const settings = await getSettings()
  if (!settings) return []
  const extra = (settings.extraConfig ?? {}) as ExtraConfig
  return extra.openclawInstances ?? []
}

async function saveInstances(instances: OpenClawInstance[]): Promise<void> {
  const [current] = await db.select().from(systemSettings).limit(1)
  if (!current) return
  const extra = ((current.extraConfig ?? {}) as ExtraConfig)
  extra.openclawInstances = instances
  await db
    .update(systemSettings)
    .set({ extraConfig: extra, updatedAt: new Date() })
}

// ---------------------------------------------------------------------------
// GET — list registered OpenClaw instances (admin only)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'admin') return ApiErrors.forbidden()

  const instances = await getInstances()
  return NextResponse.json({ instances })
}

// ---------------------------------------------------------------------------
// POST — register a new OpenClaw instance (admin only)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'admin') return ApiErrors.forbidden()

  let body: { instanceUrl?: string; instanceName?: string; apiKey?: string }
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const { instanceUrl, instanceName } = body

  if (!instanceUrl || typeof instanceUrl !== 'string') {
    return ApiErrors.badRequest('instanceUrl is required')
  }
  if (!instanceName || typeof instanceName !== 'string') {
    return ApiErrors.badRequest('instanceName is required')
  }

  // Validate URL format
  try {
    new URL(instanceUrl)
  } catch {
    return ApiErrors.badRequest('instanceUrl must be a valid URL')
  }

  const instances = await getInstances()

  const newInstance: OpenClawInstance = {
    id: randomUUID(),
    name: instanceName.trim(),
    url: instanceUrl.trim(),
    registeredAt: new Date().toISOString(),
    lastPingAt: null,
  }

  instances.push(newInstance)
  await saveInstances(instances)

  return NextResponse.json({ registered: true, instanceId: newInstance.id }, { status: 201 })
}

// ---------------------------------------------------------------------------
// DELETE — remove instance by ?instanceId= (admin only)
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'admin') return ApiErrors.forbidden()

  const instanceId = req.nextUrl.searchParams.get('instanceId')
  if (!instanceId) return ApiErrors.badRequest('instanceId query parameter is required')

  const instances = await getInstances()
  const filtered = instances.filter(i => i.id !== instanceId)

  if (filtered.length === instances.length) {
    return ApiErrors.notFound('Instance')
  }

  await saveInstances(filtered)
  return NextResponse.json({ deleted: true })
}
