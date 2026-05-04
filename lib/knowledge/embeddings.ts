/**
 * AI embedding integration
 *
 * Generates text embeddings using OpenAI text-embedding-3-small.
 * Falls back to empty array for unsupported providers.
 */

import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'

const MAX_TEXT_LENGTH = 8000

// ── Fetch AI provider config ──────────────────────────────────────────────────

async function getAIConfig(): Promise<{ provider: string; apiKey?: string; model?: string }> {
  try {
    const settings = await db.select().from(systemSettings).limit(1)
    const s = settings[0]
    if (!s) return { provider: 'none' }

    const extra = (s.extraConfig ?? {}) as Record<string, unknown>

    return {
      provider: s.aiProvider ?? 'openai',
      apiKey:
        (extra.openaiApiKey as string | undefined) ??
        process.env.OPENAI_API_KEY ??
        undefined,
      model: s.aiModel ?? 'text-embedding-3-small',
    }
  } catch {
    return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY }
  }
}

// ── Generate embedding ────────────────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
  const config = await getAIConfig()

  // Only OpenAI supports embeddings in this implementation
  if (config.provider !== 'openai') {
    return []
  }

  const apiKey = config.apiKey
  if (!apiKey) {
    // No API key configured — skip silently
    return []
  }

  // Truncate text to avoid token limit issues
  const truncated = text.slice(0, MAX_TEXT_LENGTH)

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: truncated,
        model: 'text-embedding-3-small',
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[embeddings] OpenAI API error:', response.status, err)
      return []
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>
    }

    return data.data[0]?.embedding ?? []
  } catch (err) {
    console.error('[embeddings] Failed to generate embedding:', err)
    return []
  }
}

// ── Helper: text for embedding ────────────────────────────────────────────────

export function buildEmbeddingText(title: string, content: string, tags: unknown): string {
  const tagsStr = Array.isArray(tags) ? (tags as string[]).join(', ') : ''
  return `${title}\n\n${tagsStr ? `Tags: ${tagsStr}\n\n` : ''}${content}`
}
