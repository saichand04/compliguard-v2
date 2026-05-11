import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth/jwt'

/**
 * POST /api/setup/test-ai
 *
 * Validates the supplied AI provider credentials by performing a single
 * round-trip generation. Restricted to authenticated super_admin callers
 * because it accepts a live API key in the request body.
 *
 * SECURITY: this handler MUST NOT write the supplied credentials into
 * `process.env`. Doing so would leak the tester's key into every other
 * request handled by the same Node process. The candidate API key is
 * passed directly into the provider factory and is therefore confined
 * to this request's scope.
 */
export async function POST(req: NextRequest) {
  // Gate the endpoint behind super_admin regardless of setup state.
  // During first-run setup, the super_admin account is created in
  // step 3, so this endpoint is only useful once the caller has logged
  // in as that account (or any subsequent super_admin).
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { aiProvider?: string; apiKey?: string; model?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { aiProvider, apiKey, model } = body

  if (!apiKey) {
    return NextResponse.json({ ok: false, message: 'API key is required' })
  }

  try {
    if (aiProvider === 'openai') {
      const { createOpenAI } = await import('@ai-sdk/openai')
      const { generateText } = await import('ai')
      // Construct an isolated provider with the candidate API key — do
      // NOT mutate process.env.OPENAI_API_KEY.
      const provider = createOpenAI({ apiKey })
      const { text } = await generateText({
        model: provider(model || 'gpt-4o-mini'),
        prompt: 'Reply with exactly: OK',
      })
      return NextResponse.json({ ok: true, message: `OpenAI response: "${text.trim()}" — connection successful` })
    } else if (aiProvider === 'gemini') {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
      const { generateText } = await import('ai')
      const provider = createGoogleGenerativeAI({ apiKey })
      const { text } = await generateText({
        model: provider(model || 'gemini-2.0-flash'),
        prompt: 'Reply with exactly: OK',
      })
      return NextResponse.json({ ok: true, message: `Gemini response: "${text.trim()}" — connection successful` })
    }

    return NextResponse.json({ ok: false, message: `Unknown AI provider: ${aiProvider}` })
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, message: `AI test failed: ${(err as Error).message}` })
  }
}
