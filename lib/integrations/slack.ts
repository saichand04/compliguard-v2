/**
 * lib/integrations/slack.ts
 * Slack Web API integration — no SDK, raw fetch().
 */

export interface SlackConfig {
  botToken: string
  signingSecret: string
  defaultChannelId?: string
  channels?: {
    findings_critical?: string
    findings_high?: string
    evidence_requests?: string
    daily_digest?: string
    general?: string
  }
}

export interface SlackBlock {
  type: string
  [key: string]: unknown
}

const SLACK_API_BASE = 'https://slack.com/api'

/**
 * Send a message to a Slack channel.
 */
export async function sendSlackMessage(
  token: string,
  channelId: string,
  text: string,
  blocks?: SlackBlock[],
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = { channel: channelId, text }
    if (blocks && blocks.length > 0) {
      body.blocks = blocks
    }

    const res = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json() as { ok: boolean; error?: string }
    if (!data.ok) {
      console.error('[Slack] chat.postMessage error:', data.error)
      return false
    }
    return true
  } catch (err) {
    console.error('[Slack] sendSlackMessage error:', err)
    return false
  }
}

/**
 * Notify about a new finding — sends a Block Kit message.
 */
export async function notifyFinding(
  config: SlackConfig,
  finding: {
    title: string
    severity: string
    source: string
    description: string
    viewUrl: string
  },
): Promise<void> {
  const severityEmoji: Record<string, string> = {
    critical: '🚨',
    high: '🔴',
    medium: '🟡',
    low: '🟢',
    info: 'ℹ️',
  }

  const emoji = severityEmoji[finding.severity.toLowerCase()] ?? '⚠️'
  const channelId =
    (finding.severity === 'critical'
      ? config.channels?.findings_critical
      : config.channels?.findings_high) ??
    config.channels?.general ??
    config.defaultChannelId

  if (!channelId) return

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} New Finding: ${finding.severity.toUpperCase()}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${finding.title}*\n${finding.description}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Source:*\n${finding.source}` },
        { type: 'mrkdwn', text: `*Severity:*\n${finding.severity}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Finding', emoji: true },
          url: finding.viewUrl,
          action_id: 'view_finding',
        },
      ],
    },
  ]

  await sendSlackMessage(
    config.botToken,
    channelId,
    `${emoji} New ${finding.severity.toUpperCase()} Finding: ${finding.title}`,
    blocks,
  )
}

/**
 * Notify about an evidence request.
 */
export async function notifyEvidenceRequest(
  config: SlackConfig,
  request: {
    title: string
    controlName: string
    requestedBy: string
    uploadUrl: string
    expiresAt: Date
  },
): Promise<void> {
  const channelId =
    config.channels?.evidence_requests ??
    config.channels?.general ??
    config.defaultChannelId

  if (!channelId) return

  const expiresStr = request.expiresAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📋 Evidence Request', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${request.title}*\nRequested by: ${request.requestedBy}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Control:*\n${request.controlName}` },
        { type: 'mrkdwn', text: `*Expires:*\n${expiresStr}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Upload Evidence', emoji: true },
          url: request.uploadUrl,
          style: 'primary',
          action_id: 'upload_evidence',
        },
      ],
    },
  ]

  await sendSlackMessage(
    config.botToken,
    channelId,
    `📋 Evidence Request: ${request.title}`,
    blocks,
  )
}

/**
 * Send daily compliance digest.
 */
export async function sendDailyDigest(
  config: SlackConfig,
  digest: {
    orgName: string
    openFindings: number
    criticalFindings: number
    pendingTasks: number
    complianceScore: number
    recentActivity: string[]
  },
): Promise<void> {
  const channelId =
    config.channels?.daily_digest ??
    config.channels?.general ??
    config.defaultChannelId

  if (!channelId) return

  const scoreEmoji = digest.complianceScore >= 80 ? '✅' : digest.complianceScore >= 60 ? '⚠️' : '🔴'
  const activityText =
    digest.recentActivity.length > 0
      ? digest.recentActivity.map((a) => `• ${a}`).join('\n')
      : '• No recent activity'

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📊 Daily Compliance Digest — ${digest.orgName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Compliance Score:*\n${scoreEmoji} ${digest.complianceScore}%` },
        { type: 'mrkdwn', text: `*Open Findings:*\n🔍 ${digest.openFindings} (${digest.criticalFindings} critical)` },
        { type: 'mrkdwn', text: `*Pending Tasks:*\n📝 ${digest.pendingTasks}` },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Recent Activity:*\n${activityText}` },
    },
  ]

  await sendSlackMessage(
    config.botToken,
    channelId,
    `📊 Daily Compliance Digest for ${digest.orgName}: Score ${digest.complianceScore}%`,
    blocks,
  )
}

/**
 * Verify Slack request signature (HMAC-SHA256).
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 */
export async function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  rawBody: string,
): Promise<boolean> {
  try {
    // Reject stale requests (> 5 minutes old)
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false

    const baseString = `v0:${timestamp}:${rawBody}`

    const encoder = new TextEncoder()
    const keyData = encoder.encode(signingSecret)
    const messageData = encoder.encode(baseString)

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData)
    const computedHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const computedSig = `v0=${computedHex}`

    // Constant-time comparison
    if (computedSig.length !== signature.length) return false
    let mismatch = 0
    for (let i = 0; i < computedSig.length; i++) {
      mismatch |= computedSig.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    return mismatch === 0
  } catch {
    return false
  }
}
