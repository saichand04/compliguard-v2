/**
 * Microsoft Teams Bot Framework integration
 * Uses direct HTTP calls to Bot Framework REST API (no botbuilder dependency)
 */

export interface TeamsConversationRef {
  serviceUrl: string
  conversationId: string
  tenantId: string
  botId: string
  userId?: string
  channelId: string
}

export interface AdaptiveCard {
  type: 'AdaptiveCard'
  version: string
  body: object[]
  actions?: object[]
}

interface BotTokenCache {
  token: string
  expiresAt: number
}

// Simple in-memory token cache per tenantId
const tokenCache = new Map<string, BotTokenCache>()

/**
 * Obtain an OAuth2 bearer token for the bot using client_credentials flow.
 */
export async function getBotToken(tenantId: string): Promise<string> {
  const cached = tokenCache.get(tenantId)
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token
  }

  const appId = process.env.BOT_APP_ID
  const appPassword = process.env.BOT_APP_PASSWORD

  if (!appId || !appPassword) {
    throw new Error('BOT_APP_ID or BOT_APP_PASSWORD environment variables not configured')
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: appId,
    client_secret: appPassword,
    scope: 'https://api.botframework.com/.default',
  })

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to obtain bot token: ${res.status} ${text}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  const entry: BotTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  tokenCache.set(tenantId, entry)
  return entry.token
}

/**
 * Send a plain text proactive message to a Teams conversation.
 */
export async function sendProactiveMessage(
  ref: TeamsConversationRef,
  message: string
): Promise<void> {
  const token = await getBotToken(ref.tenantId)
  const url = `${ref.serviceUrl.replace(/\/$/, '')}/v3/conversations/${encodeURIComponent(ref.conversationId)}/activities`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'message',
      from: { id: ref.botId },
      conversation: { id: ref.conversationId },
      text: message,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to send proactive message: ${res.status} ${text}`)
  }
}

/**
 * Send an Adaptive Card to a Teams conversation.
 */
export async function sendAdaptiveCard(
  ref: TeamsConversationRef,
  card: AdaptiveCard
): Promise<void> {
  const token = await getBotToken(ref.tenantId)
  const url = `${ref.serviceUrl.replace(/\/$/, '')}/v3/conversations/${encodeURIComponent(ref.conversationId)}/activities`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'message',
      from: { id: ref.botId },
      conversation: { id: ref.conversationId },
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: card,
        },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to send adaptive card: ${res.status} ${text}`)
  }
}

/**
 * Create a finding Adaptive Card with severity-based colour coding.
 */
export function createFindingCard(finding: {
  title: string
  severity: string
  framework: string
  description: string
}): AdaptiveCard {
  const severityColorMap: Record<string, string> = {
    critical: '#DC2626',
    high: '#EA580C',
    medium: '#D97706',
    low: '#65A30D',
  }
  const color = severityColorMap[(finding.severity || '').toLowerCase()] ?? '#6B7280'

  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: '🔍 New Compliance Finding',
        weight: 'Bolder',
        size: 'Medium',
        color: 'Accent',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Title', value: finding.title },
          { title: 'Severity', value: finding.severity.toUpperCase() },
          { title: 'Framework', value: finding.framework },
        ],
      },
      {
        type: 'TextBlock',
        text: finding.description,
        wrap: true,
        color: 'Default',
      },
      {
        type: 'TextBlock',
        text: `■ Severity: ${finding.severity.toUpperCase()}`,
        color: 'Default',
        size: 'Small',
        weight: 'Bolder',
        // We can't use dynamic CSS in adaptive cards; communicate via text
        isSubtle: false,
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Finding',
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/findings`,
        style: 'positive',
      },
    ],
  }
}

/**
 * Create a compliance alert Adaptive Card.
 */
export function createComplianceAlertCard(alert: {
  type: string
  score: number
  change: number
  framework: string
}): AdaptiveCard {
  const isNegative = alert.change < 0
  const changeText = isNegative
    ? `▼ ${Math.abs(alert.change)}% drop`
    : `▲ ${alert.change}% increase`

  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: '⚠️ Compliance Alert',
        weight: 'Bolder',
        size: 'Medium',
        color: isNegative ? 'Attention' : 'Good',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Alert Type', value: alert.type },
          { title: 'Framework', value: alert.framework },
          { title: 'Current Score', value: `${alert.score}%` },
          { title: 'Change', value: changeText },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Dashboard',
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/dashboard`,
        style: isNegative ? 'destructive' : 'positive',
      },
    ],
  }
}

/**
 * Create an incident Adaptive Card.
 */
export function createIncidentCard(incident: {
  title: string
  severity: string
  assignee: string
  dueDate: string
}): AdaptiveCard {
  const severityColorMap: Record<string, string> = {
    critical: 'Attention',
    high: 'Warning',
    medium: 'Accent',
    low: 'Good',
  }
  const cardColor = severityColorMap[(incident.severity || '').toLowerCase()] ?? 'Default'

  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: '🚨 Incident Created',
        weight: 'Bolder',
        size: 'Medium',
        color: cardColor,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Title', value: incident.title },
          { title: 'Severity', value: incident.severity.toUpperCase() },
          { title: 'Assignee', value: incident.assignee },
          { title: 'Due Date', value: incident.dueDate },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Incident',
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/risks`,
        style: 'destructive',
      },
    ],
  }
}

/**
 * Create a welcome Adaptive Card sent when the bot joins a conversation.
 */
export function createWelcomeCard(): AdaptiveCard {
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: '🛡️ CompliGuard GRC Bot',
        weight: 'Bolder',
        size: 'Large',
        color: 'Accent',
      },
      {
        type: 'TextBlock',
        text: 'Hello! I\'m your CompliGuard compliance assistant. I\'ll send you real-time alerts for findings, compliance score changes, and incidents.',
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: '**Available Commands:**',
        weight: 'Bolder',
        spacing: 'Medium',
      },
      {
        type: 'FactSet',
        facts: [
          { title: '/status', value: 'Get your compliance score summary' },
          { title: '/findings', value: 'List top critical findings' },
          { title: '/help', value: 'Show all available commands' },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'Open CompliGuard',
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/dashboard`,
        style: 'positive',
      },
    ],
  }
}

/**
 * Create a help Adaptive Card.
 */
export function createHelpCard(): AdaptiveCard {
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: '🛡️ CompliGuard Bot — Help',
        weight: 'Bolder',
        size: 'Medium',
        color: 'Accent',
      },
      {
        type: 'TextBlock',
        text: 'Here are all available commands:',
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: [
          { title: '/status', value: 'Get your compliance score summary across all frameworks' },
          { title: '/findings', value: 'List the top 5 critical/high findings requiring attention' },
          { title: '/help', value: 'Show this help message' },
        ],
      },
      {
        type: 'TextBlock',
        text: 'You will also receive automatic notifications for new findings, compliance score changes, and incidents.',
        wrap: true,
        isSubtle: true,
        spacing: 'Medium',
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'Open CompliGuard Dashboard',
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/dashboard`,
        style: 'positive',
      },
    ],
  }
}
