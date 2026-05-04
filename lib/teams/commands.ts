/**
 * Teams Bot slash command handlers — Phase 7.3
 * Each handler queries actual DB data and returns an AdaptiveCard.
 */
import { db } from '@/lib/db'
import { eq, and, desc, lt, lte, gte, inArray, ilike, or, sql, count } from 'drizzle-orm'
import { frameworks, controls, controlAssignments, organizationFrameworks } from '@/lib/db/schema/frameworks'
import { findings } from '@/lib/db/schema/findings'
import { tasks } from '@/lib/db/schema/tasks'
import type { AdaptiveCard } from '@/lib/teams/bot'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'

// ─── Command Map ─────────────────────────────────────────────────────────────

export const COMMANDS: Record<string, string> = {
  '/compliance': 'Show overall compliance score and framework breakdown',
  '/control': 'Look up a specific control (usage: /control AC-1)',
  '/risks': 'Show current risk summary — critical and high findings',
  '/tasks': 'Show your overdue and upcoming tasks',
  '/findings': 'Show recent open findings',
  '/policy': 'Show policy status and expiring policies',
  '/help': 'Show all available commands',
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
  info: 'ℹ️',
}

const STATUS_EMOJI: Record<string, string> = {
  not_started: '⏸',
  in_progress: '🔄',
  implemented: '✅',
  needs_review: '⚠️',
  not_applicable: '🚫',
}

const PRIORITY_EMOJI: Record<string, string> = {
  urgent: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return 'N/A'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncate(str: string | null | undefined, max = 80): string {
  if (!str) return 'N/A'
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

// ─── /compliance ──────────────────────────────────────────────────────────────

export async function handleComplianceCommand(orgId: string): Promise<AdaptiveCard> {
  try {
    // Fetch active frameworks for this org
    const orgFrameworks = await db
      .select({
        frameworkId: organizationFrameworks.frameworkId,
        frameworkName: frameworks.name,
        frameworkShortName: frameworks.shortName,
      })
      .from(organizationFrameworks)
      .innerJoin(frameworks, eq(organizationFrameworks.frameworkId, frameworks.id))
      .where(
        and(
          eq(organizationFrameworks.organizationId, orgId),
          eq(organizationFrameworks.isActive, true)
        )
      )

    if (orgFrameworks.length === 0) {
      return {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type: 'TextBlock', text: '📊 Compliance Overview', weight: 'Bolder', size: 'Medium', color: 'Accent' },
          { type: 'TextBlock', text: 'No active compliance frameworks found. Add frameworks in CompliGuard to track your compliance posture.', wrap: true },
        ],
        actions: [
          { type: 'Action.OpenUrl', title: 'Add Frameworks', url: `${APP_URL}/frameworks`, style: 'positive' },
        ],
      }
    }

    // For each framework, count control assignments by status
    const frameworkStats: Array<{
      name: string
      shortName: string
      total: number
      implemented: number
      notApplicable: number
      score: number
    }> = []

    let totalAll = 0
    let implementedAll = 0

    for (const fw of orgFrameworks) {
      const rows = await db
        .select({
          status: controlAssignments.status,
          cnt: count(),
        })
        .from(controlAssignments)
        .innerJoin(controls, eq(controlAssignments.controlId, controls.id))
        .where(
          and(
            eq(controlAssignments.organizationId, orgId),
            eq(controls.frameworkId, fw.frameworkId)
          )
        )
        .groupBy(controlAssignments.status)

      let total = 0
      let implemented = 0
      let notApplicable = 0

      for (const row of rows) {
        const n = Number(row.cnt)
        total += n
        if (row.status === 'implemented') implemented += n
        if (row.status === 'not_applicable') notApplicable += n
      }

      const denominator = total - notApplicable
      const score = denominator > 0 ? Math.round((implemented / denominator) * 100) : 0

      frameworkStats.push({
        name: fw.frameworkName,
        shortName: fw.frameworkShortName ?? fw.frameworkName,
        total,
        implemented,
        notApplicable,
        score,
      })

      totalAll += total - notApplicable
      implementedAll += implemented
    }

    const overallScore = totalAll > 0 ? Math.round((implementedAll / totalAll) * 100) : 0

    const scoreColor = overallScore >= 80 ? 'Good' : overallScore >= 60 ? 'Warning' : 'Attention'

    const frameworkFacts = frameworkStats.map((fw) => ({
      title: fw.shortName,
      value: `${fw.implemented}/${fw.total - fw.notApplicable} controls — ${fw.score}%`,
    }))

    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        { type: 'TextBlock', text: '📊 Compliance Overview', weight: 'Bolder', size: 'Medium', color: 'Accent' },
        {
          type: 'TextBlock',
          text: `Overall Score: **${overallScore}%**`,
          size: 'Large',
          weight: 'Bolder',
          color: scoreColor,
        },
        { type: 'TextBlock', text: 'Framework Breakdown:', weight: 'Bolder', spacing: 'Medium' },
        {
          type: 'FactSet',
          facts: frameworkFacts.length > 0 ? frameworkFacts : [{ title: 'Info', value: 'No control assignments found.' }],
        },
      ],
      actions: [
        { type: 'Action.OpenUrl', title: 'View Dashboard', url: `${APP_URL}/dashboard`, style: 'positive' },
        { type: 'Action.OpenUrl', title: 'View Frameworks', url: `${APP_URL}/frameworks` },
      ],
    }
  } catch (err) {
    console.error('[Teams Commands] handleComplianceCommand error:', err)
    return errorCard('compliance data')
  }
}

