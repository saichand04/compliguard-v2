import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import {
  systemSettings,
  controls,
  controlAssignments,
  evidence,
  findings,
  tasks,
  knowledgeBaseEntries,
  contextHub,
  organizations,
} from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildSystemPrompt(ctx: {
  orgName: string
  techStack: string
  riskTolerance: string
  complianceGoals: string
  businessProcesses: string
  controlCount: number
  frameworkCount: number
  evidenceCount: number
  openFindingsCount: number
  pendingTasksCount: number
  toolData?: string
}): string {
  return `You are CompliGuard AI, a compliance and GRC expert assistant for ${ctx.orgName}.

Organization Context:
- Tech Stack: ${ctx.techStack || 'Not configured'}
- Risk Tolerance: ${ctx.riskTolerance || 'Not configured'}
- Compliance Goals: ${ctx.complianceGoals || 'Not configured'}
- Business Context: ${ctx.businessProcesses || 'Not configured'}

You have access to:
- ${ctx.controlCount} compliance controls across ${ctx.frameworkCount} frameworks
- ${ctx.evidenceCount} evidence items
- ${ctx.openFindingsCount} open findings
- ${ctx.pendingTasksCount} pending tasks

${ctx.toolData ? `\nRelevant Data:\n${ctx.toolData}` : ''}

You help compliance teams understand their posture, identify gaps, and take action.
When asked about specific data, provide factual answers based on the org's real data.
Keep responses concise, actionable, and professional.`
}

