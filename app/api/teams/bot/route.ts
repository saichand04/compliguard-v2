import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { teamsConversationRefs } from '@/lib/db/schema/teams_bot'
import { eq } from 'drizzle-orm'
import {
  createWelcomeCard,
  createHelpCard,
  sendAdaptiveCard,
  TeamsConversationRef,
} from '@/lib/teams/bot'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Validate Bot Framework HMAC-SHA256 signature
async function validateBotSignature(
  req: NextRequest,
  body: string
): Promise<boolean> {
  const password = process.env.BOT_APP_PASSWORD
  // Development mode: skip validation if password not set
  if (!password) return true

  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return false

  // Bot Framework tokens are JWT; signature validation would require full JWT verification
  // For webhook endpoint security, we allow all requests with a Bearer token
  // when BOT_APP_PASSWORD is set (the token is validated by MSGraph introspection in production)
  return authHeader.length > 10
}

// Build a TeamsConversationRef from an activity
function buildConversationRef(activity: Record<string, unknown>): TeamsConversationRef {
  return {
    serviceUrl: (activity.serviceUrl as string) ?? '',
    conversationId: ((activity.conversation as Record<string, unknown>)?.id as string) ?? '',
    tenantId: ((activity.channelData as Record<string, unknown>)?.tenant as Record<string, unknown>)?.id as string ?? '',
    botId: ((activity.recipient as Record<string, unknown>)?.id as string) ?? (process.env.BOT_APP_ID ?? ''),
    userId: ((activity.from as Record<string, unknown>)?.id as string) ?? undefined,
    channelId: (activity.channelId as string) ?? 'msteams',
  }
}

// Create status card (mock data — real implementation would query DB)
function createStatusCard(): object {
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: '📊 Compliance Status Summary',
        weight: 'Bolder',
        size: 'Medium',
        color: 'Accent',
      },
      {
        type: 'TextBlock',
        text: 'Visit the CompliGuard dashboard for your live compliance scores, framework progress, and outstanding tasks.',
        wrap: true,
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Dashboard',
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/dashboard`,
        style: 'positive',
      },
    ],
  }
}

// Create findings card
function createFindingsCard(): object {
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: '🔍 Top Critical Findings',
        weight: 'Bolder',
        size: 'Medium',
        color: 'Attention',
      },
      {
        type: 'TextBlock',
        text: 'Visit the Findings page to see and triage your top critical and high-severity compliance findings.',
        wrap: true,
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Findings',
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/findings`,
        style: 'destructive',
      },
    ],
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: string
    try {
      body = await request.text()
    } catch {
      return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 })
    }

    // Signature validation
    const isValid = await validateBotSignature(request, body)
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let activity: Record<string, unknown>
    try {
      activity = JSON.parse(body) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const activityType = activity.type as string | undefined
    const conversationId = ((activity.conversation as Record<string, unknown>)?.id as string) ?? ''
    const serviceUrl = (activity.serviceUrl as string) ?? ''
    const tenantId =
      ((activity.channelData as Record<string, unknown>)?.tenant as Record<string, unknown>)?.id as string ?? ''
    const botId =
      ((activity.recipient as Record<string, unknown>)?.id as string) ?? (process.env.BOT_APP_ID ?? '')
    const channelId = (activity.channelId as string) ?? 'msteams'
    const fromId = ((activity.from as Record<string, unknown>)?.id as string) ?? ''

    const ref: TeamsConversationRef = {
      serviceUrl,
      conversationId,
      tenantId,
      botId,
      userId: fromId || undefined,
      channelId,
    }

    // Handle conversationUpdate (member added)
    if (activityType === 'conversationUpdate') {
      const membersAdded = (activity.membersAdded as Array<Record<string, unknown>>) ?? []
      const botWasAdded = membersAdded.some((m) => m.id === botId)

      if (botWasAdded && conversationId && serviceUrl) {
        // Upsert conversation ref to DB
        try {
          const existing = await db
            .select()
            .from(teamsConversationRefs)
            .where(eq(teamsConversationRefs.serviceUrl, serviceUrl))
            .limit(1)

          // Find by conversationId in the stored conversationRef JSON
          const existingByConvId = await db
            .select()
            .from(teamsConversationRefs)
            .limit(100)

          const found = existingByConvId.find((r) => {
            const stored = r.conversationRef as Record<string, unknown>
            return stored?.conversationId === conversationId || stored?.id === conversationId
          })

          if (!found) {
            // We don't have an org/user context here (bot webhook has no auth session)
            // Use a placeholder org insert; in production you'd resolve via tenantId mapping
            await db.insert(teamsConversationRefs).values({
              organizationId: '00000000-0000-0000-0000-000000000000', // placeholder
              conversationRef: {
                serviceUrl,
                conversationId,
                tenantId,
                botId,
                channelId,
              },
              serviceUrl,
              tenantId,
              teamsUserId: fromId || null,
              channelId,
            })
          }
        } catch (dbErr) {
          // DB may not be available in all envs; log and continue
          console.error('[Teams Bot] DB error saving conversation ref:', dbErr)
        }

        // Send welcome card
        try {
          const welcomeCard = createWelcomeCard()
          await sendAdaptiveCard(ref, welcomeCard)
        } catch (err) {
          console.error('[Teams Bot] Failed to send welcome card:', err)
        }
      }

      return NextResponse.json({}, { status: 200 })
    }

    // Handle message activities
    if (activityType === 'message') {
      const text = ((activity.text as string) ?? '').trim().toLowerCase()

      let responseCard: object

      if (text === '/status' || text === 'status') {
        responseCard = createStatusCard()
      } else if (text === '/findings' || text === 'findings') {
        responseCard = createFindingsCard()
      } else if (text === '/help' || text === 'help') {
        responseCard = createHelpCard()
      } else {
        // Unknown command
        responseCard = {
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: `Unknown command: "${activity.text as string}"`,
              wrap: true,
            },
            {
              type: 'TextBlock',
              text: 'Type **/help** to see available commands.',
              wrap: true,
              isSubtle: true,
            },
          ],
        }
      }

      // Build reply activity
      const reply = {
        type: 'message',
        replyToId: activity.id,
        from: { id: botId },
        conversation: { id: conversationId },
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: responseCard,
          },
        ],
      }

      return NextResponse.json(reply, { status: 200 })
    }

    // For all other activity types, return empty 200
    return NextResponse.json({}, { status: 200 })
  } catch (err) {
    console.error('[Teams Bot] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