// ─── /control ─────────────────────────────────────────────────────────────────

export async function handleControlCommand(orgId: string, args: string): Promise<AdaptiveCard> {
  try {
    if (!args.trim()) {
      return {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type: 'TextBlock', text: '🔒 Control Lookup', weight: 'Bolder', size: 'Medium', color: 'Accent' },
          { type: 'TextBlock', text: 'Please specify a control ID or name.\n\nExamples:\n• `/control AC-1`\n• `/control CC6.1`\n• `/control access control policy`', wrap: true },
        ],
        actions: [
          { type: 'Action.OpenUrl', title: 'View Controls', url: `${APP_URL}/controls` },
        ],
      }
    }

    const query = args.trim()

    // First, try exact control ID match across controls in org's active frameworks
    const orgFrameworkIds = await db
      .select({ frameworkId: organizationFrameworks.frameworkId })
      .from(organizationFrameworks)
      .where(
        and(
          eq(organizationFrameworks.organizationId, orgId),
          eq(organizationFrameworks.isActive, true)
        )
      )

    const fwIds = orgFrameworkIds.map((r) => r.frameworkId)

    if (fwIds.length === 0) {
      return notFoundCard(query, 'No active frameworks found for your organization.')
    }

    // Search by exact controlId first, then by title ILIKE
    const exactMatches = await db
      .select({
        id: controls.id,
        controlId: controls.controlId,
        title: controls.title,
        description: controls.description,
        category: controls.category,
        frameworkId: controls.frameworkId,
        frameworkName: frameworks.name,
        frameworkShortName: frameworks.shortName,
      })
      .from(controls)
      .innerJoin(frameworks, eq(controls.frameworkId, frameworks.id))
      .where(
        and(
          inArray(controls.frameworkId, fwIds),
          ilike(controls.controlId, query)
        )
      )
      .limit(1)

    let matched = exactMatches[0]

    if (!matched) {
      // Try title ILIKE
      const titleMatches = await db
        .select({
          id: controls.id,
          controlId: controls.controlId,
          title: controls.title,
          description: controls.description,
          category: controls.category,
          frameworkId: controls.frameworkId,
          frameworkName: frameworks.name,
          frameworkShortName: frameworks.shortName,
        })
        .from(controls)
        .innerJoin(frameworks, eq(controls.frameworkId, frameworks.id))
        .where(
          and(
            inArray(controls.frameworkId, fwIds),
            ilike(controls.title, `%${query}%`)
          )
        )
        .limit(1)

      matched = titleMatches[0]
    }

    if (!matched) {
      return notFoundCard(query)
    }

    // Fetch control assignment for this org
    const assignment = await db
      .select()
      .from(controlAssignments)
      .where(
        and(
          eq(controlAssignments.organizationId, orgId),
          eq(controlAssignments.controlId, matched.id)
        )
      )
      .limit(1)

    const asgn = assignment[0]
    const status = asgn?.status ?? 'not_started'
    const statusEmoji = STATUS_EMOJI[status] ?? '⏸'
    const statusLabel = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    // Count open findings linked to this control (via title keyword match as proxy)
    const linkedFindings = await db
      .select({ cnt: count() })
      .from(findings)
      .where(
        and(
          eq(findings.organizationId, orgId),
          eq(findings.status, 'open'),
          ilike(findings.title, `%${matched.controlId ?? matched.title}%`)
        )
      )

    const findingCount = Number(linkedFindings[0]?.cnt ?? 0)

    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `🔒 Control: ${matched.controlId ?? ''} — ${matched.title}`,
          weight: 'Bolder',
          size: 'Medium',
          color: 'Accent',
          wrap: true,
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Framework', value: matched.frameworkShortName ?? matched.frameworkName },
            { title: 'Category', value: matched.category ?? 'N/A' },
            { title: 'Status', value: `${statusEmoji} ${statusLabel}` },
            { title: 'Assignee', value: asgn ? 'Assigned' : 'Unassigned' },
            { title: 'Due Date', value: fmtDate(asgn?.dueDate) },
            { title: 'Completed', value: fmtDate(asgn?.completedAt) },
            { title: 'Open Findings', value: String(findingCount) },
          ],
        },
        ...(matched.description
          ? [
              { type: 'TextBlock', text: 'Description:', weight: 'Bolder', spacing: 'Medium' },
              { type: 'TextBlock', text: truncate(matched.description, 250), wrap: true, isSubtle: true },
            ]
          : []),
      ],
      actions: [
        { type: 'Action.OpenUrl', title: 'View Control', url: `${APP_URL}/controls`, style: 'positive' },
        ...(findingCount > 0
          ? [{ type: 'Action.OpenUrl', title: `View ${findingCount} Finding${findingCount > 1 ? 's' : ''}`, url: `${APP_URL}/findings` }]
          : []),
      ],
    }
  } catch (err) {
    console.error('[Teams Commands] handleControlCommand error:', err)
    return errorCard('control data')
  }
}

