import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { aiProvider, apiKey, model } = body

  if (!apiKey) {
    return NextResponse.json({ ok: false, message: 'API key is required' })
  }

  try {
    if (aiProvider === 'openai') {
      const { openai } = await import('@ai-sdk/openai')
      const { generateText } = await import('ai')
      // Temporarily set the API key
      process.env.OPENAI_API_KEY = apiKey
      const { text } = await generateText({
        model: openai(model || 'gpt-4o-mini'),
        prompt: 'Reply with exactly: OK',
      })
      return NextResponse.json({ ok: true, message: `OpenAI response: "${text.trim()}" — connection successful` })
    } else if (aiProvider === 'gemini') {
      const { google } = await import('@ai-sdk/google')
      const { generateText } = await import('ai')
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey
      const { text } = await generateText({
        model: google(model || 'gemini-2.0-flash'),
        prompt: 'Reply with exactly: OK',
      })
      return NextResponse.json({ ok: true, message: `Gemini response: "${text.trim()}" — connection successful` })
    }

    return NextResponse.json({ ok: false, message: `Unknown AI provider: ${aiProvider}` })
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, message: `AI test failed: ${(err as Error).message}` })
  }
}
