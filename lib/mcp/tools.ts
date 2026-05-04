import { db } from '@/lib/db'
import {
  frameworks,
  controls,
  organizationFrameworks,
  controlAssignments,
  findings,
  tasks,
  evidence,
} from '@/lib/db/schema'
import { eq, and, desc, sql, ilike, or, lt } from 'drizzle-orm'
import type { MCPTool, MCPToolResult } from './types'

// ---------------------------------------------------------------------------
// Tool definitions (used in tools/list and manifest)
// ---------------------------------------------------------------------------

export const MCP_TOOLS: MCPTool[] = [
  {
    name: 'list_frameworks',
    description: 'List all active compliance frameworks for the organization. Optionally include control counts and compliance percentage.',
    inputSchema: {
      type: 'object',
      properties: {
        includeControls: {
          type: 'boolean',
          description: 'If true, include control counts and compliance percentage for each framework',
        },
      },
    },
  },
  {
    name: 'get_control_status',
    description: 'Get full control details: title, description, status, assignees, evidence count, and linked findings.',
    inputSchema: {
      type: 'object',
      properties: {
        controlId: {
          type: 'string',
          description: 'The UUID of the control to retrieve',
        },
      },
      required: ['controlId'],
    },
  },
  {
    name: 'list_findings',
    description: 'List security and compliance findings with optional severity and status filters.',
    inputSchema: {
      type: 'object',
      properties: {
        severity: {
          type: 'string',
          description: 'Filter by severity level',
          enum: ['critical', 'high', 'medium', 'low'],
        },
        status: {
          type: 'string',
          description: 'Filter by finding status',
          enum: ['open', 'in_review', 'resolved'],
        },
        limit: {
          type: 'number',
          description: 'Maximum number of findings to return (default: 20)',
        },
      },
    },
  },
  {
    name: 'create_finding',
    description: 'Create a new security or compliance finding. Returns the created finding ID.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the finding',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the finding',
        },
        severity: {
          type: 'string',
          description: 'Severity level of the finding',
          enum: ['critical', 'high', 'medium', 'low', 'info'],
        },
        affectedAsset: {
          type: 'string',
          description: 'The asset or system affected by this finding',
        },
      },
      required: ['title', 'description', 'severity'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List compliance tasks with optional status filter and assignment filter.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by task status (todo, in_progress, done, blocked, overdue)',
        },
        assignedToMe: {
          type: 'boolean',
          description: 'If true, only return tasks assigned to the current user (not supported via API key — returns all)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tasks to return (default: 20)',
        },
      },
    },
  },
  {
    name: 'update_task_status',
    description: "Update a task's status.",
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The UUID of the task to update',
        },
        status: {
          type: 'string',
          description: 'New status for the task',
          enum: ['todo', 'in_progress', 'done', 'blocked'],
        },
      },
      required: ['taskId', 'status'],
    },
  },
  {
    name: 'get_compliance_score',
    description: 'Get overall or per-framework compliance score (percentage of controls implemented or tested).',
    inputSchema: {
      type: 'object',
      properties: {
        frameworkId: {
          type: 'string',
          description: 'Optional UUID of a specific framework. If omitted, returns the overall score.',
        },
      },
    },
  },
  {
    name: 'search_controls',
    description: 'Full-text search controls by title or description.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query string to match against control titles and descriptions',
        },
        frameworkId: {
          type: 'string',
          description: 'Optional UUID to restrict search to a specific framework',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_evidence',
    description: 'List evidence items with optional control and status filters.',
    inputSchema: {
      type: 'object',
      properties: {
        controlId: {
          type: 'string',
          description: 'Optional UUID of a control to filter evidence by',
        },
        status: {
          type: 'string',
          description: 'Filter by evidence status (pending, approved, rejected, expired)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of evidence items to return (default: 20)',
        },
      },
    },
  },
  {
    name: 'get_risk_summary',
    description: 'Get a risk summary: finding counts by severity, overdue tasks, frameworks below 70% compliance, and top 3 risk areas.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]

// ---------------------------------------------------------------------------
// Helper to build text result
// ---------------------------------------------------------------------------
function textResult(data: unknown): MCPToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  }
}

function errorResult(message: string): MCPToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  }
}