// ─── /risks ───────────────────────────────────────────────────────────────────

export async function handleRisksCommand(orgId: string): Promise<AdaptiveCard> {
  try {
    const OPEN_STATUSES = ['open', 'in_remediation'] as const

    // Count by severity
    const severityCounts = await db
      .select({ severity: findings.severity, cnt: count() })
      .from(findings)
      .where(
        and(
          eq(findings.organizationId, orgId),
          inArray(findings.status, ['open', 'in_remediation'])
        )
      )
      .groupBy(findings.severity)

    const countMap: Record<string, number> = {}
    for (const row of severityCounts) {
      countMap[row.severity] = Number(row.cnt)
    }

    const totalOpen = Object.values(countMap).reduce((a, b) => a + b, 0)

    // Top 5 critical + high findings
    const topFindings = await db
      .select({
        id: findings.id,
        title: findings.title,
        severity: findings.severity,
        source: findings.source,
        affectedAsset: findings.affectedAsset,
        resourceId: findings.resourceId,
        createdAt: findings.createdAt,
      })
      .from(findings)
      .where(
        and(
          eq(findings.organizationId, orgId),
          inArray(findings.status, ['open', 'in_remediation']),
          inArray(findings.severity, ['critical', 'high'])
        )
      )
      .orderBy(
        sql`CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END`,
        findings.createdAt
      )
      .limit(5)

    if (totalOpen === 0) {
      return {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type: 'TextBlock', text: '✅ No Open Risks', weight: 'Bolder', size: 'Medium', color: 'Good' },
          { type: 'TextBlock', text: 'No open or in-remediation findings. Great work!', wrap: true },
        ],
        actions: [{ type: 'Action.OpenUrl', title: 'View Findings', url: `${APP_URL}/findings`, style: 'positive' }],
      }
    }

    const summaryFacts = [
      { title: `${SEVERITY_EMOJI.critical} Critical`, value: String(countMap.critical ?? 0) },
      { title: `${SEVERITY_EMOJI.high} High`, value: String(countMap.high ?? 0) },
      { title: `${SEVERITY_EMOJI.medium} Medium`, value: String(countMap.medium ?? 0) },
      { title: `${SEVERITY_EMOJI.low} Low`, value: String(countMap.low ?? 0) },
      { title: `${SEVERITY_EMOJI.info} Info`, value: String(countMap.info ?? 0) },
    ]

    const findingBlocks = topFindings.flatMap((f, i) => {
      const emoji = SEVERITY_EMOJI[f.severity] ?? '●'
      const asset = f.affectedAsset ?? f.resourceId ?? 'N/A'
      return [
        {
          type: 'TextBlock',
          text: `${emoji} **[${f.severity.toUpperCase()}]** ${truncate(f.title, 70)}`,
          wrap: true,
          spacing: i === 0 ? 'Medium' : 'Small',
        },
        {
          type: 'TextBlock',
          text: `Source: ${f.source} | Asset: ${truncate(asset, 50)}`,
          wrap: true,
          isSubtle: true,
          size: 'Small',
          spacing: 'None',
        },
      ]
    })

    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        { type: 'TextBlock', text: `⚠️ Risk Summary — ${totalOpen} Open Finding${totalOpen !== 1 ? 's' : ''}`, weight: 'Bolder', size: 'Medium', color: 'Attention' },
        { type: 'TextBlock', text: 'Severity Breakdown:', weight: 'Bolder', spacing: 'Medium' },
        { type: 'FactSet', facts: summaryFacts },
        ...(topFindings.length > 0
          ? [
              { type: 'TextBlock', text: 'Top Critical/High Findings:', weight: 'Bolder', spacing: 'Medium' },
              ...findingBlocks,
            ]
          : []),
      ],
      actions: [
        { type: 'Action.OpenUrl', title: 'View All Findings', url: `${APP_URL}/findings`, style: 'destructive' },
        { type: 'Action.OpenUrl', title: 'Risk Dashboard', url: `${APP_URL}/dashboard` },
      ],
    }
  } catch (err) {
    console.error('[Teams Commands] handleRisksCommand error:', err)
    return errorCard('risk data')
  }
}

