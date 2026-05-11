/**
 * Microsoft Teams Bot Framework integration
 * Uses direct HTTP calls to Bot Framework REST API (no botbuilder dependency)
 */
import { db } from '@/lib/db'
import { teamsConversationRefs } from '@/lib/db/schema/teams_bot'
import { eq, and, lt, sql } from 'drizzle-orm'
import { createRemoteJWKSet, jwtVerify } from 'jose'

// ─── serviceUrl allowlist (C6) ───────────────────────────────────────────────
//
// Bot Framework always delivers requests with serviceUrl pointing at a
// Microsoft-controlled Bot Framework REST endpoint. Anything else is either
// misrouted or an attacker-controlled URL planted via a forged activity.
//
// Static allowlist: exact hostnames Microsoft publishes for global + GCC.
// Wildcards: per-region traffic-manager nodes and api.botframework.com regional
// children all live under botframework.com / trafficmanager.net.
const SERVICE_URL_HOST_ALLOWLIST = new Set<string>([
  'smba.trafficmanager.net',
  'api.botframework.com',
  // GovCloud equivalents
  'smba.infra.gov.teams.microsoft.us',
  'api.botframework.us',
])

const SERVICE_URL_HOST_SUFFIX_ALLOWLIST = [
  '.botframework.com',
  '.botframework.us',
  '.trafficmanager.net',
]

/**
 * Validate that a Bot Framework serviceUrl points at a Microsoft-controlled
 * endpoint. Returns the URL object if allowed, throws otherwise.
 *
 * Must be called BEFORE any outbound fetch built from a stored or inbound
 * conversation reference.
 */
export function assertAllowedServiceUrl(serviceUrl: string): URL {
  let url: URL
  try {
    url = new URL(serviceUrl)
  } catch {
    throw new Error(`[Teams Bot] Invalid serviceUrl: ${serviceUrl}`)
  }
  if (url.protocol !== 'https:') {
    throw new Error(`[Teams Bot] serviceUrl must be https: ${serviceUrl}`)
  }
  const host = url.hostname.toLowerCase()
  if (SERVICE_URL_HOST_ALLOWLIST.has(host)) return url
  if (SERVICE_URL_HOST_SUFFIX_ALLOWLIST.some((s) => host.endsWith(s))) return url
  throw new Error(`[Teams Bot] serviceUrl host not in allowlist: ${host}`)
}

export function isAllowedServiceUrl(serviceUrl: string): boolean {
  try {
    assertAllowedServiceUrl(serviceUrl)
    return true
  } catch {
    return false
  }
}

// ─── Bot Framework JWT validation (C6.5) ─────────────────────────────────────
//
// Bot Framework signs requests with a JWT in `Authorization: Bearer …` using
// keys published at https://login.botframework.com/v1/.well-known/keys.
// We cache the JWKS at module scope (jose handles HTTP-level caching).

const BOT_FRAMEWORK_ISSUER = 'https://api.botframework.com'
const BOT_FRAMEWORK_JWKS_URL = 'https://login.botframework.com/v1/.well-known/keys'

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getBotFrameworkJwks() {
  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(new URL(BOT_FRAMEWORK_JWKS_URL), {
      // jose caches keys & honors cache-control; we just keep one JWKS set alive
      cacheMaxAge: 24 * 60 * 60 * 1000, // 24h
      cooldownDuration: 60_000,
    })
  }
  return cachedJwks
}

export interface BotJwtValidationResult {
  ok: boolean
  reason?: string
}

/**
 * Validate a Bot Framework Authorization header.
 *
 * In production:
 *   - BOT_APP_ID and BOT_APP_PASSWORD MUST be set; otherwise fail closed.
 *   - JWT must be signed by JWKS at BOT_FRAMEWORK_JWKS_URL.
 *   - iss must be https://api.botframework.com
 *   - aud must equal BOT_APP_ID
 *   - nbf/exp must be valid.
 *
 * In non-production:
 *   - If BOT_APP_PASSWORD is unset, allow only if NEXTAUTH_URL is http://localhost*
 *     (i.e. local dev). Otherwise still require a valid JWT.
 */
