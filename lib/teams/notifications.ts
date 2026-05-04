/**
 * Teams notification service — broadcasts proactive messages to all active conversations.
 */
import { db } from '@/lib/db'
import { teamsConversationRefs } from '@/lib/db/schema/teams_bot'
import {
  AdaptiveCard,
  TeamsConversationRef,
  sendAdaptiveCard,
  sendProactiveMessage,
  createFindingCard,
  createComplianceAlertCard,
  createIncidentCard,
  createEvidenceApprovalCard,
  createTaskReminderCard,
  EvidenceData,
  TaskData,
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
 * Retrieve conversation refs scoped to a specific org.
 */
async function getOrgConversations(orgId: string): Promise<TeamsConversationRef[]> {
  const { eq } = await import('drizzle-orm')
  const rows = await db
    .select()
    .from(teamsConversationRefs)
    .where(eq(teamsConversationRefs.organizationId, orgId))

  return rows
    .map((row) => {
      const stored = row.conversationRef as Record<string, unknown>
      return {
        serviceUrl: row.serviceUrl,
        conversationId:
          (stored?.conversationId as string) ?? (stored?.id as string) ?? '',
        tenantId: row.tenantId ?? (stored?.tenantId as string) ?? '',
        botId: (stored?.botId as string) ?? process.env.BOT_APP_ID ?? '',
        userId: row.teamsUserId ?? undefined,
        channelId: row.channelId ?? 'msteams',
      } satisfies TeamsConversationRef
    })
    .filter((r) => r.conversationId && r.serviceUrl && r.tenantId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Broadcast helpers
// ─────────────────────────────────────────────────────────────────────────────

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
 * Broadcast an Adaptive Card to all conversations in an org.
 * Returns counts of successful and failed sends.
 */
export async function broadcastToOrg(
  orgId: string,
  card: AdaptiveCard
): Promise<{ sent: number; failed: number }> {
  const conversations = await getOrgConversations(orgId)
  const results = await Promise.allSettled(
    conversations.map((ref) => sendAdaptiveCard(ref, card))
  )
  const failed = results.filter((r) => r.status === 'rejected').length
  const sent = results.length - failed
  if (failed > 0) {
    console.error(`[Teams Notifications] broadcastToOrg: ${failed} failed out of ${results.length}`)
  }
  return { sent, failed }
}

// ─────────────────────────────────────────────────────────────────────────────
// Original notification functions (preserved)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7.5 — Enhanced notification functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send an evidence review request card to all org conversations.
 */
export async function notifyEvidenceNeedsReview(evidence: EvidenceData): Promise<void> {
  const card = createEvidenceApprovalCard(evidence)
  const { sent, failed } = await broadcastToOrg(evidence.orgId, card)
  if (failed > 0) {
    console.error(
      `[Teams Notifications] notifyEvidenceNeedsReview: ${failed} failed, ${sent} sent (orgId=${evidence.orgId})`
    )
  }
}

/**
 * Send a task overdue reminder card to all org conversations.
 */
export async function notifyTaskOverdue(task: TaskData & { orgId: string }): Promise<void> {
  const card = createTaskReminderCard(task)
  const { sent, failed } = await broadcastToOrg(task.orgId, card)
  if (failed > 0) {
    console.error(
      `[Teams Notifications] notifyTaskOverdue: ${failed} failed, ${sent} sent (taskId=${task.id})`
    )
  }
}

/**
 * Notify all org conversations about a critical finding.
 */
export async function notifyCriticalFinding(finding: {
  id: string
  title: string
  severity: string
  affectedAsset?: string
  source: string
  orgId: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'
  const sevColor =
    finding.severity === 'critical' ? 'Attention' :
    finding.severity === 'high' ? 'Warning' : 'Default'
  const sevDot =
    finding.severity === 'critical' ? '🔴' :
    finding.severity === 'high' ? '🟠' : '🟡'

  const card: AdaptiveCard = {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `${sevDot} ${finding.severity.toUpperCase()} Finding Detected`,
        weight: 'Bolder',
        size: 'Large',
        color: sevColor,
      },
      { type: 'Separator' },
      {
        type: 'TextBlock',
        text: `**${finding.title}**`,
        weight: 'Bolder',
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Severity', value: finding.severity.toUpperCase() },
          { title: 'Source', value: finding.source },
          ...(finding.affectedAsset
            ? [{ title: 'Affected Asset', value: finding.affectedAsset }]
            : []),
          { title: 'Detected', value: new Date().toLocaleString() },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Finding',
        url: `${appUrl}/findings`,
        style: 'destructive',
      },
    ],
  }

  const { sent, failed } = await broadcastToOrg(finding.orgId, card)
  if (failed > 0) {
    console.error(
      `[Teams Notifications] notifyCriticalFinding: ${failed} failed, ${sent} sent (findingId=${finding.id})`
    )
  }
}

/**
 * Notify that evidence was rejected — sent to org broadcast (uploader may receive if ref exists).
 */
export async function notifyEvidenceRejected(params: {
  evidenceId: string
  evidenceTitle: string
  controlTitle: string
  rejectedBy: string
  reason?: string
  orgId: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'
  const card: AdaptiveCard = {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: '❌ Evidence Rejected',
        weight: 'Bolder',
        size: 'Large',
        color: 'Attention',
      },
      { type: 'Separator' },
      {
        type: 'FactSet',
        facts: [
          { title: 'Evidence', value: params.evidenceTitle },
          { title: 'Control', value: params.controlTitle },
          { title: 'Rejected by', value: params.rejectedBy },
          { title: 'Date', value: new Date().toLocaleString() },
          ...(params.reason ? [{ title: 'Reason', value: params.reason }] : []),
        ],
      },
      {
        type: 'TextBlock',
        text: 'Please upload new evidence that addresses the rejection reason.',
        wrap: true,
        size: 'Small',
        isSubtle: true,
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'Upload New Evidence',
        url: `${appUrl}/evidence`,
        style: 'positive',
      },
    ],
  }

  const { sent, failed } = await broadcastToOrg(params.orgId, card)
  if (failed > 0) {
    console.error(
      `[Teams Notifications] notifyEvidenceRejected: ${failed} failed, ${sent} sent (evidenceId=${params.evidenceId})`
    )
  }
}

/**
 * Notify all org conversations about an upcoming policy expiry.
 */
export async function notifyPolicyExpiry(params: {
  policyName: string
  expiryDate: string
  daysUntilExpiry: number
  orgId: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'
  const isUrgent = params.daysUntilExpiry <= 7
  const card: AdaptiveCard = {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: isUrgent ? '🚨 Policy Expiring Soon' : '📋 Policy Expiry Notice',
        weight: 'Bolder',
        size: 'Large',
        color: isUrgent ? 'Attention' : 'Warning',
      },
      { type: 'Separator' },
      {
        type: 'TextBlock',
        text: `**${params.policyName}**`,
        weight: 'Bolder',
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Expiry Date', value: params.expiryDate },
          {
            title: 'Days Remaining',
            value: `${params.daysUntilExpiry} day${params.daysUntilExpiry !== 1 ? 's' : ''}`,
          },
        ],
      },
      {
        type: 'TextBlock',
        text: isUrgent
          ? '⚠️ This policy expires very soon. Review and renew immediately.'
          : 'Please review and renew this policy before it expires.',
        wrap: true,
        size: 'Small',
        color: isUrgent ? 'Attention' : 'Default',
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'Review Policy',
        url: `${appUrl}/policies`,
        style: isUrgent ? 'destructive' : 'positive',
      },
    ],
  }

  const { sent, failed } = await broadcastToOrg(params.orgId, card)
  if (failed > 0) {
    console.error(
      `[Teams Notifications] notifyPolicyExpiry: ${failed} failed, ${sent} sent (policy="${params.policyName}")`
    )
  }
}
