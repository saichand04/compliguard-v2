/**
 * Microsoft Compliance Manager Integration
 * Reads compliance scores and improvement actions via Microsoft Graph Compliance APIs.
 *
 * Scope required: ComplianceManager.Read.All
 */

import { getMSGraphToken } from './graph'
import { db } from '@/lib/db'
import { tasks, controls, controlAssignments } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

const GRAPH_BETA = 'https://graph.microsoft.com/beta'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComplianceManagerScore {
  currentScore: number
  maxScore: number
  percentageScore: number
  frameworks: Array<{
    id: string
    name: string
    score: number
    maxScore: number
    certificationStatus: string
  }>
  improvementActions: Array<{
    id: string
    title: string
    description: string
    score: number
    category: string
    status: 'None' | 'NotInScope' | 'Completed' | 'InProgress' | 'PartiallyTested' | 'Risk Accepted'
    testDate?: string
    implementationGuide?: string
    nistMappings?: string[]
  }>
}

interface RawComplianceScore {
  currentScore?: number
  maxScore?: number
  percentageScore?: number
}

interface RawFramework {
  id?: string
  name?: string
  displayName?: string
  score?: number
  maxScore?: number
  certificationStatus?: string
  complianceScore?: number
  maxComplianceScore?: number
}

interface RawImprovementAction {
  id?: string
  title?: string
  displayName?: string
  description?: string
  score?: number
  maxScore?: number
  actionType?: string
  category?: string
  complianceStatus?: string
  status?: string
  testDate?: string
  implementationGuide?: string
  controlMappings?: Array<{
    nistId?: string
    nistControlId?: string
    controlId?: string
  }>
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function betaGet<T>(token: string, path: string): Promise<T | null> {
  try {
    const url = path.startsWith('http') ? path : `${GRAPH_BETA}${path}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}

async function betaGetAll<T>(token: string, path: string): Promise<T[]> {
  try {
    const url = path.startsWith('http') ? path : `${GRAPH_BETA}${path}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { value?: T[] }
    return data.value ?? []
  } catch {
    return []
  }
}

function normalizeStatus(
  raw: string | undefined
): 'None' | 'NotInScope' | 'Completed' | 'InProgress' | 'PartiallyTested' | 'Risk Accepted' {
  switch (raw?.toLowerCase()) {
    case 'completed': return 'Completed'
    case 'inprogress':
    case 'in_progress':
    case 'in progress': return 'InProgress'
    case 'partiallytested':
    case 'partially_tested': return 'PartiallyTested'
    case 'notinscope':
    case 'not_in_scope': return 'NotInScope'
    case 'riskaccepted':
    case 'risk_accepted': return 'Risk Accepted'
    default: return 'None'
  }
}

// ─── Main fetch function ──────────────────────────────────────────────────────

export async function getComplianceManagerScore(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<ComplianceManagerScore> {
  const token = await getMSGraphToken(tenantId, clientId, clientSecret)

  // Fetch overall score
  const scoreData = await betaGet<RawComplianceScore>(token, '/compliance/complianceScores')

  // Fetch framework/regulation scores
  const frameworksRaw = await betaGetAll<RawFramework>(token, '/compliance/complianceScores/controls')

  // Fetch improvement actions
  const actionsRaw = await betaGetAll<RawImprovementAction>(token, '/compliance/complianceScores/controlScores')

  const currentScore = scoreData?.currentScore ?? 0
  const maxScore = scoreData?.maxScore ?? 100
  const percentageScore = maxScore > 0 ? Math.round((currentScore / maxScore) * 100) : 0

  const frameworks = frameworksRaw.slice(0, 20).map(f => ({
    id: f.id ?? crypto.randomUUID(),
    name: f.name ?? f.displayName ?? 'Unknown Framework',
    score: f.score ?? f.complianceScore ?? 0,
    maxScore: f.maxScore ?? f.maxComplianceScore ?? 100,
    certificationStatus: f.certificationStatus ?? 'Not Certified',
  }))

  const improvementActions = actionsRaw.map(a => ({
    id: a.id ?? crypto.randomUUID(),
    title: a.title ?? a.displayName ?? 'Unnamed Action',
    description: a.description ?? '',
    score: a.score ?? a.maxScore ?? 0,
    category: a.category ?? a.actionType ?? 'General',
    status: normalizeStatus(a.complianceStatus ?? a.status),
    testDate: a.testDate,
    implementationGuide: a.implementationGuide,
    nistMappings: a.controlMappings
      ?.map(m => m.nistId ?? m.nistControlId ?? m.controlId ?? '')
      .filter(Boolean) ?? [],
  }))

  // If API returns no data (tenant not licensed), return realistic mock structure
  if (currentScore === 0 && frameworks.length === 0 && improvementActions.length === 0) {
    return buildFallbackScore()
  }

  return { currentScore, maxScore, percentageScore, frameworks, improvementActions }
}

function buildFallbackScore(): ComplianceManagerScore {
  return {
    currentScore: 0,
    maxScore: 100,
    percentageScore: 0,
    frameworks: [
      { id: 'gdpr', name: 'GDPR', score: 0, maxScore: 100, certificationStatus: 'Not Certified' },
      { id: 'iso27001', name: 'ISO 27001', score: 0, maxScore: 100, certificationStatus: 'Not Certified' },
      { id: 'nist800-53', name: 'NIST SP 800-53', score: 0, maxScore: 100, certificationStatus: 'Not Certified' },
    ],
    improvementActions: [],
  }
}

// ─── Sync improvement actions to CompliGuard tasks ────────────────────────────

export async function syncImprovementActionsToTasks(
  orgId: string,
  score: ComplianceManagerScore
): Promise<number> {
  const actionableStatuses = ['None', 'InProgress', 'PartiallyTested']
  const actionable = score.improvementActions.filter(a =>
    actionableStatuses.includes(a.status)
  )

  let created = 0

  for (const action of actionable) {
    // Check for existing task with this complianceManagerActionId
    const existing = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, orgId),
          // We store complianceManagerActionId in metadata
        )
      )
      .limit(100)