export async function validateBotJwt(
  authHeader: string | null | undefined,
): Promise<BotJwtValidationResult> {
  const isProd = process.env.NODE_ENV === 'production'
  const appId = process.env.BOT_APP_ID
  const appPassword = process.env.BOT_APP_PASSWORD

  if (!appId || !appPassword) {
    if (isProd) {
      return { ok: false, reason: 'BOT_APP_ID/BOT_APP_PASSWORD not configured' }
    }
    const nextAuthUrl = process.env.NEXTAUTH_URL ?? ''
    if (nextAuthUrl.startsWith('http://localhost')) {
      // Local dev bypass — allow request through without JWT validation.
      return { ok: true }
    }
    return { ok: false, reason: 'BOT credentials not configured outside localhost dev' }
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, reason: 'Missing or malformed Authorization header' }
  }
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return { ok: false, reason: 'Empty bearer token' }

  try {
    const jwks = getBotFrameworkJwks()
    await jwtVerify(token, jwks, {
      issuer: BOT_FRAMEWORK_ISSUER,
      audience: appId,
      // jose will enforce nbf/exp automatically; allow small clock skew.
      clockTolerance: 300,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: `JWT verification failed: ${(err as Error).message}` }
  }
}

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
  // C6: refuse outbound to non-Microsoft service URLs.
  assertAllowedServiceUrl(ref.serviceUrl)
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
  // C6: refuse outbound to non-Microsoft service URLs.
  assertAllowedServiceUrl(ref.serviceUrl)
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

// ─── 7.7 Daily Digest Card ─────────────────────────────────────────────────

export interface DigestData {
  orgName: string
  date: string
  complianceScore: number
  scoreChange: number
  criticalFindings: number
  newFindingsToday: number
  tasksOverdue: number
  tasksDueToday: number
  topFrameworks: Array<{ name: string; score: number; trend: 'up' | 'down' | 'stable' }>
  pendingEvidence: number
  recentActivity: Array<{ type: string; title: string; time: string }>
}

export function createDailyDigestCard(data: DigestData): AdaptiveCard {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'

  const scoreColor = data.complianceScore >= 80 ? 'Good' : data.complianceScore >= 60 ? 'Warning' : 'Attention'
  const deltaSymbol = data.scoreChange >= 0 ? '↑' : '↓'
  const deltaText = `${deltaSymbol} ${Math.abs(data.scoreChange).toFixed(1)}% vs yesterday`
  const deltaColor = data.scoreChange >= 0 ? 'Good' : 'Attention'

  const activityTypeIcon = (type: string): string => {
    if (type.includes('evidence')) return '📎'
    if (type.includes('finding')) return '🔍'
    if (type.includes('task')) return '📋'
    if (type.includes('risk')) return '⚠️'
    if (type.includes('policy')) return '📄'
    return '🔔'
  }

  const trendArrow = (trend: 'up' | 'down' | 'stable') =>
    trend === 'up' ? ' ↑' : trend === 'down' ? ' ↓' : ' →'

  const frameworkRows = data.topFrameworks.slice(0, 3).map((fw) => ({
    type: 'ColumnSet',
    columns: [
      {
        type: 'Column',
        width: 'stretch',
        items: [
          {
            type: 'TextBlock',
            text: fw.name,
            size: 'Small',
            color: 'Default',
          },
        ],
      },
      {
        type: 'Column',
        width: 'auto',
        items: [
          {
            type: 'TextBlock',
            text: `${fw.score}%${trendArrow(fw.trend)}`,
            size: 'Small',
            weight: 'Bolder',
            color: fw.score >= 80 ? 'Good' : fw.score >= 60 ? 'Warning' : 'Attention',
            horizontalAlignment: 'Right',
          },
        ],
      },
    ],
    spacing: 'Small',
  }))

  const activityItems = data.recentActivity.slice(0, 3).map((a) => ({
    type: 'ColumnSet',
    columns: [
      {
        type: 'Column',
        width: 'auto',
        items: [{ type: 'TextBlock', text: activityTypeIcon(a.type), size: 'Small' }],
      },
      {
        type: 'Column',
        width: 'stretch',
        items: [
          {
            type: 'TextBlock',
            text: a.title,
            size: 'Small',
            wrap: true,
            maxLines: 1,
          },
        ],
      },
      {
        type: 'Column',
        width: 'auto',
        items: [
          {
            type: 'TextBlock',
            text: a.time,
            size: 'Small',
            isSubtle: true,
            horizontalAlignment: 'Right',
          },
        ],
      },
    ],
    spacing: 'Small',
  }))

  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      // Header
      {
        type: 'Container',
        style: 'emphasis',
        items: [
          {
            type: 'TextBlock',
            text: `☀️ Good Morning — CompliGuard Daily Digest`,
            weight: 'Bolder',
            size: 'Medium',
            color: 'Accent',
          },
          {
            type: 'TextBlock',
            text: data.date,
            size: 'Small',
            isSubtle: true,
            spacing: 'None',
          },
          {
            type: 'TextBlock',
            text: data.orgName,
            size: 'Small',
            weight: 'Bolder',
            spacing: 'None',
          },
        ],
      },
      // Compliance Score
      {
        type: 'ColumnSet',
        spacing: 'Medium',
        columns: [
          {
            type: 'Column',
            width: 'stretch',
            items: [
              {
                type: 'TextBlock',
                text: 'COMPLIANCE SCORE',
                size: 'Small',
                weight: 'Bolder',
                isSubtle: true,
              },
              {
                type: 'TextBlock',
                text: `${data.complianceScore}%`,
                size: 'ExtraLarge',
                weight: 'Bolder',
                color: scoreColor,
                spacing: 'None',
              },
              {
                type: 'TextBlock',
                text: deltaText,
                size: 'Small',
                color: deltaColor,
                spacing: 'None',
              },
            ],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              {
                type: 'TextBlock',
                text: 'KEY METRICS',
                size: 'Small',
                weight: 'Bolder',
                isSubtle: true,
              },
              {
                type: 'FactSet',
                facts: [
                  { title: '🔴 Critical', value: `${data.criticalFindings}` },
                  { title: '📋 Overdue Tasks', value: `${data.tasksOverdue}` },
                  { title: '📎 Pending Evidence', value: `${data.pendingEvidence}` },
                  { title: '✨ New Today', value: `${data.newFindingsToday}` },
                ],
                spacing: 'Small',
              },
            ],
          },
        ],
      },
      // Framework health
      {
        type: 'TextBlock',
        text: 'FRAMEWORK HEALTH',
        size: 'Small',
        weight: 'Bolder',
        isSubtle: true,
        spacing: 'Medium',
      },
      ...frameworkRows,
      // Recent activity
      {
        type: 'TextBlock',
        text: 'RECENT ACTIVITY',
        size: 'Small',
        weight: 'Bolder',
        isSubtle: true,
        spacing: 'Medium',
      },
      ...activityItems,
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Dashboard',
        url: `${appUrl}/dashboard`,
        style: 'positive',
      },
      {
        type: 'Action.OpenUrl',
        title: 'See All Findings',
        url: `${appUrl}/findings`,
      },
    ],
  }
}

