/**
 * Teams Bot webhook endpoint — Phase 7.2 (enhanced)
 *
 * Activity types handled:
 *   conversationUpdate  → save conversation ref, send enhanced welcome card
 *   message             → command dispatcher (Phase 7.3 commands)
 *   invoke              → adaptive card action.submit (approve/reject evidence)
 *
 * Auth: Public endpoint (no session). Bot Framework bearer token validation.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { teamsConversationRefs } from '@/lib/db/schema/teams_bot'
import { eq, and } from 'drizzle-orm'
import {
  createWelcomeCard,
  sendAdaptiveCard,
  validateBotJwt,
  assertAllowedServiceUrl,
  isAllowedServiceUrl,
  type TeamsConversationRef,
  type AdaptiveCard,
} from '@/lib/teams/bot'
import { handleApproveEvidence, handleRejectEvidence } from '@/lib/teams/approvals'
import {
  COMMANDS,
  handleComplianceCommand,
  handleControlCommand,
  handleRisksCommand,
  handleTasksCommand,
  handleFindingsCommand,
  handlePolicyCommand,
  handleHelpCommand,
  buildUnknownCommandCard,
} from '@/lib/teams/commands'

export const dynamic = 'force-dynamic'

// ─── Bot Framework token validation (C6.5) ───────────────────────────────────
//
// Real JWT verification lives in lib/teams/bot.ts (validateBotJwt). It pulls
// signing keys from https://login.botframework.com/v1/.well-known/keys, checks
// iss === 'https://api.botframework.com', aud === BOT_APP_ID, and nbf/exp.
//
// In production both BOT_APP_ID and BOT_APP_PASSWORD must be set or we fail
// closed. In non-production we allow only when NEXTAUTH_URL is http://localhost*.

async function validateBotSignature(req: NextRequest): Promise<{ ok: boolean; reason?: string }> {
  const authHeader = req.headers.get('authorization')
  return validateBotJwt(authHeader)
}

// ─── Activity helpers ─────────────────────────────────────────────────────────

function buildConversationRef(activity: Record<string, unknown>): TeamsConversationRef {
  const conversation = (activity.conversation as Record<string, unknown>) ?? {}
  const channelData = (activity.channelData as Record<string, unknown>) ?? {}
  const tenant = (channelData.tenant as Record<string, unknown>) ?? {}
  const recipient = (activity.recipient as Record<string, unknown>) ?? {}
  const from = (activity.from as Record<string, unknown>) ?? {}

  return {
    serviceUrl: (activity.serviceUrl as string) ?? '',
    conversationId: (conversation.id as string) ?? '',
    tenantId: (tenant.id as string) ?? '',
    botId: (recipient.id as string) ?? (process.env.BOT_APP_ID ?? ''),
    userId: (from.id as string) || undefined,
    channelId: (activity.channelId as string) ?? 'msteams',
  }
}

/** Send a reply activity back through the Bot Framework REST API. */
async function postActivityReply(
  serviceUrl: string,
  conversationId: string,
  activity: Record<string, unknown>
): Promise<void> {
  const url = `${serviceUrl.replace(/\/$/, '')}/v3/conversations/${encodeURIComponent(conversationId)}/activities`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[Teams Bot] Failed to post reply activity: ${res.status} ${text}`)
    }
  } catch (err) {
    console.error('[Teams Bot] Error posting reply activity:', err)
  }
}

/** Build a standard message reply with an adaptive card attachment. */
function buildCardReply(
  activity: Record<string, unknown>,
  card: AdaptiveCard
): Record<string, unknown> {
  const recipient = (activity.recipient as Record<string, unknown>) ?? {}
  const from = (activity.from as Record<string, unknown>) ?? {}
  const conversation = (activity.conversation as Record<string, unknown>) ?? {}

  return {
    type: 'message',
    replyToId: activity.id,
    from: { id: recipient.id, name: recipient.name },
    conversation: { id: conversation.id },
    recipient: { id: from.id, name: from.name },
    text: '',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: card,
      },
    ],
  }
}

// ─── Org lookup ───────────────────────────────────────────────────────────────

/**
 * Resolve orgId from a stored conversation ref.
 * Returns null if not found — bot may not be fully installed yet.
 */
async function getOrgIdFromConversation(conversationId: string): Promise<string | null> {
  try {
    const rows = await db.select().from(teamsConversationRefs).limit(200)
    const match = rows.find((r) => {
      const stored = r.conversationRef as Record<string, unknown>
      return (
        (stored?.conversationId as string) === conversationId ||
        (stored?.id as string) === conversationId
      )
    })
    return match?.organizationId ?? null
  } catch (err) {
    console.error('[Teams Bot] DB error looking up orgId:', err)
    return null
  }
}

// ─── Enhanced welcome card ────────────────────────────────────────────────────

function createEnhancedWelcomeCard(): AdaptiveCard {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'
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
        text: "Hello! I'm your CompliGuard compliance assistant. I provide real-time alerts and instant access to your compliance posture directly in Teams.",
        wrap: true,
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: '**Quick Start Commands:**',
        weight: 'Bolder',
        spacing: 'Medium',
      },
      {
        type: 'FactSet',
        facts: Object.entries(COMMANDS).map(([cmd, desc]) => ({
          title: cmd,
          value: desc,
        })),
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
        title: 'Open Dashboard',
        url: `${appUrl}/dashboard`,
        style: 'positive',
      },
      {
        type: 'Action.OpenUrl',
        title: 'View Findings',
        url: `${appUrl}/findings`,
      },
      {
        type: 'Action.OpenUrl',
        title: 'View Tasks',
        url: `${appUrl}/tasks`,
      },
    ],
  }
}

// ─── Command dispatcher ───────────────────────────────────────────────────────

async function handleMessage(
  activity: Record<string, unknown>,
  orgId: string | null
): Promise<AdaptiveCard> {
  const rawText = ((activity.text as string) ?? '').trim()
  // Strip HTML tags that Teams sometimes injects
  const text = rawText.replace(/<[^>]+>/g, '').trim()
  const lower = text.toLowerCase()

  // /help always works — no DB needed
  if (lower === '/help' || lower === 'help') {
    return handleHelpCommand()
  }

  // Legacy /status command (backward compat with Phase 5.9)
  if (lower === '/status' || lower === 'status') {
    if (!orgId) return orgNotFoundCard()
    return handleComplianceCommand(orgId)
  }

  // /compliance
  if (lower.startsWith('/compliance')) {
    if (!orgId) return orgNotFoundCard()
    return handleComplianceCommand(orgId)
  }

  // /control <id or name>
  if (lower.startsWith('/control')) {
    if (!orgId) return orgNotFoundCard()
    const args = text.slice('/control'.length).trim()
    return handleControlCommand(orgId, args)
  }

  // /risks
  if (lower.startsWith('/risks') || lower === '/risk') {
    if (!orgId) return orgNotFoundCard()
    return handleRisksCommand(orgId)
  }

  // /tasks
  if (lower.startsWith('/tasks') || lower === '/task') {
    if (!orgId) return orgNotFoundCard()
    const ref = buildConversationRef(activity)
    return handleTasksCommand(orgId, ref.userId)
  }

  // /findings
  if (lower.startsWith('/findings') || lower === '/finding') {
    if (!orgId) return orgNotFoundCard()
    return handleFindingsCommand(orgId)
  }

  // /policy
  if (lower.startsWith('/policy') || lower === '/policies') {
    if (!orgId) return orgNotFoundCard()
    return handlePolicyCommand(orgId)
  }

  // Unknown command → "Did you mean?" suggestion
  return buildUnknownCommandCard(text)
}

// ─── invoke action handler ────────────────────────────────────────────────────

async function handleInvokeAction(
  activity: Record<string, unknown>,
  orgId: string | null
): Promise<AdaptiveCard> {
  const value = (activity.value as Record<string, unknown>) ?? {}
  const action = value.action as string | undefined
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'

  // C7: orgId MUST come from the stored conversation ref. We deliberately
  // ignore any value.orgId from the inbound activity — a malicious caller
  // could otherwise pivot into another tenant's data.
  if (!orgId) return orgNotFoundCard()

  if (action === 'approve_evidence') {
    const evidenceId = value.evidenceId as string | undefined
    if (!evidenceId) {
      return {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type: 'TextBlock', text: '⚠️ Missing Evidence ID', weight: 'Bolder', size: 'Medium', color: 'Warning' },
        ],
      }
    }
    // handleApproveEvidence performs the org-scoped row lookup itself; if the
    // evidence row does not belong to `orgId` it returns ok:false.
    const result = await handleApproveEvidence(evidenceId, orgId)
    if (result.updatedCard) return result.updatedCard
    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        { type: 'TextBlock', text: result.ok ? '✅ Approved' : '⚠️ Could not approve', weight: 'Bolder', size: 'Medium', color: result.ok ? 'Good' : 'Warning' },
        { type: 'TextBlock', text: result.message, wrap: true },
      ],
      actions: [
        { type: 'Action.OpenUrl', title: 'View Evidence', url: `${appUrl}/evidence`, style: 'positive' },
      ],
    }
  }

  if (action === 'reject_evidence') {
    const evidenceId = value.evidenceId as string | undefined
    if (!evidenceId) {
      return {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type: 'TextBlock', text: '⚠️ Missing Evidence ID', weight: 'Bolder', size: 'Medium', color: 'Warning' },
        ],
      }
    }
    const result = await handleRejectEvidence(evidenceId, orgId)
    if (result.updatedCard) return result.updatedCard
    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        { type: 'TextBlock', text: result.ok ? '❌ Rejected' : '⚠️ Could not reject', weight: 'Bolder', size: 'Medium', color: result.ok ? 'Attention' : 'Warning' },
        { type: 'TextBlock', text: result.message, wrap: true },
      ],
      actions: [
        { type: 'Action.OpenUrl', title: 'View Controls', url: `${appUrl}/controls` },
      ],
    }
  }

  // Unknown invoke action
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      { type: 'TextBlock', text: '⚠️ Unknown Action', weight: 'Bolder', size: 'Medium', color: 'Warning' },
      { type: 'TextBlock', text: `Unrecognized action: "${action ?? 'unknown'}". Please use the CompliGuard dashboard.`, wrap: true },
    ],
    actions: [{ type: 'Action.OpenUrl', title: 'Open CompliGuard', url: appUrl }],
  }
}

function orgNotFoundCard(): AdaptiveCard {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      { type: 'TextBlock', text: '⚠️ Organization Not Configured', weight: 'Bolder', size: 'Medium', color: 'Warning' },
      {
        type: 'TextBlock',
        text: 'This Teams conversation is not linked to a CompliGuard organization yet. Please complete the setup in CompliGuard Settings → Teams Bot.',
        wrap: true,
      },
    ],
    actions: [
      { type: 'Action.OpenUrl', title: 'CompliGuard Settings', url: `${appUrl}/settings`, style: 'positive' },
    ],
  }
}

// ─── Main POST handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Read body first (can only be read once)
    let body: string
    try {
      body = await request.text()
    } catch {
      return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 })
    }

    // Bot Framework signature validation (C6.5)
    const auth = await validateBotSignature(request)
    if (!auth.ok) {
      console.warn('[Teams Bot] Rejected request:', auth.reason ?? 'invalid token')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let activity: Record<string, unknown>
    try {
      activity = JSON.parse(body) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const activityType = activity.type as string | undefined
    const ref = buildConversationRef(activity)
    const { conversationId, serviceUrl } = ref

    console.log(`[Teams Bot] Received activity type=${activityType} conv=${conversationId}`)

    // C6: refuse any activity whose serviceUrl is not a Microsoft Bot Framework
    // endpoint. This blocks an attacker who forges an inbound activity hoping
    // sendAdaptiveCard / postActivityReply will POST our bearer token to them.
    if (serviceUrl && !isAllowedServiceUrl(serviceUrl)) {
      console.warn('[Teams Bot] Rejecting activity — serviceUrl not in allowlist:', serviceUrl)
      return NextResponse.json({ error: 'Forbidden serviceUrl' }, { status: 400 })
    }

    // ── conversationUpdate: bot added to conversation ──────────────────────────
    if (activityType === 'conversationUpdate') {
      const membersAdded = (activity.membersAdded as Array<Record<string, unknown>>) ?? []
      const botWasAdded = membersAdded.some((m) => m.id === ref.botId)

      if (botWasAdded && conversationId && serviceUrl) {
        // Upsert conversation ref to DB
        try {
          const allRefs = await db.select().from(teamsConversationRefs).limit(500)
          const existing = allRefs.find((r) => {
            const stored = r.conversationRef as Record<string, unknown>
            return (
              (stored?.conversationId as string) === conversationId ||
              (stored?.id as string) === conversationId
            )
          })

          if (!existing) {
            await db.insert(teamsConversationRefs).values({
              organizationId: '00000000-0000-0000-0000-000000000000',
              conversationRef: {
                serviceUrl,
                conversationId,
                tenantId: ref.tenantId,
                botId: ref.botId,
                channelId: ref.channelId,
              },
              serviceUrl,
              tenantId: ref.tenantId || null,
              teamsUserId: ref.userId || null,
              channelId: ref.channelId,
            })
            console.log(`[Teams Bot] Saved conversation ref: ${conversationId}`)
          }
        } catch (dbErr) {
          console.error('[Teams Bot] DB error saving conversation ref:', dbErr)
        }

        // Send enhanced welcome card
        try {
          const welcomeCard = createEnhancedWelcomeCard()
          await sendAdaptiveCard(ref, welcomeCard)
        } catch (err) {
          console.error('[Teams Bot] Failed to send welcome card:', err)
        }
      }

      return NextResponse.json({}, { status: 200 })
    }

    // ── message: command dispatcher ───────────────────────────────────────────
    if (activityType === 'message') {
      // Look up org from conversation ref
      const orgId = await getOrgIdFromConversation(conversationId)
      // Use real org if found, but not the placeholder
      const resolvedOrgId =
        orgId && orgId !== '00000000-0000-0000-0000-000000000000' ? orgId : null

      const card = await handleMessage(activity, resolvedOrgId)
      const reply = buildCardReply(activity, card)

      // Return reply inline (Bot Framework will deliver it)
      return NextResponse.json(reply, { status: 200 })
    }

    // ── invoke: adaptive card action.submit ───────────────────────────────────
    if (activityType === 'invoke') {
      const orgId = await getOrgIdFromConversation(conversationId)
      const resolvedOrgId =
        orgId && orgId !== '00000000-0000-0000-0000-000000000000' ? orgId : null

      const card = await handleInvokeAction(activity, resolvedOrgId)
      const reply = buildCardReply(activity, card)

      return NextResponse.json(reply, { status: 200 })
    }

    // All other activity types — acknowledge with 200
    return NextResponse.json({}, { status: 200 })
  } catch (err) {
    console.error('[Teams Bot] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