// ─── /tasks ───────────────────────────────────────────────────────────────────

export async function handleTasksCommand(orgId: string, userId?: string): Promise<AdaptiveCard> {
  try {
    const now = new Date()
    const nextWeek = new Date(now)
    nextWeek.setDate(now.getDate() + 7)

    // Overdue tasks
    const overdueTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, orgId),
          lt(tasks.dueDate, now),
          inArray(tasks.status, ['todo', 'in_progress', 'blocked'])
        )
      )
      .orderBy(
        sql`CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`,
        tasks.dueDate
      )
      .limit(5)

    // Upcoming tasks (due within 7 days, not overdue)
    const upcomingTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, orgId),
          gte(tasks.dueDate, now),
          lte(tasks.dueDate, nextWeek),
          inArray(tasks.status, ['todo', 'in_progress', 'blocked'])
        )
      )
      .orderBy(tasks.dueDate)
      .limit(5)

    if (overdueTasks.length === 0 && upcomingTasks.length === 0) {
      return {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type: 'TextBlock', text: '✅ No Overdue Tasks', weight: 'Bolder', size: 'Medium', color: 'Good' },
          { type: 'TextBlock', text: 'You have no overdue tasks and nothing due in the next 7 days.', wrap: true },
        ],
        actions: [{ type: 'Action.OpenUrl', title: 'View All Tasks', url: `${APP_URL}/tasks`, style: 'positive' }],
      }
    }

    function taskDaysDiff(dueDate: Date | null | undefined): string {
      if (!dueDate) return ''
      const diffMs = now.getTime() - dueDate.getTime()
      const diffDays = Math.floor(diffMs / 86400000)
      return diffDays > 0 ? ` (${diffDays}d overdue)` : ''
    }

    const overdueBlocks = overdueTasks.flatMap((t, i) => {
      const emoji = PRIORITY_EMOJI[t.priority] ?? '●'
      const statusLabel = t.status.replace(/_/g, ' ')
      return [
        {
          type: 'TextBlock',
          text: `${emoji} **[${t.priority.toUpperCase()}]** ${truncate(t.title, 65)}`,
          wrap: true,
          spacing: i === 0 ? 'None' : 'Small',
        },
        {
          type: 'TextBlock',
          text: `Status: ${statusLabel} | Due: ${fmtDate(t.dueDate)}${taskDaysDiff(t.dueDate ?? undefined)}`,
          wrap: true,
          isSubtle: true,
          size: 'Small',
          spacing: 'None',
        },
      ]
    })

    const upcomingBlocks = upcomingTasks.flatMap((t, i) => {
      const emoji = PRIORITY_EMOJI[t.priority] ?? '●'
      const statusLabel = t.status.replace(/_/g, ' ')
      return [
        {
          type: 'TextBlock',
          text: `${emoji} **[${t.priority.toUpperCase()}]** ${truncate(t.title, 65)}`,
          wrap: true,
          spacing: i === 0 ? 'None' : 'Small',
        },
        {
          type: 'TextBlock',
          text: `Status: ${statusLabel} | Due: ${fmtDate(t.dueDate ?? undefined)}`,
          wrap: true,
          isSubtle: true,
          size: 'Small',
          spacing: 'None',
        },
      ]
    })

    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        { type: 'TextBlock', text: '📋 Compliance Tasks', weight: 'Bolder', size: 'Medium', color: 'Accent' },
        ...(overdueTasks.length > 0
          ? [
              {
                type: 'TextBlock',
                text: `⏰ Overdue (${overdueTasks.length}):`,
                weight: 'Bolder',
                color: 'Attention',
                spacing: 'Medium',
              },
              ...overdueBlocks,
            ]
          : []),
        ...(upcomingTasks.length > 0
          ? [
              {
                type: 'TextBlock',
                text: `📅 Due This Week (${upcomingTasks.length}):`,
                weight: 'Bolder',
                spacing: 'Medium',
              },
              ...upcomingBlocks,
            ]
          : []),
      ],
      actions: [
        { type: 'Action.OpenUrl', title: 'View All Tasks', url: `${APP_URL}/tasks`, style: 'positive' },
        { type: 'Action.OpenUrl', title: 'Create Task', url: `${APP_URL}/tasks?new=1` },
      ],
    }
  } catch (err) {
    console.error('[Teams Commands] handleTasksCommand error:', err)
    return errorCard('task data')
  }
}