async function runToolCalls(message: string, orgId: string): Promise<string> {
  const lowerMsg = message.toLowerCase()
  const parts: string[] = []

  try {
    if (lowerMsg.includes('missing control') || lowerMsg.includes('control gap')) {
      const notImplemented = await db
        .select({ control: controls })
        .from(controlAssignments)
        .innerJoin(controls, eq(controls.id, controlAssignments.controlId))
        .where(
          and(
            eq(controlAssignments.organizationId, orgId),
            eq(controlAssignments.status, 'not_started')
          )
        )
        .limit(20)

      if (notImplemented.length > 0) {
        parts.push(
          `Not Implemented Controls (${notImplemented.length} found):\n` +
          notImplemented
            .map((r) => `- [${r.control.controlId || r.control.id}] ${r.control.title}`)
            .join('\n')
        )
      }
    }

    if (lowerMsg.includes('evidence gap')) {
      // Controls with no linked evidence
      const allControls = await db
        .select({ id: controlAssignments.id, controlId: controls.id, title: controls.title })
        .from(controlAssignments)
        .innerJoin(controls, eq(controls.id, controlAssignments.controlId))
        .where(eq(controlAssignments.organizationId, orgId))
        .limit(50)

      const evidenceItems = await db
        .select({ controlAssignmentId: evidence.controlAssignmentId })
        .from(evidence)
        .where(eq(evidence.organizationId, orgId))

      const evidenceAssignmentIds = new Set(evidenceItems.map((e) => e.controlAssignmentId))
      const gaps = allControls.filter((c) => !evidenceAssignmentIds.has(c.id))

      if (gaps.length > 0) {
        parts.push(
          `Controls with No Evidence (${gaps.length} found):\n` +
          gaps.slice(0, 15).map((c) => `- ${c.title}`).join('\n')
        )
      }
    }

    if (lowerMsg.includes('finding')) {
      const openFindings = await db
        .select()
        .from(findings)
        .where(
          and(
            eq(findings.organizationId, orgId),
            eq(findings.status, 'open')
          )
        )
        .limit(20)

      if (openFindings.length > 0) {
        parts.push(
          `Open Findings (${openFindings.length}):\n` +
          openFindings
            .map((f) => `- [${f.severity?.toUpperCase() || 'UNKNOWN'}] ${f.title}`)
            .join('\n')
        )
      }
    }

    if (lowerMsg.includes('posture') || lowerMsg.includes('compliance posture')) {
      const allAssignments = await db
        .select()
        .from(controlAssignments)
        .where(eq(controlAssignments.organizationId, orgId))
        .limit(500)

      const total = allAssignments.length
      const implemented = allAssignments.filter((a) => a.status === 'implemented').length
      const inProgress = allAssignments.filter((a) => a.status === 'in_progress').length
      const notImplemented = allAssignments.filter((a) => a.status === 'not_started').length
      const pct = total > 0 ? Math.round((implemented / total) * 100) : 0

      parts.push(
        `Compliance Posture Summary:\n` +
        `- Total Controls: ${total}\n` +
        `- Implemented: ${implemented} (${pct}%)\n` +
        `- In Progress: ${inProgress}\n` +
        `- Not Implemented: ${notImplemented}`
      )
    }
  } catch {
    // Tool calls are best-effort
  }

  return parts.join('\n\n')
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { message: string; conversationId?: string; context?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { message, conversationId } = body
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  const orgId = session.orgId
  if (!orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  // Load org data
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  // Load context hub
  const [hub] = await db
    .select()
    .from(contextHub)
    .where(eq(contextHub.organizationId, orgId))
    .limit(1)

  // Load system settings (AI provider)
  const [settings] = await db.select().from(systemSettings).limit(1)

  // Build counts
  let controlCount = 0
  let frameworkCount = 0
  let evidenceCount = 0
  let openFindingsCount = 0
  let pendingTasksCount = 0

  try {
    const [cc] = await db
      .select({ c: sql<number>`count(*)` })
      .from(controlAssignments)
      .where(eq(controlAssignments.organizationId, orgId))
    controlCount = Number(cc?.c ?? 0)

    const [ec] = await db
      .select({ c: sql<number>`count(*)` })
      .from(evidence)
      .where(eq(evidence.organizationId, orgId))
    evidenceCount = Number(ec?.c ?? 0)

    const [fc] = await db
      .select({ c: sql<number>`count(*)` })
      .from(findings)
      .where(and(eq(findings.organizationId, orgId), eq(findings.status, 'open')))
    openFindingsCount = Number(fc?.c ?? 0)

    const [tc] = await db
      .select({ c: sql<number>`count(*)` })
      .from(tasks)
      .where(and(eq(tasks.organizationId, orgId), eq(tasks.status, 'todo')))
    pendingTasksCount = Number(tc?.c ?? 0)
  } catch {
    // Non-fatal
  }

  // Run tool calls
  const toolData = await runToolCalls(message, orgId)

  // Build tech stack string
  const techStackArr = hub?.techStack as Array<{ name: string; category?: string }> | null
  const techStackStr = techStackArr?.map((t) => t.name).join(', ') || 'Not configured'

  // Build compliance goals string
  const goalsArr = hub?.complianceGoals as Array<{ framework: string }> | null
  const goalsStr = goalsArr?.map((g) => g.framework).join(', ') || 'Not configured'

  const systemPrompt = buildSystemPrompt({
    orgName: org?.name || 'Your Organization',
    techStack: techStackStr,
    riskTolerance: hub?.riskTolerance || 'Not configured',
    complianceGoals: goalsStr,
    businessProcesses: hub?.businessProcesses || 'Not configured',
    controlCount,
    frameworkCount,
    evidenceCount,
    openFindingsCount,
    pendingTasksCount,
    toolData,
  })

  // Load conversation history if conversationId provided
  let history: Array<{ role: string; content: string }> = []
  if (conversationId) {
    const [conv] = await db
      .select()
      .from(knowledgeBaseEntries)
      .where(
        and(
          eq(knowledgeBaseEntries.category, 'ai_chat'),
          eq(knowledgeBaseEntries.organizationId, orgId)
        )
      )
      .limit(200)
    // Find conversation by metadata
    const allConvs = await db
      .select()
      .from(knowledgeBaseEntries)
      .where(
        and(
          eq(knowledgeBaseEntries.category, 'ai_chat'),
          eq(knowledgeBaseEntries.organizationId, orgId)
        )
      )

    const matched = allConvs.find((c) => {
      const meta = c.metadata as { conversationId?: string } | null
      return meta?.conversationId === conversationId
    })

    if (matched) {
      try {
        const parsed = JSON.parse(matched.content)
        history = parsed.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        }))
      } catch {
        // ignore
      }
    }
  }

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10), // last 10 turns
    { role: 'user', content: message },
  ]

  // Determine AI provider/model
  const provider = settings?.aiProvider || 'openai'
  const model = settings?.aiModel || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash')

  const messageId = randomUUID()
  const convId = conversationId || randomUUID()

  // Create SSE stream
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      try {
        let fullContent = ''

        if (provider === 'openai' || provider === 'openai-compatible') {
          const apiKey = process.env.OPENAI_API_KEY || ''
          const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages,
              stream: true,
              max_tokens: 1024,
              temperature: 0.7,
            }),
          })

          if (!response.ok || !response.body) {
            const errText = await response.text().catch(() => 'Unknown error')
            sendEvent(JSON.stringify({ type: 'error', content: `AI provider error: ${errText}` }))
            sendEvent('[DONE]')
            controller.close()
            return
          }

          const reader = response.body.getReader()
          const dec = new TextDecoder()

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = dec.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                const token = parsed.choices?.[0]?.delta?.content
                if (token) {
                  fullContent += token
                  sendEvent(JSON.stringify({ type: 'token', content: token }))
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }
        } else if (provider === 'gemini') {
          const apiKey = process.env.GEMINI_API_KEY || ''
          const geminiModel = model || 'gemini-2.0-flash'

          // Convert messages to Gemini format
          const geminiMessages = messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            }))

          const systemInstruction = messages.find((m) => m.role === 'system')?.content

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: geminiMessages,
                ...(systemInstruction
                  ? { system_instruction: { parts: [{ text: systemInstruction }] } }
                  : {}),
                generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
              }),
            }
          )

          if (!response.ok || !response.body) {
            const errText = await response.text().catch(() => 'Unknown error')
            sendEvent(JSON.stringify({ type: 'error', content: `AI provider error: ${errText}` }))
            sendEvent('[DONE]')
            controller.close()
            return
          }

          const reader = response.body.getReader()
          const dec = new TextDecoder()

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = dec.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (!data) continue

              try {
                const parsed = JSON.parse(data)
                const token =
                  parsed.candidates?.[0]?.content?.parts?.[0]?.text
                if (token) {
                  fullContent += token
                  sendEvent(JSON.stringify({ type: 'token', content: token }))
                }
              } catch {
                // Skip
              }
            }
          }
        } else {
          // Fallback: mock response for unconfigured AI
          const mockResponse =
            'AI provider not configured. Please set up your AI provider in Settings → AI to enable the assistant.'
          for (const char of mockResponse.split(' ')) {
            fullContent += char + ' '
            sendEvent(JSON.stringify({ type: 'token', content: char + ' ' }))
            await new Promise((r) => setTimeout(r, 20))
          }
        }

        // Save conversation to knowledge_base
        try {
          const newMessages = [
            ...history,
            { role: 'user', content: message, timestamp: new Date().toISOString() },
            { role: 'assistant', content: fullContent, timestamp: new Date().toISOString() },
          ]

          // Check if conversation already exists
          const existing = await db
            .select()
            .from(knowledgeBaseEntries)
            .where(
              and(
                eq(knowledgeBaseEntries.category, 'ai_chat'),
                eq(knowledgeBaseEntries.organizationId, orgId)
              )
            )

          const existingConv = existing.find((c) => {
            const meta = c.metadata as { conversationId?: string } | null
            return meta?.conversationId === convId
          })

          if (existingConv) {
            await db
              .update(knowledgeBaseEntries)
              .set({
                content: JSON.stringify(newMessages),
                updatedAt: new Date(),
              })
              .where(eq(knowledgeBaseEntries.id, existingConv.id))
          } else {
            await db.insert(knowledgeBaseEntries).values({
              organizationId: orgId,
              title: message.slice(0, 80),
              content: JSON.stringify(newMessages),
              category: 'ai_chat',
              createdBy: session.userId,
              metadata: {
                conversationId: convId,
                userId: session.userId,
                orgId,
              },
            })
          }
        } catch {
          // Non-fatal
        }

        sendEvent(JSON.stringify({ type: 'done', messageId, conversationId: convId }))
        sendEvent('[DONE]')
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', content: msg })}\n\n`)
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
