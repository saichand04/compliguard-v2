import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'

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
// POST — update lastPingAt for an OpenClaw instance (no session auth)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: { instanceId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { instanceId } = body
  if (!instanceId || typeof instanceId !== 'string') {
    return NextResponse.json({ error: 'instanceId is required' }, { status: 400 })
  }

  // Load settings
  const [settings] = await db.select().from(systemSettings).limit(1)
  if (!settings) {
    return NextResponse.json({ error: 'System not initialised' }, { status: 503 })
  }

  const extra = ((settings.extraConfig ?? {}) as ExtraConfig)
  const instances: OpenClawInstance[] = extra.openclawInstances ?? []

  const idx = instances.findIndex(i => i.id === instanceId)
  if (idx === -1) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 })
  }

  instances[idx].lastPingAt = new Date().toISOString()
  extra.openclawInstances = instances

  await db
    .update(systemSettings)
    .set({ extraConfig: extra, updatedAt: new Date() })

  return NextResponse.json({ ok: true, serverTime: new Date().toISOString() })
}
