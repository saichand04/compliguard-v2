import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

// ─── POST: test AI provider connection ────────────────────────────────────────
export async function POST(request: NextRequest) {
  const session = await requireAuth(request)
  if (!session) return ApiErrors.unauthorized()

  const body = await request.json() as {
    provider: string
    apiKey?: string
    model: string
    ollamaEndpoint?: string
  }

  const { provider, apiKey, model, ollamaEndpoint = 'http://localhost:11434' } = body

  try {
    switch (provider) {

      // ── OpenAI ────────────────────────────────────────────────────────────────
      case 'openai': {
        if (!apiKey) return NextResponse.json({ ok: false, message: 'API key is required for OpenAI.' })
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
            max_tokens: 10,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
          return NextResponse.json({ ok: false, message: `OpenAI error: ${err?.error?.message ?? res.statusText}` })
        }
        return NextResponse.json({ ok: true, message: `Connected to OpenAI (${model}) successfully.` })
      }

      // ── Google Gemini ──────────────────────────────────────────────────────────
      case 'gemini': {
        if (!apiKey) return NextResponse.json({ ok: false, message: 'API key is required for Gemini.' })
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with: OK' }] }] }),
          }
        )
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
          return NextResponse.json({ ok: false, message: `Gemini error: ${err?.error?.message ?? res.statusText}` })
        }
        return NextResponse.json({ ok: true, message: `Connected to Google Gemini (${model}) successfully.` })
      }

      // ── Anthropic Claude ───────────────────────────────────────────────────────
      case 'claude': {
        if (!apiKey) return NextResponse.json({ ok: false, message: 'API key is required for Claude.' })
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 20,
            messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
          return NextResponse.json({ ok: false, message: `Claude error: ${err?.error?.message ?? res.statusText}` })
        }
        return NextResponse.json({ ok: true, message: `Connected to Anthropic Claude (${model}) successfully.` })
      }

      // ── Ollama (local) ────────────────────────────────────────────────────────
      case 'ollama': {
        // Step 1: reachability check
        let tagsRes: Response | null = null
        try {
          tagsRes = await fetch(`${ollamaEndpoint}/api/tags`, { signal: AbortSignal.timeout(5000) })
        } catch {
          return NextResponse.json({
            ok: false,
            message: `Cannot reach Ollama at ${ollamaEndpoint}. Ensure Ollama is running and accessible.`,
          })
        }

        if (!tagsRes.ok) {
          return NextResponse.json({
            ok: false,
            message: `Ollama returned ${tagsRes.status} — check the endpoint URL.`,
          })
        }

        const tagsData = await tagsRes.json() as { models?: { name: string }[] }
        const pulled = (tagsData.models ?? []).map((m) => m.name)
        const modelPulled = pulled.some(n => n.startsWith(model.split(':')[0]))

        if (!modelPulled) {
          const available = pulled.slice(0, 5).join(', ') || 'none'
          return NextResponse.json({
            ok: false,
            message: `Ollama is reachable but "${model}" is not pulled. Run: ollama pull ${model}. Available: ${available}.`,
          })
        }

        // Step 2: quick generate to confirm the model works
        let genRes: Response | null = null
        try {
          genRes = await fetch(`${ollamaEndpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt: 'Say OK', stream: false }),
            signal: AbortSignal.timeout(20000),
          })
        } catch {
          return NextResponse.json({ ok: false, message: `Ollama generate timed out for model "${model}".` })
        }

        if (!genRes.ok) {
          return NextResponse.json({ ok: false, message: `Ollama model "${model}" returned error ${genRes.status}.` })
        }

        return NextResponse.json({ ok: true, message: `Connected to Ollama at ${ollamaEndpoint} — "${model}" is ready.` })
      }

      default:
        return NextResponse.json({ ok: false, message: `Unknown provider: ${provider}` }, { status: 400 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, message: `Connection failed: ${msg}` })
  }
}