// ─── 7.8 Conversation Reference Management ─────────────────────────────────

export interface TeamsActivity {
  serviceUrl: string
  channelData?: { tenant?: { id?: string } }
  conversation?: { id?: string; tenantId?: string }
  from?: { id?: string }
  channelId?: string
}

export async function saveConversationRef(activity: TeamsActivity, orgId: string): Promise<void> {
  const conversationId =
    activity.conversation?.id ?? ''
  const serviceUrl = activity.serviceUrl ?? ''
  const tenantId =
    activity.channelData?.tenant?.id ??
    activity.conversation?.tenantId ??
    ''
  const channelId = activity.channelId ?? 'msteams'
  const userId = activity.from?.id ?? null
  const botId = process.env.BOT_APP_ID ?? ''

  if (!conversationId || !serviceUrl) return

  // C6: refuse to persist a conversation ref with an attacker-controlled
  // serviceUrl. We never want sendAdaptiveCard to be tricked into POSTing
  // bot tokens to e.g. attacker.example.com.
  if (!isAllowedServiceUrl(serviceUrl)) {
    console.warn('[Teams Bot] Rejecting saveConversationRef — serviceUrl not in allowlist:', serviceUrl)
    return
  }

  const conversationRef = { conversationId, botId, tenantId }

  // Check for existing record with this conversationId for this org
  const existing = await db
    .select({ id: teamsConversationRefs.id })
    .from(teamsConversationRefs)
    .where(
      and(
        eq(teamsConversationRefs.organizationId, orgId),
        sql`conversation_ref->>'conversationId' = ${conversationId}`
      )
    )
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(teamsConversationRefs)
      .set({
        serviceUrl,
        conversationRef,
        channelId,
        updatedAt: new Date(),
      })
      .where(eq(teamsConversationRefs.id, existing[0].id))
  } else {
    await db.insert(teamsConversationRefs).values({
      organizationId: orgId,
      conversationRef,
      serviceUrl,
      tenantId,
      channelId,
      teamsUserId: userId,
    })
  }
}