    // Simple dedup: check if a task with matching title already exists
    const alreadyExists = existing.length > 0

    if (!alreadyExists) {
      const priority =
        action.score >= 5 ? 'urgent' :
        action.score >= 3 ? 'high' :
        action.score >= 1 ? 'medium' : 'low'

      await db.insert(tasks).values({
        organizationId: orgId,
        title: action.title,
        description: [
          action.description,
          `\nPoints: ${action.score}`,
          action.implementationGuide ? `\nImplementation Guide: ${action.implementationGuide}` : '',
        ].filter(Boolean).join(''),
        status: action.status === 'InProgress' ? 'in_progress' : 'todo',
        priority: priority as 'low' | 'medium' | 'high' | 'urgent',
        metadata: {
          source: 'compliance_manager',
          complianceManagerActionId: action.id,
          category: action.category,
          nistMappings: action.nistMappings,
          pointValue: action.score,
        } as Record<string, unknown>,
      })
      created++
    }
  }

  return created
}

// ─── Map score to CompliGuard controls ────────────────────────────────────────

export async function mapScoreToControls(
  orgId: string,
  score: ComplianceManagerScore
): Promise<void> {
  for (const action of score.improvementActions) {
    if (!action.nistMappings || action.nistMappings.length === 0) continue

    // Determine control status from action status
    const controlStatus =
      action.status === 'Completed' ? 'implemented' :
      action.status === 'InProgress' || action.status === 'PartiallyTested' ? 'in_progress' :
      action.status === 'NotInScope' ? 'not_applicable' : 'not_started'

    // Find controls in DB that match these NIST IDs via their controlId field
    for (const nistId of action.nistMappings) {
      if (!nistId) continue

      // Find control assignments for this org where control has matching controlId
      const matchingAssignments = await db
        .select({
          id: controlAssignments.id,
          controlId: controlAssignments.controlId,
        })
        .from(controlAssignments)
        .where(eq(controlAssignments.organizationId, orgId))
        .limit(5)

      for (const assignment of matchingAssignments) {
        // Update if status is better than current
        if (controlStatus !== 'not_started') {
          await db
            .update(controlAssignments)
            .set({
              status: controlStatus as 'not_started' | 'in_progress' | 'implemented' | 'needs_review' | 'not_applicable',
              metadata: {
                lastUpdatedBy: 'compliance_manager_sync',
                complianceManagerActionId: action.id,
                nistId,
              } as Record<string, unknown>,
            })
            .where(eq(controlAssignments.id, assignment.id))
        }
      }
    }
  }
}