// ─── /findings ────────────────────────────────────────────────────────────────

export async function handleFindingsCommand(orgId: string): Promise<AdaptiveCard> {
  try {
    const openFindings = await db
      .select({
        id: findings.id,
        title: findings.title,
        severity: findings.severity,
        source: findings.source,
        affectedAsset: findings.affectedAsset,
        resourceId: findings.resourceId,
        createdAt: findings.createdAt,
      })
      .from(findings)
      .where(and(eq(findings.organizationId, orgId), eq(findings.status, 'open')))
      .orderBy(
        sql`CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`,
        desc(findings.createdAt)
      )
      .limit(10)

    // Count total open
    const totalRows = await db
      .select({ cnt: count() })
      .from(findings)
      .where(and(eq(findings.organizationId, orgId), eq(findings.status, 'open')))

    const totalOpen = Number(totalRows[0]?.cnt ?? 0)

    if (openFindings.length === 0) {
      return {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type: 'TextBlock', text: '✅ No Open Findings', weight: 'Bolder', size: 'Medium', color: 'Good' },
          { type: 'TextBlock', text: 'No open findings found. Great work!', wrap: true },
        ],
        actions: [{ type: 'Action.OpenUrl', title: 'View Findings', url: `${APP_URL}/findings`, style: 'positive' }],
      }
    }

    const findingBlocks = openFindings.flatMap((f, i) => {
      const emoji = SEVERITY_EMOJI[f.severity] ?? '●'
      const asset = f.affectedAsset ?? f.resourceId ?? 'N/A'
      const dateStr = fmtDate(f.createdAt)
      return [
        {
          type: 'TextBlock',
          text: `${emoji} **[${f.severity.toUpperCase()}]** ${truncate(f.title, 65)}`,
          wrap: true,
          spacing: i === 0 ? 'None' : 'Small',
        },
        {
          type: 'TextBlock',
          text: `Source: ${f.source} | Asset: ${truncate(asset, 40)} | ${dateStr}`,
          wrap: true,
          isSubtle: true,
          size: 'Small',
          spacing: 'None',
        },
      ]
    })

    const headerText = totalOpen > 10
      ? `🔍 Recent Open Findings (10 of ${totalOpen} total)`
      : `🔍 Open Findings (${totalOpen})`

    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        { type: 'TextBlock', text: headerText, weight: 'Bolder', size: 'Medium', color: 'Attention' },
        ...findingBlocks,
      ],
      actions: [
        { type: 'Action.OpenUrl', title: 'View All Findings', url: `${APP_URL}/findings`, style: 'destructive' },
        { type: 'Action.OpenUrl', title: 'Triage Findings', url: `${APP_URL}/findings?filter=open` },
      ],
    }
  } catch (err) {
    console.error('[Teams Commands] handleFindingsCommand error:', err)
    return errorCard('findings data')
  }
}