export async function deactivateConversationRef(
  conversationId: string,
  orgId: string
): Promise<void> {
  // Mark as deactivated by deleting (schema has no isActive column)
  // We use delete since schema doesn't have isActive; callers should use delete API instead
  await db
    .delete(teamsConversationRefs)
    .where(
      and(
        eq(teamsConversationRefs.organizationId, orgId),
        sql`conversation_ref->>'conversationId' = ${conversationId}`
      )
    )
}

export async function getActiveConversationRefs(
  orgId: string
): Promise<Array<typeof teamsConversationRefs.$inferSelect>> {
  return db
    .select()
    .from(teamsConversationRefs)
    .where(eq(teamsConversationRefs.organizationId, orgId))
}

export async function pruneStaleConversationRefs(
  orgId: string,
  daysStale: number = 30
): Promise<number> {
  const cutoff = new Date(Date.now() - daysStale * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(teamsConversationRefs)
    .where(
      and(
        eq(teamsConversationRefs.organizationId, orgId),
        lt(teamsConversationRefs.updatedAt, cutoff)
      )
    )
    .returning({ id: teamsConversationRefs.id })
  return deleted.length
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7.4 — Rich Adaptive Card builders
// ─────────────────────────────────────────────────────────────────────────────

export interface FrameworkData {
  name: string
  shortName: string
  totalControls: number
  implemented: number
  tested: number
  notStarted: number
  score: number // 0-100
}

export interface ControlData {
  id: string
  title: string
  identifier: string
  framework: string
  category: string
  status: 'not_started' | 'in_progress' | 'implemented' | 'tested' | 'not_applicable'
  description: string
  assignee?: string
  dueDate?: string
  evidenceCount: number
  findingsCount: number
  nistReference?: string
}

export interface RiskData {
  critical: number
  high: number
  medium: number
  low: number
  overdueTasks: number
  totalOpenFindings: number
  topRisks: Array<{ title: string; severity: string; source: string }>
  frameworks: Array<{ name: string; score: number }>
}

export interface EvidenceData {
  id: string
  title: string
  controlTitle: string
  controlId: string
  uploadedBy: string
  uploadedAt: string
  fileType: string
  description?: string
  orgId: string
}

export interface TaskData {
  id: string
  title: string
  description?: string
  dueDate: string
  status: string
  priority?: string
  assigneeName?: string
  controlTitle?: string
  daysOverdue: number
}

/**
 * Build a Unicode progress bar (10 chars wide).
 * e.g. score=75 → "███████░░░ 75%"
 */
function buildProgressBar(score: number): string {
  const filled = Math.round(score / 10)
  const empty = 10 - filled
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${score}%`
}

/**
 * Score to Adaptive Card color keyword.
 */
function scoreToColor(score: number): string {
  if (score > 75) return 'Good'
  if (score >= 50) return 'Warning'
  return 'Attention'
}

/**
 * Score to status dot.
 */
function scoreToDot(score: number): string {
  if (score > 75) return '🟢'
  if (score >= 50) return '🟡'
  return '🔴'
}

/**
 * Create a framework progress overview card.
 */
export function createFrameworkProgressCard(frameworks: FrameworkData[]): AdaptiveCard {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const frameworkBlocks: object[] = frameworks.flatMap((fw) => [
    {
      type: 'ColumnSet',
      spacing: 'Small',
      columns: [
        {
          type: 'Column',
          width: 'auto',
          items: [
            {
              type: 'TextBlock',
              text: scoreToDot(fw.score),
              size: 'Small',
            },
          ],
        },
        {
          type: 'Column',
          width: 'stretch',
          items: [
            {
              type: 'TextBlock',
              text: `**${fw.shortName}** — ${fw.name}`,
              wrap: true,
              size: 'Small',
            },
            {
              type: 'TextBlock',
              text: buildProgressBar(fw.score),
              fontType: 'Monospace',
              color: scoreToColor(fw.score),
              size: 'Small',
              spacing: 'None',
            },
            {
              type: 'TextBlock',
              text: `✅ ${fw.implemented} implemented · 🧪 ${fw.tested} tested · ⬜ ${fw.notStarted} not started`,
              size: 'ExtraSmall',
              isSubtle: true,
              spacing: 'None',
              wrap: true,
            },
          ],
        },
      ],
    },
    { type: 'Separator' },
  ])

  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: '📊 Compliance Framework Progress',
        weight: 'Bolder',
        size: 'Large',
        color: 'Accent',
      },
      {
        type: 'TextBlock',
        text: now,
        size: 'Small',
        isSubtle: true,
        spacing: 'None',
      },
      { type: 'Separator', spacing: 'Medium' },
      ...frameworkBlocks,
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Details',
        url: `${appUrl}/integrations`,
        style: 'positive',
      },
    ],
  }
}

/**
 * Status badge text for control status.
 */
function controlStatusBadge(status: ControlData['status']): { label: string; color: string } {
  const map: Record<ControlData['status'], { label: string; color: string }> = {
    implemented: { label: '✅ Implemented', color: 'Good' },
    tested: { label: '🧪 Tested', color: 'Good' },
    in_progress: { label: '🔄 In Progress', color: 'Warning' },
    not_started: { label: '⬜ Not Started', color: 'Default' },
    not_applicable: { label: '➖ N/A', color: 'Default' },
  }
  return map[status] ?? { label: status, color: 'Default' }
}

/**
 * Create a rich control detail card.
 */
export function createControlDetailCard(control: ControlData): AdaptiveCard {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'
  const badge = controlStatusBadge(control.status)
  const descTruncated =
    control.description.length > 200
      ? control.description.slice(0, 197) + '…'
      : control.description

  const statsItems: string[] = [
    `📎 ${control.evidenceCount} evidence`,
    `⚠️ ${control.findingsCount} findings`,
  ]
  if (control.assignee) statsItems.push(`👤 ${control.assignee}`)

  const bodyItems: object[] = [
    {
      type: 'ColumnSet',
      columns: [
        {
          type: 'Column',
          width: 'stretch',
          items: [
            {
              type: 'TextBlock',
              text: `**[${control.identifier}]** ${control.title}`,
              weight: 'Bolder',
              size: 'Medium',
              wrap: true,
            },
          ],
        },
        {
          type: 'Column',
          width: 'auto',
          items: [
            {
              type: 'TextBlock',
              text: control.framework,
              size: 'Small',
              color: 'Accent',
              weight: 'Bolder',
            },
          ],
        },
      ],
    },
    {
      type: 'TextBlock',
      text: badge.label,
      color: badge.color,
      weight: 'Bolder',
      size: 'Small',
      spacing: 'Small',
    },
    {
      type: 'TextBlock',
      text: `**Category:** ${control.category}`,
      size: 'Small',
      isSubtle: true,
      spacing: 'None',
    },
    { type: 'Separator' },
    {
      type: 'TextBlock',
      text: descTruncated,
      wrap: true,
      size: 'Small',
    },
    { type: 'Separator' },
    {
      type: 'TextBlock',
      text: statsItems.join('  |  '),
      size: 'Small',
      wrap: true,
    },
  ]

  if (control.dueDate) {
    bodyItems.push({
      type: 'TextBlock',
      text: `📅 Due: ${control.dueDate}`,
      size: 'Small',
      isSubtle: true,
      spacing: 'None',
    })
  }

  if (control.nistReference) {
    bodyItems.push({
      type: 'TextBlock',
      text: `🔗 NIST ref: ${control.nistReference}`,
      size: 'Small',
      isSubtle: true,
      spacing: 'None',
    })
  }

  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: bodyItems,
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Control',
        url: `${appUrl}/frameworks`,
        style: 'positive',
      },
      {
        type: 'Action.OpenUrl',
        title: 'Add Evidence',
        url: `${appUrl}/evidence`,
      },
      {
        type: 'Action.OpenUrl',
        title: 'Create Finding',
        url: `${appUrl}/findings`,
        style: 'destructive',
      },
    ],
  }
}

/**
 * Create a risk summary card.
 */
export function createRiskSummaryCard(risk: RiskData): AdaptiveCard {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'
  const now = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const topRiskBlocks: object[] = risk.topRisks.slice(0, 3).map((r) => {
    const sevDot =
      r.severity === 'critical' ? '🔴' :
      r.severity === 'high' ? '🟠' :
      r.severity === 'medium' ? '🟡' : '🟢'
    return {
      type: 'TextBlock',
      text: `${sevDot} **${r.title}** — *${r.source}*`,
      wrap: true,
      size: 'Small',
      spacing: 'Small',
    }
  })

  const atRiskFrameworks = risk.frameworks.filter((f) => f.score < 70)

  const bodyItems: object[] = [
    {
      type: 'TextBlock',
      text: '⚠️ Risk Summary',
      weight: 'Bolder',
      size: 'Large',
      color: 'Attention',
    },
    {
      type: 'TextBlock',
      text: now,
      size: 'Small',
      isSubtle: true,
      spacing: 'None',
    },
    { type: 'Separator', spacing: 'Medium' },
    {
      type: 'ColumnSet',
      columns: [
        {
          type: 'Column',
          width: 'stretch',
          items: [{ type: 'TextBlock', text: `🔴 **${risk.critical}** Critical`, size: 'Small', wrap: true }],
        },
        {
          type: 'Column',
          width: 'stretch',
          items: [{ type: 'TextBlock', text: `🟠 **${risk.high}** High`, size: 'Small', wrap: true }],
        },
        {
          type: 'Column',
          width: 'stretch',
          items: [{ type: 'TextBlock', text: `🟡 **${risk.medium}** Medium`, size: 'Small', wrap: true }],
        },
        {
          type: 'Column',
          width: 'stretch',
          items: [{ type: 'TextBlock', text: `🟢 **${risk.low}** Low`, size: 'Small', wrap: true }],
        },
      ],
    },
    {
      type: 'TextBlock',
      text: `📋 ${risk.totalOpenFindings} open findings · ⏰ ${risk.overdueTasks} overdue tasks`,
      size: 'Small',
      isSubtle: true,
      spacing: 'Small',
    },
  ]

  if (topRiskBlocks.length > 0) {
    bodyItems.push({ type: 'Separator', spacing: 'Medium' })
    bodyItems.push({
      type: 'TextBlock',
      text: '**Top Risks**',
      weight: 'Bolder',
      size: 'Small',
    })
    bodyItems.push(...topRiskBlocks)
  }

  if (atRiskFrameworks.length > 0) {
    bodyItems.push({ type: 'Separator', spacing: 'Medium' })
    bodyItems.push({
      type: 'TextBlock',
      text: '**Frameworks at Risk (< 70%)**',
      weight: 'Bolder',
      size: 'Small',
    })
    atRiskFrameworks.forEach((fw) => {
      bodyItems.push({
        type: 'TextBlock',
        text: `🔴 ${fw.name}: ${buildProgressBar(fw.score)}`,
        fontType: 'Monospace',
        size: 'Small',
        spacing: 'Small',
        color: 'Attention',
      })
    })
  }

  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: bodyItems,
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View All Findings',
        url: `${appUrl}/findings`,
        style: 'destructive',
      },
    ],
  }
}

/**
 * Create an evidence approval request card with Submit actions.
 */
export function createEvidenceApprovalCard(evidence: EvidenceData): AdaptiveCard {
  const descTruncated = evidence.description
    ? evidence.description.length > 150
      ? evidence.description.slice(0, 147) + '…'
      : evidence.description
    : null

  const bodyItems: object[] = [
    {
      type: 'TextBlock',
      text: '📋 Evidence Review Request',
      weight: 'Bolder',
      size: 'Large',
      color: 'Accent',
    },
    { type: 'Separator' },
    {
      type: 'TextBlock',
      text: `**Control:** ${evidence.controlTitle}`,
      weight: 'Bolder',
      wrap: true,
    },
    {
      type: 'TextBlock',
      text: `🏷️ Control ID: ${evidence.controlId}`,
      size: 'Small',
      isSubtle: true,
      spacing: 'None',
    },
    { type: 'Separator' },
    {
      type: 'FactSet',
      facts: [
        { title: 'Evidence', value: evidence.title },
        { title: 'Uploaded by', value: evidence.uploadedBy },
        { title: 'Date', value: evidence.uploadedAt },
        { title: 'File type', value: evidence.fileType },
      ],
    },
  ]

  if (descTruncated) {
    bodyItems.push({
      type: 'TextBlock',
      text: descTruncated,
      wrap: true,
      size: 'Small',
      isSubtle: true,
    })
  }

  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: bodyItems,
    actions: [
      {
        type: 'Action.Submit',
        title: '✓ Approve',
        style: 'positive',
        data: {
          action: 'approve_evidence',
          evidenceId: evidence.id,
          orgId: evidence.orgId,
        },
      },
      {
        type: 'Action.Submit',
        title: '✗ Reject',
        style: 'destructive',
        data: {
          action: 'reject_evidence',
          evidenceId: evidence.id,
          orgId: evidence.orgId,
        },
      },
    ],
  }
}

/**
 * Create an approved/rejected evidence result card (no action buttons).
 */
export function createEvidenceResultCard(
  evidence: Pick<EvidenceData, 'id' | 'title' | 'controlTitle'>,
  result: 'approved' | 'rejected'
): AdaptiveCard {
  const isApproved = result === 'approved'
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: isApproved ? '✅ Evidence Approved' : '❌ Evidence Rejected',
        weight: 'Bolder',
        size: 'Medium',
        color: isApproved ? 'Good' : 'Attention',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Evidence', value: evidence.title },
          { title: 'Control', value: evidence.controlTitle },
          { title: 'Status', value: isApproved ? '✓ Approved by Teams' : '✗ Rejected via Teams' },
          { title: 'Time', value: new Date().toLocaleString() },
        ],
      },
    ],
  }
}

/**
 * Create a task reminder card.
 */
export function createTaskReminderCard(task: TaskData): AdaptiveCard {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'
  const isOverdue = task.daysOverdue > 0
  const isDueToday = task.daysOverdue === 0

  const titleColor = isOverdue ? 'Attention' : isDueToday ? 'Warning' : 'Default'
  const titlePrefix = isOverdue ? '⏰' : isDueToday ? '📅' : '🔔'

  const bodyItems: object[] = [
    {
      type: 'TextBlock',
      text: `${titlePrefix} Task Reminder`,
      weight: 'Bolder',
      size: 'Large',
      color: titleColor,
    },
    { type: 'Separator' },
    {
      type: 'TextBlock',
      text: `**${task.title}**`,
      weight: 'Bolder',
      wrap: true,
    },
    {
      type: 'ColumnSet',
      spacing: 'Small',
      columns: [
        {
          type: 'Column',
          width: 'auto',
          items: [
            {
              type: 'TextBlock',
              text: `Status: **${task.status}**`,
              size: 'Small',
            },
          ],
        },
        ...(task.priority
          ? [
              {
                type: 'Column',
                width: 'auto',
                items: [
                  {
                    type: 'TextBlock',
                    text: `Priority: **${task.priority.toUpperCase()}**`,
                    size: 'Small',
                    color:
                      task.priority === 'urgent' ? 'Attention' :
                      task.priority === 'high' ? 'Warning' : 'Default',
                  },
                ],
              },
            ]
          : []),
      ],
    },
    {
      type: 'TextBlock',
      text: isOverdue
        ? `📅 Due: ${task.dueDate} — ⚠️ **${task.daysOverdue} day${task.daysOverdue !== 1 ? 's' : ''} overdue**`
        : isDueToday
        ? `📅 Due: ${task.dueDate} — Due today!`
        : `📅 Due: ${task.dueDate}`,
      wrap: true,
      color: isOverdue ? 'Attention' : isDueToday ? 'Warning' : 'Default',
      size: 'Small',
      spacing: 'Small',
    },
  ]

  if (task.assigneeName) {
    bodyItems.push({
      type: 'TextBlock',
      text: `👤 Assigned to: ${task.assigneeName}`,
      size: 'Small',
      isSubtle: true,
      spacing: 'None',
    })
  }

  if (task.controlTitle) {
    bodyItems.push({
      type: 'TextBlock',
      text: `🔗 Control: ${task.controlTitle}`,
      size: 'Small',
      isSubtle: true,
      spacing: 'None',
    })
  }

  if (task.description) {
    bodyItems.push({
      type: 'TextBlock',
      text: task.description.length > 150 ? task.description.slice(0, 147) + '…' : task.description,
      wrap: true,
      size: 'Small',
      spacing: 'Small',
      isSubtle: true,
    })
  }

  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: bodyItems,
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Task',
        url: `${appUrl}/tasks`,
        style: 'positive',
      },
      {
        type: 'Action.Submit',
        title: 'Mark Done',
        style: 'positive',
        data: {
          action: 'mark_task_done',
          taskId: task.id,
        },
      },
    ],
  }
}
