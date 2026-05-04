/**
 * Teams notification service — broadcasts proactive messages to all active conversations.
 */
import { db } from '@/lib/db'
import { teamsConversationRefs } from '@/lib/db/schema/teams_bot'
import {
  TeamsConversationRef,
  sendAdaptiveCard,
  sendProactiveMessage,
  createFindingCard,
  createComplianceAlertCard,
  createIncidentCard,
} from '@/lib/teams/bot'

/**
 * Retrieve all active Teams conversation refs from the database.
 */
export async function getActiveConversations(): Promise<TeamsConversationRef[]> {
  const rows = await db.select().from(teamsConversationRefs)

  return rows
    .map((row) => {
      const stored = row.conversationRef as Record<string, unknown>
      return {
        serviceUrl: row.serviceUrl,
        conversationId:
          (stored?.conversationId as string) ?? (stored?.id as string) ?? '',
        tenantId: row.tenantId ?? (stored?.tenantId as string) ?? '',
        botId:
          (stored?.botId as string) ?? process.env.BOT_APP_ID ?? '',
        userId: row.teamsUserId ?? undefined,
        channelId: row.channelId ?? 'msteams',
      } satisfies TeamsConversationRef
    })
    .filter((r) => r.conversationId && r.serviceUrl && r.tenantId)
}

/**
 * Broadcast a plain text message to all active conversations.
 */
export async function broadcastMessage(message: string): Promise<void> {
  const conversations = await getActiveConversations()
  const results = await Promise.allSettled(
    conversations.map((ref) => sendProactiveMessage(ref, message))
  )
  const errors = results.filter((r) => r.status === 'rejected')
  if (errors.length > 0) {
    console.error(`[Teams Notifications] ${errors.length} broadcast(s) failed:`, errors)
  }
}

/**
 * Notify all conversations about a new compliance finding.
 */
export async function notifyNewFinding(finding: {
  title: string
  severity: string
  framework: string
  description: string
}): Promise<void> {
  const conversations = await getActiveConversations()
  const card = createFindingCard(finding)
  const results = await Promise.allSettled(
    conversations.map((ref) => sendAdaptiveCard(ref, card))
  )
  const errors = results.filter((r) => r.status === 'rejected')
  if (errors.length > 0) {
    console.error(`[Teams Notifications] ${errors.length} finding notification(s) failed:`, errors)
  }
}

/**
 * Notify all conversations about a compliance score alert.
 */
export async function notifyComplianceAlert(alert: {
  type: string
  score: number
  change: number
  framework: string
}): Promise<void> {
  const conversations = await getActiveConversations()
  const card = createComplianceAlertCard(alert)
  const results = await Promise.allSettled(
    conversations.map((ref) => sendAdaptiveCard(ref, card))
  )
  const errors = results.filter((r) => r.status === 'rejected')
  if (errors.length > 0) {
    console.error(`[Teams Notifications] ${errors.length} compliance alert(s) failed:`, errors)
  }
}

/**
 * Notify all conversations when an incident is created.
 */
export async function notifyIncidentCreated(incident: {
  title: string
  severity: string
  assignee: string
  dueDate: string
}): Promise<void> {
  const conversations = await getActiveConversations()
  const card = createIncidentCard(incident)
  const results = await Promise.allSettled(
    conversations.map((ref) => sendAdaptiveCard(ref, card))
  )
  const errors = results.filter((r) => r.status === 'rejected')
  if (errors.length > 0) {
    console.error(`[Teams Notifications] ${errors.length} incident notification(s) failed:`, errors)
  }
}

/**
 * Notify all conversations about an overdue task.
 */
export async function notifyTaskOverdue(task: {
  title: string
  dueDate: string
  assignee: string
  severity?: string
}): Promise<void> {
  const conversations = await getActiveConversations()
  const card = {
    type: 'AdaptiveCard' as const,
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: '⏰ Task Overdue',
        weight: 'Bolder',
        size: 'Medium',
        color: 'Warning',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Task', value: task.title },
          { title: 'Assignee', value: task.assignee },
          { title: 'Due Date', value: task.dueDate },
          ...(task.severity ? [{ title: 'Severity', value: task.severity.toUpperCase() }] : []),
        ],
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Tasks',
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/tasks`,
        style: 'positive',
      },
    ],
  }

  const results = await Promise.allSettled(
    conversations.map((ref) => sendAdaptiveCard(ref, card))
  )
  const errors = results.filter((r) => r.status === 'rejected')
  if (errors.length > 0) {
    console.error(`[Teams Notifications] ${errors.length} task overdue notification(s) failed:`, errors)
  }
}
