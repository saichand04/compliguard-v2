/**
 * app/api/webhooks/slack/commands/route.ts
 * Handles inbound Slack slash commands.
 * No auth cookie required — verified via HMAC-SHA256 signature.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findings, tasks, integrations as integrationsTable, organizationFrameworks, frameworks as frameworksTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifySlackSignature } from '@/lib/integrations/slack'

// Slack sends commands as application/x-www-form-urlencoded
interface SlackCommandPayload {
  command: string
  text: string
  user_id: string
  user_name: string
  channel_id: string
  team_id: string
  response_url: string
}

function textBlock(text: string) {
  return { type: 'section', text: { type: 'mrkdwn', text } }
}

export async function POST(req: NextRequest) {
  // Read raw body for signature verification
  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  // Parse form data
  const params = new URLSearchParams(rawBody)
  const payload: SlackCommandPayload = {
    command: params.get('command') ?? '',
    text: params.get('text')?.trim() ?? '',
    user_id: params.get('user_id') ?? '',
    user_name: params.get('user_name') ?? '',
    channel_id: params.get('channel_id') ?? '',
    team_id: params.get('team_id') ?? '',
    response_url: params.get('response_url') ?? '',
  }

  // Find the org whose Slack integration matches this team
  // Look up all slack integrations and verify signature against each one.
  const slackIntegrations = await db
    .select()
    .from(integrationsTable)
    .where(eq(integrationsTable.type, 'slack'))

  let orgId: string | null = null

  for (const integration of slackIntegrations) {
    const encCreds = integration.encryptedCredentials
    if (!encCreds) continue

    try {
      const { decrypt } = await import('@/lib/encryption')
      const decrypted = JSON.parse(decrypt(encCreds)) as Record<string, string>
      if (!decrypted.signingSecret) continue

      const valid = await verifySlackSignature(
        decrypted.signingSecret,
        signature,
        timestamp,
        rawBody,
      )

      if (valid) {
        orgId = integration.organizationId
        break
      }
    } catch {
      continue
    }
  }

  if (!orgId) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  const subCommand = payload.text.split(/\s+/)[0]?.toLowerCase() ?? ''

  try {
    const blocks = await handleCommand(orgId, subCommand)
    return NextResponse.json({ response_type: 'in_channel', blocks })
  } catch (err) {
    console.error('[Slack commands] error:', err)
    return NextResponse.json({
      response_type: 'ephemeral',
      text: '⚠️ An error occurred while processing your command.',
    })
  }
}

async function handleCommand(orgId: string, subCommand: string): Promise<unknown[]> {
  switch (subCommand) {
    case 'status':
      return handleStatus(orgId)
    case 'findings':
      return handleFindings(orgId)
    case 'tasks':
      return handleTasks(orgId)
    case 'help':
    default:
      return handleHelp()
  }
}

async function handleStatus(orgId: string): Promise<unknown[]> {
  const [orgFindings, allFrameworks] = await Promise.all([
    db
      .select({ status: findings.status, severity: findings.severity })
      .from(findings)
      .where(eq(findings.organizationId, orgId)),
    db
      .select({ name: frameworksTable.name })
      .from(frameworksTable)
      .innerJoin(organizationFrameworks, eq(frameworksTable.id, organizationFrameworks.frameworkId))
      .where(eq(organizationFrameworks.organizationId, orgId))
      .limit(5),
  ])

  const openCount = orgFindings.filter((f) => f.status === 'open').length
  const critCount = orgFindings.filter(
    (f) => f.status === 'open' && f.severity === 'critical',
  ).length

  return [
    { type: 'header', text: { type: 'plain_text', text: '📊 CompliGuard Status', emoji: true } },
    textBlock(
      `*Open Findings:* ${openCount} (${critCount} critical)\n*Frameworks:* ${allFrameworks.map((f) => f.name).join(', ') || 'None configured'}`,
    ),
  ]
}

async function handleFindings(orgId: string): Promise<unknown[]> {
  const topFindings = await db
    .select({
      id: findings.id,
      title: findings.title,
      severity: findings.severity,
      source: findings.source,
    })
    .from(findings)
    .where(
      eq(findings.organizationId, orgId),
    )
    .limit(10)

  const criticalHighFindings = topFindings.filter((f) =>
    ['critical', 'high'].includes(f.severity),
  ).slice(0, 5)

  if (criticalHighFindings.length === 0) {
    return [textBlock('✅ No critical or high findings open. Great work!')]
  }

  const severityEmoji: Record<string, string> = {
    critical: '🚨',
    high: '🔴',
    medium: '🟡',
    low: '🟢',
    info: 'ℹ️',
  }

  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: '🔍 Top Open Findings', emoji: true } },
  ]

  for (const f of criticalHighFindings) {
    const emoji = severityEmoji[f.severity] ?? '⚠️'
    blocks.push(textBlock(`${emoji} *${f.title}*\nSeverity: ${f.severity} | Source: ${f.source}`))
  }

  return blocks
}

async function handleTasks(orgId: string): Promise<unknown[]> {
  const topTasks = await db
    .select({ id: tasks.id, title: tasks.title, priority: tasks.priority, status: tasks.status })
    .from(tasks)
    .where(
      eq(tasks.organizationId, orgId),
    )
    .limit(10)

  const pendingTasks = topTasks
    .filter((t) => ['todo', 'in_progress'].includes(t.status ?? 'todo'))
    .slice(0, 5)

  if (pendingTasks.length === 0) {
    return [textBlock('✅ No pending tasks!')]
  }

  const priorityEmoji: Record<string, string> = {
    urgent: '🚨',
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  }

  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: '📝 Pending Tasks', emoji: true } },
  ]

  for (const t of pendingTasks) {
    const emoji = priorityEmoji[t.priority] ?? '📌'
    blocks.push(textBlock(`${emoji} *${t.title}*\nPriority: ${t.priority}`))
  }

  return blocks
}

function handleHelp(): unknown[] {
  return [
    { type: 'header', text: { type: 'plain_text', text: '🛡️ CompliGuard Commands', emoji: true } },
    textBlock(
      '*/compliguard status* — Show compliance summary and framework scores\n' +
        '*/compliguard findings* — Show top 5 open critical/high findings\n' +
        '*/compliguard tasks* — Show top 5 pending tasks\n' +
        '*/compliguard help* — Show this help message',
    ),
  ]
}