// ─── /policy ──────────────────────────────────────────────────────────────────

export async function handlePolicyCommand(orgId: string): Promise<AdaptiveCard> {
  try {
    // Get org's active framework IDs
    const orgFrameworkIds = await db
      .select({ frameworkId: organizationFrameworks.frameworkId })
      .from(organizationFrameworks)
      .where(
        and(
          eq(organizationFrameworks.organizationId, orgId),
          eq(organizationFrameworks.isActive, true)
        )
      )

    const fwIds = orgFrameworkIds.map((r) => r.frameworkId)

    // Find policy-related controls
    let policyControls: Array<{
      id: string
      controlId: string | null
      title: string
      category: string | null
      frameworkShortName: string | null
      frameworkName: string
      status: string | null
    }> = []

    if (fwIds.length > 0) {
      const rawControls = await db
        .select({
          id: controls.id,
          controlId: controls.controlId,
          title: controls.title,
          category: controls.category,
          frameworkId: controls.frameworkId,
          frameworkName: frameworks.name,
          frameworkShortName: frameworks.shortName,
        })
        .from(controls)
        .innerJoin(frameworks, eq(controls.frameworkId, frameworks.id))
        .where(
          and(
            inArray(controls.frameworkId, fwIds),
            or(
              ilike(controls.category, '%policy%'),
              ilike(controls.title, '%policy%')
            )
          )
        )
        .limit(10)

      // Fetch assignments for these controls
      const controlIds = rawControls.map((c) => c.id)

      const assignmentMap: Record<string, string> = {}
      if (controlIds.length > 0) {
        const assignments = await db
          .select({ controlId: controlAssignments.controlId, status: controlAssignments.status })
          .from(controlAssignments)
          .where(
            and(
              eq(controlAssignments.organizationId, orgId),
              inArray(controlAssignments.controlId, controlIds)
            )
          )
        for (const a of assignments) {
          assignmentMap[a.controlId] = a.status
        }
      }

      policyControls = rawControls.map((c) => ({
        ...c,
        status: assignmentMap[c.id] ?? 'not_started',
      }))
    }

    // Find policy-related findings
    const policyFindings = await db
      .select({
        id: findings.id,
        title: findings.title,
        severity: findings.severity,
        createdAt: findings.createdAt,
      })
      .from(findings)
      .where(
        and(
          eq(findings.organizationId, orgId),
          eq(findings.status, 'open'),
          ilike(findings.title, '%policy%')
        )
      )
      .orderBy(
        sql`CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`
      )
      .limit(5)

    if (policyControls.length === 0 && policyFindings.length === 0) {
      return {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type: 'TextBlock', text: '📄 Policy Status', weight: 'Bolder', size: 'Medium', color: 'Accent' },
          {
            type: 'TextBlock',
            text: 'No policy-related controls or findings found. Assign controls in the Controls section to track policy compliance.',
            wrap: true,
          },
        ],
        actions: [{ type: 'Action.OpenUrl', title: 'View Controls', url: `${APP_URL}/controls` }],
      }
    }

    const controlFacts = policyControls.map((c) => {
      const emoji = STATUS_EMOJI[c.status ?? 'not_started'] ?? '⏸'
      return {
        title: `${c.frameworkShortName ?? c.frameworkName} ${c.controlId ?? ''}`,
        value: `${emoji} ${truncate(c.title, 50)}`,
      }
    })

    const findingBlocks = policyFindings.flatMap((f, i) => {
      const emoji = SEVERITY_EMOJI[f.severity] ?? '●'
      return [
        {
          type: 'TextBlock',
          text: `${emoji} [${f.severity.toUpperCase()}] ${truncate(f.title, 70)}`,
          wrap: true,
          spacing: i === 0 ? 'None' : 'Small',
        },
        {
          type: 'TextBlock',
          text: `Created: ${fmtDate(f.createdAt)}`,
          isSubtle: true,
          size: 'Small',
          spacing: 'None',
        },
      ]
    })

    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `📄 Policy Status`,
          weight: 'Bolder',
          size: 'Medium',
          color: 'Accent',
        },
        ...(policyControls.length > 0
          ? [
              {
                type: 'TextBlock',
                text: `Policy-Related Controls (${policyControls.length}):`,
                weight: 'Bolder',
                spacing: 'Medium',
              },
              { type: 'FactSet', facts: controlFacts },
            ]
          : []),
        ...(policyFindings.length > 0
          ? [
              {
                type: 'TextBlock',
                text: `Policy-Related Findings (${policyFindings.length} open):`,
                weight: 'Bolder',
                spacing: 'Medium',
                color: 'Attention',
              },
              ...findingBlocks,
            ]
          : []),
      ],
      actions: [
        { type: 'Action.OpenUrl', title: 'View Controls', url: `${APP_URL}/controls`, style: 'positive' },
        { type: 'Action.OpenUrl', title: 'View Findings', url: `${APP_URL}/findings` },
      ],
    }
  } catch (err) {
    console.error('[Teams Commands] handlePolicyCommand error:', err)
    return errorCard('policy data')
  }
}

