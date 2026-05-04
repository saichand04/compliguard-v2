// NL Query Engine — Natural Language → AI → MCP tool calls → structured response

import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { decrypt } from '@/lib/encryption'
import { MCP_TOOLS } from './tools'
import { dispatchTool } from './tools'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface NLQueryRequest {
  query: string
  orgId: string
  userId: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  maxToolCalls?: number // default 3
}

export interface NLQueryResponse {
  answer: string
  toolsUsed: Array<{ tool: string; args: Record<string, unknown>; result: string }>
  confidence: 'high' | 'medium' | 'low'
  followUpQuestions?: string[]
}

// ---------------------------------------------------------------------------
// Internal types for provider-agnostic message handling
// ---------------------------------------------------------------------------

type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

interface Message {
  role: MessageRole
  content: string
  tool_call_id?: string
  name?: string
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are CompliGuard AI, an expert GRC (Governance, Risk, and Compliance) assistant.
You have access to the organization's compliance data through tool calls.
Always provide specific, actionable answers based on the actual data.
When asked about compliance status, always use get_compliance_score or list_frameworks.
When asked about risks, use get_risk_summary and list_findings.
Be concise but thorough. Format numbers as percentages where appropriate.`

// ---------------------------------------------------------------------------
// Helpers to load AI config
// ---------------------------------------------------------------------------

interface AIConfig {
  provider: string
  model: string
  apiKey: string | null
  ollamaEndpoint: string
}

async function loadAIConfig(): Promise<AIConfig> {
  const [row] = await db.select().from(systemSettings).limit(1)
  if (!row) {
    return { provider: 'openai', model: 'gpt-4o-mini', apiKey: null, ollamaEndpoint: 'http://localhost:11434' }
  }

  const extra = (row.extraConfig ?? {}) as Record<string, string>
  let apiKey: string | null = null
  if (extra.encryptedApiKey) {
    try {
      apiKey = decrypt(extra.encryptedApiKey)
    } catch {
      apiKey = null
    }
  }

  return {
    provider: row.aiProvider ?? 'openai',
    model: row.aiModel ?? 'gpt-4o-mini',
    apiKey,
    ollamaEndpoint: extra.ollamaEndpoint ?? 'http://localhost:11434',
  }
}

// ---------------------------------------------------------------------------
// Convert MCP tool definitions to OpenAI function calling format
// ---------------------------------------------------------------------------

function toOpenAITools() {
  return MCP_TOOLS.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }))
}

// ---------------------------------------------------------------------------
// Convert MCP tool definitions to Anthropic tool format
// ---------------------------------------------------------------------------

function toAnthropicTools() {
  return MCP_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }))
}

// ---------------------------------------------------------------------------
// OpenAI call
// ---------------------------------------------------------------------------

interface OpenAIMessage {
  role: string
  content: string | null
  tool_calls?: Array<{
    id: string
    type: string
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

async function callOpenAI(
  messages: OpenAIMessage[],
  apiKey: string,
  model: string,
): Promise<{ text: string | null; toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools: toOpenAITools(),
      tool_choice: 'auto',
      max_tokens: 2048,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    choices: Array<{
      message: {
        content: string | null
        tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>
      }
    }>
  }

  const choice = data.choices[0]?.message
  if (!choice) throw new Error('No response from OpenAI')

  const toolCalls = (choice.tool_calls ?? []).map(tc => ({
    id: tc.id,
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments) as Record<string, unknown>,
  }))

  return { text: choice.content, toolCalls }
}

// ---------------------------------------------------------------------------
// Anthropic call
// ---------------------------------------------------------------------------

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | Array<{
    type: string
    tool_use_id?: string
    content?: string
    id?: string
    name?: string
    input?: Record<string, unknown>
  }>
}

async function callAnthropic(
  systemPrompt: string,
  messages: AnthropicMessage[],
  apiKey: string,
  model: string,
): Promise<{ text: string | null; toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages,
      tools: toAnthropicTools(),
      max_tokens: 2048,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    content: Array<{
      type: string
      text?: string
      id?: string
      name?: string
      input?: Record<string, unknown>
    }>
  }

  const textBlock = data.content.find(b => b.type === 'text')
  const toolUseBlocks = data.content.filter(b => b.type === 'tool_use')

  const toolCalls = toolUseBlocks.map(b => ({
    id: b.id ?? '',
    name: b.name ?? '',
    args: (b.input ?? {}) as Record<string, unknown>,
  }))

  return { text: textBlock?.text ?? null, toolCalls }
}

// ---------------------------------------------------------------------------
// Ollama call (no function calling — simplified)
// ---------------------------------------------------------------------------

async function callOllama(
  systemPrompt: string,
  userQuery: string,
  endpoint: string,
  model: string,
  contextData: string,
): Promise<string> {
  const prompt = `${systemPrompt}\n\nHere is the relevant compliance data:\n${contextData}\n\nUser question: ${userQuery}`

  const res = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
    }),
  })

  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}`)
  }

  const data = await res.json() as { response?: string }
  return data.response ?? 'No response from Ollama.'
}

