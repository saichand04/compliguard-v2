/**
 * lib/integrations/notify.ts
 * Shared notification helper — sends Slack notifications after findings/evidence requests.
 */

import { getIntegrationConfig } from '@/lib/integrations/store'
import { notifyFinding, notifyEvidenceRequest, type SlackConfig } from '@/lib/integrations/slack'

function buildViewUrl(findingId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
  return `${appUrl}/findings/${findingId}`
}

function buildUploadUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
  return `${appUrl}/upload/${token}`
}

function parseSlackConfig(raw: Record<string, string>): SlackConfig | null {
  if (!raw.botToken || !raw.signingSecret) return null

  let channels: SlackConfig['channels'] | undefined
  try {
    if (raw.channels) {
      channels = JSON.parse(raw.channels) as SlackConfig['channels']
    }
  } catch {
    // ignore
  }

  return {
    botToken: raw.botToken,
    signingSecret: raw.signingSecret,
    defaultChannelId: raw.defaultChannelId,
    channels,
  }
}

/**
 * Called after a finding is created — sends a Slack notification if configured.
 */
export async function notifyNewFinding(
  orgId: string,
  finding: {
    title: string
    severity: string
    source: string
    description: string
    id: string
  },
): Promise<void> {
  try {
    const raw = await getIntegrationConfig(orgId, 'slack')
    if (!raw) return

    const config = parseSlackConfig(raw)
    if (!config) return

    // Check notification preferences — skip if this severity is disabled
    let notifPrefs: Record<string, boolean> = {}
    try {
      if (raw.notificationPreferences) {
        notifPrefs = JSON.parse(raw.notificationPreferences) as Record<string, boolean>
      }
    } catch {
      // ignore
    }

    const prefKey = `findings_${finding.severity.toLowerCase()}`
    if (prefKey in notifPrefs && !notifPrefs[prefKey]) return

    await notifyFinding(config, {
      title: finding.title,
      severity: finding.severity,
      source: finding.source,
      description: finding.description || '',
      viewUrl: buildViewUrl(finding.id),
    })
  } catch (err) {
    // Notification failures must never break the main request
    console.error('[notify] notifyNewFinding error:', err)
  }
}

/**
 * Called after an evidence request is created — sends a Slack notification if configured.
 */
export async function notifyEvidenceRequestCreated(
  orgId: string,
  request: {
    title: string
    controlName?: string
    requestedBy: string
    uploadUrl: string
    expiresAt: Date
  },
): Promise<void> {
  try {
    const raw = await getIntegrationConfig(orgId, 'slack')
    if (!raw) return

    const config = parseSlackConfig(raw)
    if (!config) return

    // Check notification preferences
    let notifPrefs: Record<string, boolean> = {}
    try {
      if (raw.notificationPreferences) {
        notifPrefs = JSON.parse(raw.notificationPreferences) as Record<string, boolean>
      }
    } catch {
      // ignore
    }

    if ('evidence_requests' in notifPrefs && !notifPrefs['evidence_requests']) return

    await notifyEvidenceRequest(config, {
      title: request.title,
      controlName: request.controlName || 'N/A',
      requestedBy: request.requestedBy,
      uploadUrl: request.uploadUrl || buildUploadUrl(''),
      expiresAt: request.expiresAt,
    })
  } catch (err) {
    console.error('[notify] notifyEvidenceRequestCreated error:', err)
  }
}