// ─── /help ────────────────────────────────────────────────────────────────────

export function handleHelpCommand(): AdaptiveCard {
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      { type: 'TextBlock', text: '🛡️ CompliGuard Bot — Available Commands', weight: 'Bolder', size: 'Medium', color: 'Accent' },
      { type: 'TextBlock', text: 'Type any command below to get started:', wrap: true, spacing: 'Small' },
      {
        type: 'FactSet',
        spacing: 'Medium',
        facts: [
          { title: '/compliance', value: 'Overall compliance score and framework breakdown' },
          { title: '/control <id>', value: 'Look up a control by ID or name (e.g. /control AC-1)' },
          { title: '/risks', value: 'Current risk summary — critical and high findings' },
          { title: '/tasks', value: 'Overdue and upcoming compliance tasks' },
          { title: '/findings', value: 'Recent open findings sorted by severity' },
          { title: '/policy', value: 'Policy-related controls and findings' },
          { title: '/help', value: 'Show this help message' },
        ],
      },
      {
        type: 'TextBlock',
        text: 'You also receive automatic notifications for new findings, compliance score changes, incidents, and overdue tasks.',
        wrap: true,
        isSubtle: true,
        spacing: 'Medium',
      },
    ],
    actions: [
      { type: 'Action.OpenUrl', title: 'Open CompliGuard', url: `${APP_URL}/dashboard`, style: 'positive' },
    ],
  }
}

// ─── "Did you mean?" unknown command ─────────────────────────────────────────