// ---------------------------------------------------------------------------
// Confidence heuristic
// ---------------------------------------------------------------------------

function deriveConfidence(toolsUsed: Array<{ tool: string }>): 'high' | 'medium' | 'low' {
  if (toolsUsed.length === 0) return 'low'
  const highConfidenceTools = ['get_compliance_score', 'get_risk_summary', 'list_findings', 'list_frameworks']
  const hasHighConfidence = toolsUsed.some(t => highConfidenceTools.includes(t.tool))
  if (hasHighConfidence) return 'high'
  return 'medium'
}

// ---------------------------------------------------------------------------
// Follow-up question suggestions
// ---------------------------------------------------------------------------

function suggestFollowUps(toolsUsed: Array<{ tool: string }>): string[] {
  const suggestions: string[] = []
  const toolNames = toolsUsed.map(t => t.tool)

  if (!toolNames.includes('get_compliance_score')) {
    suggestions.push("What's our overall compliance score?")
  }
  if (!toolNames.includes('list_findings')) {
    suggestions.push('Show me critical findings')
  }
  if (!toolNames.includes('get_risk_summary')) {
    suggestions.push('What are our biggest risks?')
  }
  if (!toolNames.includes('list_tasks')) {
    suggestions.push('Which tasks are overdue?')
  }

  return suggestions.slice(0, 3)
}

// ---------------------------------------------------------------------------
// Main: executeNLQuery
// ---------------------------------------------------------------------------