// ---------------------------------------------------------------------------
// Tool 1: list_frameworks
// ---------------------------------------------------------------------------
export async function list_frameworks(
  args: Record<string, unknown>,
  orgId: string
): Promise<MCPToolResult> {
  const includeControls = args.includeControls === true

  // Get all active org frameworks
  const orgFrameworks = await db
    .select({
      id: organizationFrameworks.id,
      frameworkId: organizationFrameworks.frameworkId,
      isActive: organizationFrameworks.isActive,
      startedAt: organizationFrameworks.startedAt,
      targetDate: organizationFrameworks.targetDate,
      frameworkName: frameworks.name,
      frameworkShortName: frameworks.shortName,
      frameworkVersion: frameworks.version,
      frameworkDescription: frameworks.description,
      frameworkCategory: frameworks.category,
    })
    .from(organizationFrameworks)
    .innerJoin(frameworks, eq(organizationFrameworks.frameworkId, frameworks.id))
    .where(
      and(
        eq(organizationFrameworks.organizationId, orgId),
        eq(organizationFrameworks.isActive, true)
      )
    )

  if (!includeControls) {
    return textResult({ frameworks: orgFrameworks })
  }

  // Include control counts and compliance %
  const result = await Promise.all(
    orgFrameworks.map(async (of) => {
      const allControls = await db
        .select({ id: controls.id })
        .from(controls)
        .where(eq(controls.frameworkId, of.frameworkId))

      const totalControls = allControls.length

      if (totalControls === 0) {
        return { ...of, controlCount: 0, compliancePercent: 0 }
      }

      const controlIds = allControls.map((c) => c.id)

      // Count implemented or tested assignments
      const implementedCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(controlAssignments)
        .where(
          and(
            eq(controlAssignments.organizationId, orgId),
            sql`${controlAssignments.controlId} = ANY(${sql.raw(`ARRAY[${controlIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
            or(
              eq(controlAssignments.status, 'implemented'),
              eq(controlAssignments.status, 'needs_review')
            )
          )
        )

      const implemented = Number(implementedCount[0]?.count ?? 0)
      const compliancePercent = Math.round((implemented / totalControls) * 100)

      return { ...of, controlCount: totalControls, compliancePercent }
    })
  )

  return textResult({ frameworks: result })
}

// ---------------------------------------------------------------------------
// Tool 2: get_control_status
// ---------------------------------------------------------------------------
export async function get_control_status(
  args: Record<string, unknown>,
  orgId: string
): Promise<MCPToolResult> {
  const controlId = args.controlId as string
  if (!controlId) return errorResult('controlId is required')

  const [control] = await db
    .select()
    .from(controls)
    .where(eq(controls.id, controlId))
    .limit(1)

  if (!control) return errorResult(`Control ${controlId} not found`)

  // Get assignment/status for this org
  const [assignment] = await db
    .select()
    .from(controlAssignments)
    .where(
      and(
        eq(controlAssignments.organizationId, orgId),
        eq(controlAssignments.controlId, controlId)
      )
    )
    .limit(1)

  // Count evidence linked via control assignments
  let evidenceCount = 0
  if (assignment) {
    const evRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(evidence)
      .where(eq(evidence.controlAssignmentId, assignment.id))
    evidenceCount = Number(evRows[0]?.count ?? 0)
  }

  return textResult({
    control: {
      id: control.id,
      controlId: control.controlId,
      title: control.title,
      description: control.description,
      guidance: control.guidance,
      category: control.category,
      subcategory: control.subcategory,
      testProcedure: control.testProcedure,
      remediation: control.remediation,
      frameworkId: control.frameworkId,
    },
    assignment: assignment
      ? {
          status: assignment.status,
          assignedTo: assignment.assignedTo,
          dueDate: assignment.dueDate,
          completedAt: assignment.completedAt,
          notes: assignment.notes,
        }
      : null,
    evidenceCount,
  })
}

// ---------------------------------------------------------------------------
// Tool 3: list_findings
// ---------------------------------------------------------------------------
export async function list_findings(
  args: Record<string, unknown>,
  orgId: string
): Promise<MCPToolResult> {
  const severity = args.severity as string | undefined
  const status = args.status as string | undefined
  const limit = Math.min(Number(args.limit ?? 20), 100)

  const conditions = [eq(findings.organizationId, orgId)]

  if (severity) {
    conditions.push(eq(findings.severity, severity as 'critical' | 'high' | 'medium' | 'low' | 'info'))
  }

  if (status) {
    // Map in_review -> in_remediation for schema compatibility
    const dbStatus = status === 'in_review' ? 'in_remediation' : status
    conditions.push(eq(findings.status, dbStatus as 'open' | 'in_remediation' | 'resolved' | 'accepted' | 'false_positive'))
  }

  const rows = await db
    .select({
      id: findings.id,
      title: findings.title,
      description: findings.description,
      severity: findings.severity,
      status: findings.status,
      source: findings.source,
      affectedAsset: findings.affectedAsset,
      assignedTo: findings.assignedTo,
      dueDate: findings.dueDate,
      createdAt: findings.createdAt,
      updatedAt: findings.updatedAt,
    })
    .from(findings)
    .where(and(...conditions))
    .orderBy(desc(findings.createdAt))
    .limit(limit)

  return textResult({ findings: rows, count: rows.length })
}

// ---------------------------------------------------------------------------
// Tool 4: create_finding
// ---------------------------------------------------------------------------
export async function create_finding(
  args: Record<string, unknown>,
  orgId: string
): Promise<MCPToolResult> {
  const title = args.title as string
  const description = args.description as string
  const severity = args.severity as string
  const affectedAsset = args.affectedAsset as string | undefined

  if (!title || !description || !severity) {
    return errorResult('title, description, and severity are required')
  }

  const validSeverities = ['critical', 'high', 'medium', 'low', 'info']
  if (!validSeverities.includes(severity)) {
    return errorResult(`severity must be one of: ${validSeverities.join(', ')}`)
  }

  const [inserted] = await db
    .insert(findings)
    .values({
      organizationId: orgId,
      title,
      description,
      severity: severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
      status: 'open',
      source: 'manual',
      affectedAsset: affectedAsset ?? null,
    })
    .returning({ id: findings.id })

  return textResult({ success: true, findingId: inserted.id })
}

// ---------------------------------------------------------------------------
// Tool 5: list_tasks
// ---------------------------------------------------------------------------
export async function list_tasks(
  args: Record<string, unknown>,
  orgId: string
): Promise<MCPToolResult> {
  const status = args.status as string | undefined
  const limit = Math.min(Number(args.limit ?? 20), 100)

  const conditions = [eq(tasks.organizationId, orgId)]

  if (status && status !== 'overdue') {
    conditions.push(eq(tasks.status, status as 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled'))
  } else if (status === 'overdue') {
    // Overdue = not done/cancelled and past dueDate
    conditions.push(
      sql`${tasks.dueDate} < NOW()`,
      sql`${tasks.status} NOT IN ('done', 'cancelled')`
    )
  }

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assignedTo: tasks.assignedTo,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt))
    .limit(limit)

  return textResult({ tasks: rows, count: rows.length })
}

// ---------------------------------------------------------------------------
// Tool 6: update_task_status
// ---------------------------------------------------------------------------
export async function update_task_status(
  args: Record<string, unknown>,
  orgId: string
): Promise<MCPToolResult> {
  const taskId = args.taskId as string
  const status = args.status as string

  if (!taskId || !status) return errorResult('taskId and status are required')

  const validStatuses = ['todo', 'in_progress', 'done', 'blocked']
  if (!validStatuses.includes(status)) {
    return errorResult(`status must be one of: ${validStatuses.join(', ')}`)
  }

  // Verify task belongs to org
  const [existing] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, orgId)))
    .limit(1)

  if (!existing) return errorResult(`Task ${taskId} not found`)

  const updateValues: Record<string, unknown> = {
    status: status as 'todo' | 'in_progress' | 'done' | 'blocked',
    updatedAt: new Date(),
  }

  if (status === 'done') {
    updateValues.completedAt = new Date()
  }

  await db
    .update(tasks)
    .set(updateValues)
    .where(eq(tasks.id, taskId))

  return textResult({ success: true, taskId, status })
}

