import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { encrypt, decrypt } from '@/lib/encryption'

// systemSettings stores AI config in the dedicated columns:
//   aiProvider (text), aiModel (text), extraConfig (jsonb)
// Sensitive keys (apiKey, ollamaEndpoint) go into extraConfig as encrypted strings.

// ─── GET: load current AI config (keys masked) ────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  try {
    const rows = await db.select().from(systemSettings).limit(1)
    const row = rows[0]

    if (!row) return NextResponse.json({ provider: 'openai', model: 'gpt-4o-mini' })

    const extra = (row.extraConfig ?? {}) as Record<string, string>

    let apiKeyConfigured = false
    if (extra.encryptedApiKey) {
      try { decrypt(extra.encryptedApiKey); apiKeyConfigured = true } catch { /* bad key */ }
    }

    return NextResponse.json({
      provider:         row.aiProvider ?? 'openai',
      model:            row.aiModel ?? 'gpt-4o-mini',
      apiKeyConfigured,
      ollamaEndpoint:   extra.ollamaEndpoint ?? 'http://localhost:11434',
    })
  } catch (err) {
    console.error('[GET /api/settings/ai]', err)
    return NextResponse.json({ error: 'Failed to load AI config' }, { status: 500 })
  }
}

// ─── POST: save AI config ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  try {
    const body = await request.json() as {
      provider: string
      apiKey?: string
      model: string
      ollamaEndpoint?: string
    }

    // Load existing extraConfig to preserve other entries (e.g. storage settings)
    const rows = await db.select().from(systemSettings).limit(1)
    const existing = rows[0]
    const prevExtra = (existing?.extraConfig ?? {}) as Record<string, string>

    const newExtra: Record<string, string> = { ...prevExtra }

    if (body.apiKey) {
      newExtra.encryptedApiKey = encrypt(body.apiKey)
    }
    // Preserve old key if no new one sent (don't overwrite with empty)

    if (body.ollamaEndpoint) {
      newExtra.ollamaEndpoint = body.ollamaEndpoint
    }

    if (existing) {
      await db
        .update(systemSettings)
        .set({
          aiProvider:  body.provider,
          aiModel:     body.model,
          extraConfig: newExtra,
          updatedAt:   new Date(),
        })
    } else {
      await db.insert(systemSettings).values({
        aiProvider:  body.provider,
        aiModel:     body.model,
        extraConfig: newExtra,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/settings/ai]', err)
    return NextResponse.json({ error: 'Failed to save AI config' }, { status: 500 })
  }
}

// ─── Helper: get decrypted AI config for internal server-side use ─────────────
export async function getAiConfig(): Promise<{
  provider: string
  model: string
  apiKey: string
  ollamaEndpoint: string
}> {
  const defaults = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: '',
    ollamaEndpoint: 'http://localhost:11434',
  }

  try {
    const rows = await db.select().from(systemSettings).limit(1)
    const row = rows[0]
    if (!row) return defaults

    const extra = (row.extraConfig ?? {}) as Record<string, string>
    let apiKey = ''
    if (extra.encryptedApiKey) {
      try { apiKey = decrypt(extra.encryptedApiKey) } catch { /* ignore */ }
    }

    return {
      provider:       row.aiProvider ?? 'openai',
      model:          row.aiModel ?? 'gpt-4o-mini',
      apiKey,
      ollamaEndpoint: extra.ollamaEndpoint ?? 'http://localhost:11434',
    }
  } catch {
    return defaults
  }
}