export async function executeNLQuery(request: NLQueryRequest): Promise<NLQueryResponse> {
  const config = await loadAIConfig()
  const maxToolCalls = request.maxToolCalls ?? 3
  const toolsUsed: Array<{ tool: string; args: Record<string, unknown>; result: string }> = []

  // ---------- Ollama path (no function calling) ----------
  if (config.provider === 'ollama') {
    // Prefetch basic data for context
    let contextData = ''
    try {
      const [riskResult, scoreResult] = await Promise.all([
        dispatchTool('get_risk_summary', {}, request.orgId),
        dispatchTool('get_compliance_score', {}, request.orgId),
      ])
      contextData = [
        riskResult.content[0]?.text ?? '',
        scoreResult.content[0]?.text ?? '',
      ].join('\n')

      toolsUsed.push(
        { tool: 'get_risk_summary', args: {}, result: riskResult.content[0]?.text ?? '' },
        { tool: 'get_compliance_score', args: {}, result: scoreResult.content[0]?.text ?? '' },
      )
    } catch {
      contextData = 'Unable to fetch compliance data.'
    }

    const answer = await callOllama(
      SYSTEM_PROMPT,
      request.query,
      config.ollamaEndpoint,
      config.model || 'mistral',
      contextData,
    )

    return {
      answer,
      toolsUsed,
      confidence: deriveConfidence(toolsUsed),
      followUpQuestions: suggestFollowUps(toolsUsed),
    }
  }

  // ---------- OpenAI path ----------
  if (config.provider === 'openai') {
    if (!config.apiKey) {
      return {
        answer: 'OpenAI API key is not configured. Please configure it in Settings → AI Provider.',
        toolsUsed: [],
        confidence: 'low',
        followUpQuestions: [],
      }
    }

    const openaiMessages: OpenAIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(request.conversationHistory ?? []).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: request.query },
    ]

    let finalText = ''
    let toolCallCount = 0

    while (toolCallCount < maxToolCalls) {
      const { text, toolCalls } = await callOpenAI(openaiMessages, config.apiKey, config.model)

      if (toolCalls.length === 0) {
        finalText = text ?? ''
        break
      }

      // Append assistant message with tool_calls
      openaiMessages.push({
        role: 'assistant',
        content: text,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      })

      // Execute each tool call
      for (const tc of toolCalls) {
        const result = await dispatchTool(tc.name, tc.args, request.orgId)
        const resultText = result.content[0]?.text ?? '{}'
        toolsUsed.push({ tool: tc.name, args: tc.args, result: resultText })

        openaiMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.name,
          content: resultText,
        })
      }

      toolCallCount++
    }

    // If we hit the max loop without a final text response, get a concluding answer
    if (!finalText && toolCallCount >= maxToolCalls) {
      openaiMessages.push({
        role: 'user',
        content: 'Based on the data above, please provide your final answer.',
      })
      const { text } = await callOpenAI(
        openaiMessages.map(m => ({ ...m, tool_calls: undefined })),
        config.apiKey,
        config.model,
      )
      finalText = text ?? 'Unable to generate a response.'
    }

    return {
      answer: finalText || 'No response generated.',
      toolsUsed,
      confidence: deriveConfidence(toolsUsed),
      followUpQuestions: suggestFollowUps(toolsUsed),
    }
  }

  // ---------- Anthropic path ----------
  if (config.provider === 'anthropic') {
    if (!config.apiKey) {
      return {
        answer: 'Anthropic API key is not configured. Please configure it in Settings → AI Provider.',
        toolsUsed: [],
        confidence: 'low',
        followUpQuestions: [],
      }
    }

    const anthropicMessages: AnthropicMessage[] = [
      ...(request.conversationHistory ?? []).map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: request.query },
    ]

    let finalText = ''
    let toolCallCount = 0

    while (toolCallCount < maxToolCalls) {
      const { text, toolCalls } = await callAnthropic(
        SYSTEM_PROMPT,
        anthropicMessages,
        config.apiKey,
        config.model,
      )

      if (toolCalls.length === 0) {
        finalText = text ?? ''
        break
      }

      // Add assistant turn with tool_use blocks
      const assistantContent: AnthropicMessage['content'] = []
      if (text) {
        assistantContent.push({ type: 'text', content: text })
      }
      for (const tc of toolCalls) {
        assistantContent.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.args,
        })
      }
      anthropicMessages.push({ role: 'assistant', content: assistantContent })

      // Execute tools and add results
      const toolResultContent: AnthropicMessage['content'] = []
      for (const tc of toolCalls) {
        const result = await dispatchTool(tc.name, tc.args, request.orgId)
        const resultText = result.content[0]?.text ?? '{}'
        toolsUsed.push({ tool: tc.name, args: tc.args, result: resultText })
        toolResultContent.push({
          type: 'tool_result',
          tool_use_id: tc.id,
          content: resultText,
        })
      }
      anthropicMessages.push({ role: 'user', content: toolResultContent })

      toolCallCount++
    }

    if (!finalText) {
      anthropicMessages.push({ role: 'user', content: 'Please provide your final answer based on the data above.' })
      const { text } = await callAnthropic(SYSTEM_PROMPT, anthropicMessages, config.apiKey, config.model)
      finalText = text ?? 'Unable to generate a response.'
    }

    return {
      answer: finalText || 'No response generated.',
      toolsUsed,
      confidence: deriveConfidence(toolsUsed),
      followUpQuestions: suggestFollowUps(toolsUsed),
    }
  }

  // ---------- Unknown provider ----------
  return {
    answer: `AI provider "${config.provider}" is not supported. Please configure OpenAI, Anthropic, or Ollama in Settings → AI Provider.`,
    toolsUsed: [],
    confidence: 'low',
    followUpQuestions: [],
  }
}