// ---------------------------------------------------------------------------
// Tool 7: get_compliance_score
// ---------------------------------------------------------------------------
export async function get_compliance_score(
  args: Record<string, unknown>,
  orgId: string
): Promise<MCPToolResult> {
  const frameworkId = args.frameworkId as string | undefined

  if (frameworkId) {
    // Score for a specific framework
    const [fw] = await db
      .select({ id: frameworks.id, name: frameworks.name, shortName: frameworks.shortName })
      .from(frameworks)
      .where(eq(frameworks.id, frameworkId))
      .limit(1)

    if (!fw) return errorResult(`Framework ${frameworkId} not found`)

    const allControls = await db
      .select({ id: controls.id })
      .from(controls)
      .where(eq(controls.frameworkId, frameworkId))

    const totalControls = allControls.length
    if (totalControls === 0) {
      return textResult({ frameworkId, frameworkName: fw.name, score: 0, totalControls: 0, implementedControls: 0 })
    }

    const controlIds = allControls.map((c) => c.id)

    const implementedRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(controlAssignments)
      .where(
        and(
          eq(controlAssignments.organizationId, orgId),
          sql`${controlAssignments.controlId} = ANY(${sql.raw(`ARRAY[${controlIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
          or(
            eq(controlAssignments.status, 'implemented'),
            eq(controlAssignments.status, 'needs_review')
          )
        )
      )

    const implemented = Number(implementedRows[0]?.count ?? 0)
    const score = Math.round((implemented / totalControls) * 100)

    return textResult({
      frameworkId,
      frameworkName: fw.name,
      frameworkShortName: fw.shortName,
      score,
      totalControls,
      implementedControls: implemented,
    })
  }

  // Overall score across all active org frameworks
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

  let totalControls = 0
  let totalImplemented = 0
  const frameworkScores: Array<{ frameworkId: string; name: string; score: number; total: number; implemented: number }> = []

  for (const of_ of orgFrameworks) {
    const allControls = await db
      .select({ id: controls.id })
      .from(controls)
      .where(eq(controls.frameworkId, of_.frameworkId))

    const fwTotal = allControls.length
    totalControls += fwTotal

    if (fwTotal === 0) {
      frameworkScores.push({ frameworkId: of_.frameworkId, name: of_.frameworkName, score: 0, total: 0, implemented: 0 })
      continue
    }

    const controlIds = allControls.map((c) => c.id)

    const implementedRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(controlAssignments)
      .where(
        and(
          eq(controlAssignments.organizationId, orgId),
          sql`${controlAssignments.controlId} = ANY(${sql.raw(`ARRAY[${controlIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
          or(
            eq(controlAssignments.status, 'implemented'),
            eq(controlAssignments.status, 'needs_review')
          )
        )
      )

    const fwImplemented = Number(implementedRows[0]?.count ?? 0)
    totalImplemented += fwImplemented
    const fwScore = Math.round((fwImplemented / fwTotal) * 100)
    frameworkScores.push({ frameworkId: of_.frameworkId, name: of_.frameworkName, score: fwScore, total: fwTotal, implemented: fwImplemented })
  }

  const overallScore = totalControls > 0 ? Math.round((totalImplemented / totalControls) * 100) : 0

  return textResult({
    overallScore,
    totalControls,
    totalImplemented,
    frameworkCount: orgFrameworks.length,
    frameworks: frameworkScores,
  })
}

// ---------------------------------------------------------------------------
// Tool 8: search_controls
// ---------------------------------------------------------------------------
export async function search_controls(
  args: Record<string, unknown>,
  orgId: string
): Promise<MCPToolResult> {
  const query = args.query as string
  const frameworkId = args.frameworkId as string | undefined
  const limit = Math.min(Number(args.limit ?? 10), 50)

  if (!query) return errorResult('query is required')

  const conditions = [
    or(
      ilike(controls.title, `%${query}%`),
      ilike(controls.description, `%${query}%`)
    ),
  ]

  if (frameworkId) {
    conditions.push(eq(controls.frameworkId, frameworkId))
  } else {
    // Restrict to frameworks the org has active
    const orgFwIds = await db
      .select({ frameworkId: organizationFrameworks.frameworkId })
      .from(organizationFrameworks)
      .where(
        and(
          eq(organizationFrameworks.organizationId, orgId),
          eq(organizationFrameworks.isActive, true)
        )
      )

    if (orgFwIds.length === 0) {
      return textResult({ controls: [], count: 0 })
    }

    const fwIds = orgFwIds.map((r) => r.frameworkId)
    conditions.push(sql`${controls.frameworkId} = ANY(${sql.raw(`ARRAY[${fwIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`)
  }

  const rows = await db
    .select({
      id: controls.id,
      controlId: controls.controlId,
      title: controls.title,
      description: controls.description,
      category: controls.category,
      frameworkId: controls.frameworkId,
    })
    .from(controls)
    .where(and(...conditions))
    .limit(limit)

  return textResult({ controls: rows, count: rows.length, query })
}

// ---------------------------------------------------------------------------
// Tool 9: list_evidence
// ---------------------------------------------------------------------------
export async function list_evidence(
  args: Record<string, unknown>,
  orgId: string
): Promise<MCPToolResult> {
  const controlId = args.controlId as string | undefined
  const status = args.status as string | undefined
  const limit = Math.min(Number(args.limit ?? 20), 100)

  const conditions = [eq(evidence.organizationId, orgId)]

  if (status) {
    conditions.push(eq(evidence.status, status as 'pending' | 'approved' | 'rejected' | 'expired'))
  }

  if (controlId) {
    // Find control assignment id for this control/org
    const [assignment] = await db
      .select({ id: controlAssignments.id })
      .from(controlAssignments)
      .where(
        and(
          eq(controlAssignments.controlId, controlId),
          eq(controlAssignments.organizationId, orgId)
        )
      )
      .limit(1)

    if (assignment) {
      conditions.push(eq(evidence.controlAssignmentId, assignment.id))
    } else {
      return textResult({ evidence: [], count: 0 })
    }
  }

  const rows = await db
    .select({
      id: evidence.id,
      title: evidence.title,
      description: evidence.description,
      evidenceType: evidence.evidenceType,
      status: evidence.status,
      fileName: evidence.fileName,
      fileSize: evidence.fileSize,
      mimeType: evidence.mimeType,
      uploadedBy: evidence.uploadedBy,
      controlAssignmentId: evidence.controlAssignmentId,
      createdAt: evidence.createdAt,
    })
    .from(evidence)
    .where(and(...conditions))
    .orderBy(desc(evidence.createdAt))
    .limit(limit)

  return textResult({ evidence: rows, count: rows.length })
}

// ---------------------------------------------------------------------------
// Tool 10: get_risk_summary
// ---------------------------------------------------------------------------
export async function get_risk_summary(
  args: Record<string, unknown>,
  orgId: string
): Promise<MCPToolResult> {
  // Finding counts by severity (open only)
  const findingCounts = await db
    .select({
      severity: findings.severity,
      count: sql<number>`count(*)`,
    })
    .from(findings)
    .where(
      and(
        eq(findings.organizationId, orgId),
        eq(findings.status, 'open')
      )
    )
    .groupBy(findings.severity)

  const findingsBySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  }
  for (const row of findingCounts) {
    findingsBySeverity[row.severity] = Number(row.count)
  }

  // Overdue tasks count
  const [overdueRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(
      and(
        eq(tasks.organizationId, orgId),
        lt(tasks.dueDate, new Date()),
        sql`${tasks.status} NOT IN ('done', 'cancelled')`
      )
    )
  const overdueTaskCount = Number(overdueRow?.count ?? 0)

  // Frameworks with <70% compliance
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

  const lowScoreFrameworks: Array<{ frameworkId: string; name: string; score: number }> = []

  for (const of_ of orgFrameworks) {
    const allControls = await db
      .select({ id: controls.id })
      .from(controls)
      .where(eq(controls.frameworkId, of_.frameworkId))

    const fwTotal = allControls.length
    if (fwTotal === 0) {
      lowScoreFrameworks.push({ frameworkId: of_.frameworkId, name: of_.frameworkName, score: 0 })
      continue
    }

    const controlIds = allControls.map((c) => c.id)

    const implementedRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(controlAssignments)
      .where(
        and(
          eq(controlAssignments.organizationId, orgId),
          sql`${controlAssignments.controlId} = ANY(${sql.raw(`ARRAY[${controlIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
          or(
            eq(controlAssignments.status, 'implemented'),
            eq(controlAssignments.status, 'needs_review')
          )
        )
      )

    const fwImplemented = Number(implementedRows[0]?.count ?? 0)
    const score = Math.round((fwImplemented / fwTotal) * 100)

    if (score < 70) {
      lowScoreFrameworks.push({ frameworkId: of_.frameworkId, name: of_.frameworkName, score })
    }
  }

  // Top 3 risk areas (framework categories with most open findings via source)
  const topRiskAreas = ['Critical Findings', 'Overdue Tasks', 'Low Compliance Frameworks']
    .filter((_, i) => {
      if (i === 0) return (findingsBySeverity.critical + findingsBySeverity.high) > 0
      if (i === 1) return overdueTaskCount > 0
      if (i === 2) return lowScoreFrameworks.length > 0
      return false
    })

  return textResult({
    findings: findingsBySeverity,
    totalOpenFindings: Object.values(findingsBySeverity).reduce((a, b) => a + b, 0),
    overdueTaskCount,
    lowComplianceFrameworks: lowScoreFrameworks,
    topRiskAreas,
    generatedAt: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------
export async function dispatchTool(
  toolName: string,
  args: Record<string, unknown>,
  orgId: string
): Promise<MCPToolResult> {
  switch (toolName) {
    case 'list_frameworks':
      return list_frameworks(args, orgId)
    case 'get_control_status':
      return get_control_status(args, orgId)
    case 'list_findings':
      return list_findings(args, orgId)
    case 'create_finding':
      return create_finding(args, orgId)
    case 'list_tasks':
      return list_tasks(args, orgId)
    case 'update_task_status':
      return update_task_status(args, orgId)
    case 'get_compliance_score':
      return get_compliance_score(args, orgId)
    case 'search_controls':
      return search_controls(args, orgId)
    case 'list_evidence':
      return list_evidence(args, orgId)
    case 'get_risk_summary':
      return get_risk_summary(args, orgId)
    default:
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${toolName}` }) }],
        isError: true,
      }
  }
}