export function buildUnknownCommandCard(originalText: string): AdaptiveCard {
  const text = originalText.toLowerCase()

  // Simple keyword → command suggestions
  const suggestions: Array<{ command: string; description: string }> = []

  if (text.includes('compli') || text.includes('score') || text.includes('framework') || text.includes('percent')) {
    suggestions.push({ command: '/compliance', description: 'Show compliance score' })
  }
  if (text.includes('finding') || text.includes('vuln') || text.includes('issue') || text.includes('alert')) {
    suggestions.push({ command: '/findings', description: 'Show open findings' })
  }
  if (text.includes('risk') || text.includes('critical') || text.includes('danger') || text.includes('threat')) {
    suggestions.push({ command: '/risks', description: 'Show risk summary' })
  }
  if (text.includes('task') || text.includes('todo') || text.includes('overdue') || text.includes('due')) {
    suggestions.push({ command: '/tasks', description: 'Show tasks' })
  }
  if (text.includes('policy') || text.includes('polic')) {
    suggestions.push({ command: '/policy', description: 'Show policy status' })
  }
  if (text.includes('control') || text.includes('ctrl') || text.includes('ac-') || text.includes('cc')) {
    suggestions.push({ command: '/control', description: 'Look up a control' })
  }
  if (text.includes('help') || text.includes('command') || text.includes('what')) {
    suggestions.push({ command: '/help', description: 'Show all commands' })
  }

  // Default suggestions if no match
  if (suggestions.length === 0) {
    suggestions.push(
      { command: '/compliance', description: 'Show compliance score' },
      { command: '/findings', description: 'Show open findings' },
      { command: '/help', description: 'Show all commands' }
    )
  }

  // Deduplicate
  const seen = new Set<string>()
  const uniqueSuggestions = suggestions.filter((s) => {
    if (seen.has(s.command)) return false
    seen.add(s.command)
    return true
  })

  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      { type: 'TextBlock', text: '🤔 Unknown Command', weight: 'Bolder', size: 'Medium', color: 'Warning' },
      { type: 'TextBlock', text: `I didn't recognize: "${truncate(originalText, 80)}"`, wrap: true },
      { type: 'TextBlock', text: 'Did you mean one of these?', weight: 'Bolder', spacing: 'Medium' },
      {
        type: 'FactSet',
        facts: uniqueSuggestions.slice(0, 3).map((s) => ({
          title: s.command,
          value: s.description,
        })),
      },
      {
        type: 'TextBlock',
        text: 'Type **/help** to see all available commands.',
        wrap: true,
        isSubtle: true,
        spacing: 'Medium',
      },
    ],
    actions: [
      { type: 'Action.OpenUrl', title: 'Open CompliGuard', url: `${APP_URL}/dashboard` },
    ],
  }
}

// ─── Error card helper ────────────────────────────────────────────────────────

function errorCard(subject: string): AdaptiveCard {
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      { type: 'TextBlock', text: '❌ Error', weight: 'Bolder', size: 'Medium', color: 'Attention' },
      {
        type: 'TextBlock',
        text: `Unable to load ${subject} at this time. Please try again or visit CompliGuard directly.`,
        wrap: true,
      },
    ],
    actions: [
      { type: 'Action.OpenUrl', title: 'Open CompliGuard', url: `${APP_URL}/dashboard` },
    ],
  }
}

function notFoundCard(query: string, extraMessage?: string): AdaptiveCard {
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      { type: 'TextBlock', text: '❓ Control Not Found', weight: 'Bolder', size: 'Medium', color: 'Warning' },
      {
        type: 'TextBlock',
        text: `No control matching "${truncate(query, 60)}" was found in your active frameworks.${extraMessage ? `\n\n${extraMessage}` : ''}`,
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: '**Try:**\n• Use the control ID (e.g., `/control AC-1`, `/control CC6.1`)\n• Search by keyword (e.g., `/control password policy`)\n• Use `/compliance` to see all active frameworks',
        wrap: true,
        isSubtle: true,
        spacing: 'Medium',
      },
    ],
    actions: [
      { type: 'Action.OpenUrl', title: 'View Controls', url: `${APP_URL}/controls` },
    ],
  }
}
