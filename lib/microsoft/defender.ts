/**
 * lib/microsoft/defender.ts
 * Microsoft Defender for Cloud and XDR integration.
 * Uses Azure Security Center REST API + Microsoft 365 Defender via Graph.
 */

import { getMSGraphToken, graphGetAll } from '@/lib/microsoft/graph'

const TOKEN_ENDPOINT = 'https://login.microsoftonline.com'
const ARM_BASE = 'https://management.azure.com'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DefenderCheckResult {
  category: 'secure_score' | 'recommendations' | 'alerts' | 'xdr_incidents' | 'coverage'
  checkId: string
  title: string
  status: 'pass' | 'fail' | 'warn' | 'info'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  score?: number
  maxScore?: number
  count?: number
  items?: Array<{ id: string; title: string; severity: string; resource?: string; description: string }>
  recommendation: string
  nistControls: string[]
}

// ── ARM token acquisition ─────────────────────────────────────────────────────

async function getARMToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const url = `${TOKEN_ENDPOINT}/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://management.azure.com/.default',
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to acquire ARM token: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

async function armGet<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ARM API error ${res.status} for ${url}: ${err}`)
  }
  return res.json() as Promise<T>
}

// ── Raw Azure types (partial) ─────────────────────────────────────────────────

interface SecureScoreItem {
  id: string
  name: string
  properties?: {
    displayName?: string
    score?: { current?: number; max?: number; percentage?: number }
    weight?: number
  }
}

interface AssessmentItem {
  id: string
  name: string
  properties?: {
    displayName?: string
    status?: { code?: string; cause?: string }
    metadata?: { severity?: string; categories?: string[]; displayName?: string }
    resourceDetails?: { id?: string; displayName?: string }
  }
}

interface AlertItem {
  id: string
  name: string
  properties?: {
    alertDisplayName?: string
    severity?: string
    status?: string
    timeGeneratedUtc?: string
    alertType?: string
    intent?: string
  }
}

interface PricingItem {
  id: string
  name: string
  properties?: {
    pricingTier?: string
    subPlan?: string
  }
}

interface XdrIncident {
  id: string
  displayName?: string
  severity?: string
  status?: string
  assignedTo?: string
  createdDateTime?: string
  lastUpdateDateTime?: string
  comments?: unknown[]
  alerts?: Array<{ mitreTechniques?: string[]; actorDisplayName?: string }>
  classification?: string
}

// ── Secure Score checks ───────────────────────────────────────────────────────

async function checkSecureScore(
  armToken: string,
  subscriptionId: string,
): Promise<DefenderCheckResult[]> {
  const results: DefenderCheckResult[] = []

  let scores: { value: SecureScoreItem[] } = { value: [] }
  try {
    scores = await armGet<{ value: SecureScoreItem[] }>(
      armToken,
      `${ARM_BASE}/subscriptions/${subscriptionId}/providers/Microsoft.Security/secureScores?api-version=2020-01-01`,
    )
  } catch {
    results.push({
      category: 'secure_score',
      checkId: 'defender.secure_score.overall',
      title: 'Secure Score — Overall',
      status: 'warn',
      severity: 'medium',
      recommendation: 'Unable to retrieve Secure Score. Verify Defender for Cloud is enabled and credentials have Reader access.',
      nistControls: ['CA-2', 'RA-5'],
    })
    return results
  }

  const overall = scores.value.find((s) => s.name === 'ascScore') ?? scores.value[0]
  const pct = overall?.properties?.score?.percentage ?? 0
  const current = overall?.properties?.score?.current ?? 0
  const max = overall?.properties?.score?.max ?? 100

  results.push({
    category: 'secure_score',
    checkId: 'defender.secure_score.overall',
    title: 'Secure Score — Overall',
    status: pct < 50 ? 'fail' : pct < 70 ? 'warn' : 'pass',
    severity: pct < 50 ? 'high' : pct < 70 ? 'medium' : 'low',
    score: Math.round(pct),
    maxScore: 100,
    count: scores.value.length,
    recommendation:
      pct >= 70
        ? 'Secure Score is healthy. Continue addressing remaining recommendations.'
        : 'Secure Score is below target. Prioritize unhealthy recommendations to improve posture.',
    nistControls: ['CA-2', 'RA-5', 'SI-2'],
  })

  // Per-control breakdown
  const controls = scores.value.filter((s) => s.name !== 'ascScore')
  const controlItems = controls.map((c) => ({
    id: c.name,
    title: c.properties?.displayName ?? c.name,
    severity: (c.properties?.score?.percentage ?? 0) < 50 ? 'high' : 'low',
    description: `Score: ${Math.round(c.properties?.score?.percentage ?? 0)}%`,
  }))

  results.push({
    category: 'secure_score',
    checkId: 'defender.secure_score.by_control',
    title: 'Secure Score — Per Control',
    status: controls.length > 0 ? 'info' : 'warn',
    severity: 'info',
    score: current,
    maxScore: max,
    count: controls.length,
    items: controlItems,
    recommendation: 'Review per-control scores and address lowest-scoring areas first.',
    nistControls: ['CA-2', 'RA-5'],
  })

  // Trend (simulated: we don't have historical data, report as info)
  results.push({
    category: 'secure_score',
    checkId: 'defender.secure_score.trend',
    title: 'Secure Score — Trend',
    status: 'info',
    severity: 'info',
    score: Math.round(pct),
    recommendation: 'Enable Secure Score history in Defender for Cloud to track trend over time.',
    nistControls: ['CA-7', 'RA-5'],
  })

  return results
}

// ── Recommendations checks ────────────────────────────────────────────────────

async function checkRecommendations(
  armToken: string,
  subscriptionId: string,
): Promise<DefenderCheckResult[]> {
  const results: DefenderCheckResult[] = []

  let assessments: { value: AssessmentItem[] } = { value: [] }
  try {
    assessments = await armGet<{ value: AssessmentItem[] }>(
      armToken,
      `${ARM_BASE}/subscriptions/${subscriptionId}/providers/Microsoft.Security/assessments?api-version=2021-06-01`,
    )
  } catch {
    return [
      {
        category: 'recommendations',
        checkId: 'defender.recommendations.critical_unhealthy',
        title: 'Recommendations — Unable to Fetch',
        status: 'warn',
        severity: 'medium',
        recommendation: 'Unable to fetch assessments. Check permissions for Microsoft.Security/assessments/read.',
        nistControls: ['CA-5', 'RA-5'],
      },
    ]
  }

  const unhealthy = assessments.value.filter(
    (a) => a.properties?.status?.code === 'Unhealthy',
  )

  const criticalUnhealthy = unhealthy.filter(
    (a) => a.properties?.metadata?.severity === 'High' && (a.properties?.metadata?.categories?.includes('IdentityAndAccess') ?? false) === false,
  )
  const bySeverity = (sev: string) =>
    unhealthy.filter((a) => a.properties?.metadata?.severity === sev)

  const highUnhealthy = bySeverity('High')
  const toItem = (a: AssessmentItem) => ({
    id: a.name,
    title: a.properties?.metadata?.displayName ?? a.properties?.displayName ?? a.name,
    severity: a.properties?.metadata?.severity ?? 'medium',
    resource: a.properties?.resourceDetails?.displayName ?? a.properties?.resourceDetails?.id,
    description: `Status: ${a.properties?.status?.code ?? 'Unknown'}`,
  })

  results.push({
    category: 'recommendations',
    checkId: 'defender.recommendations.critical_unhealthy',
    title: 'Critical Unhealthy Recommendations',
    status: criticalUnhealthy.length > 0 ? 'fail' : 'pass',
    severity: criticalUnhealthy.length > 0 ? 'critical' : 'low',
    count: criticalUnhealthy.length,
    items: criticalUnhealthy.slice(0, 10).map(toItem),
    recommendation:
      criticalUnhealthy.length > 0
        ? 'Immediately address critical unhealthy recommendations to reduce attack surface.'
        : 'No critical unhealthy recommendations. Maintain current security posture.',
    nistControls: ['CA-5', 'RA-5', 'SI-2'],
  })

  results.push({
    category: 'recommendations',
    checkId: 'defender.recommendations.high_unhealthy',
    title: 'High Severity Unhealthy Recommendations',
    status: highUnhealthy.length > 5 ? 'fail' : highUnhealthy.length > 0 ? 'warn' : 'pass',
    severity: highUnhealthy.length > 5 ? 'high' : highUnhealthy.length > 0 ? 'medium' : 'low',
    count: highUnhealthy.length,
    items: highUnhealthy.slice(0, 10).map(toItem),
    recommendation:
      'Address high severity recommendations within 30 days to maintain compliance posture.',
    nistControls: ['CA-5', 'RA-5'],
  })

  const identityUnhealthy = unhealthy.filter(
    (a) =>
      a.properties?.metadata?.categories?.some((c) =>
        ['IdentityAndAccess', 'Identity'].includes(c),
      ) ?? false,
  )
  results.push({
    category: 'recommendations',
    checkId: 'defender.recommendations.identity_issues',
    title: 'Identity & Access Unhealthy Recommendations',
    status: identityUnhealthy.length > 0 ? 'warn' : 'pass',
    severity: identityUnhealthy.length > 3 ? 'high' : identityUnhealthy.length > 0 ? 'medium' : 'low',
    count: identityUnhealthy.length,
    items: identityUnhealthy.slice(0, 10).map(toItem),
    recommendation: 'Resolve identity-related recommendations to prevent unauthorized access.',
    nistControls: ['AC-2', 'IA-5', 'RA-5'],
  })

  const networkUnhealthy = unhealthy.filter(
    (a) => a.properties?.metadata?.categories?.some((c) => ['Networking'].includes(c)) ?? false,
  )
  results.push({
    category: 'recommendations',
    checkId: 'defender.recommendations.network_issues',
    title: 'Network Security Unhealthy Recommendations',
    status: networkUnhealthy.length > 0 ? 'warn' : 'pass',
    severity: networkUnhealthy.length > 5 ? 'high' : networkUnhealthy.length > 0 ? 'medium' : 'low',
    count: networkUnhealthy.length,
    items: networkUnhealthy.slice(0, 10).map(toItem),
    recommendation: 'Address network security recommendations to reduce lateral movement risk.',
    nistControls: ['SC-7', 'RA-5'],
  })

  const dataUnhealthy = unhealthy.filter(
    (a) => a.properties?.metadata?.categories?.some((c) => ['Data'].includes(c)) ?? false,
  )
  results.push({
    category: 'recommendations',
    checkId: 'defender.recommendations.data_issues',
    title: 'Data Protection Unhealthy Recommendations',
    status: dataUnhealthy.length > 0 ? 'warn' : 'pass',
    severity: dataUnhealthy.length > 3 ? 'high' : dataUnhealthy.length > 0 ? 'medium' : 'low',
    count: dataUnhealthy.length,
    items: dataUnhealthy.slice(0, 10).map(toItem),
    recommendation: 'Resolve data protection issues to maintain regulatory compliance.',
    nistControls: ['SC-28', 'RA-5'],
  })

  return results
}

// ── Security Alerts checks ────────────────────────────────────────────────────

async function checkAlerts(
  armToken: string,
  subscriptionId: string,
): Promise<DefenderCheckResult[]> {
  const results: DefenderCheckResult[] = []

  let alertsResp: { value: AlertItem[] } = { value: [] }
  try {
    alertsResp = await armGet<{ value: AlertItem[] }>(
      armToken,
      `${ARM_BASE}/subscriptions/${subscriptionId}/providers/Microsoft.Security/alerts?api-version=2022-01-01`,
    )
  } catch {
    return [
      {
        category: 'alerts',
        checkId: 'defender.alerts.active_critical',
        title: 'Security Alerts — Unable to Fetch',
        status: 'warn',
        severity: 'medium',
        recommendation: 'Unable to retrieve security alerts. Verify Microsoft.Security/alerts/read permission.',
        nistControls: ['IR-4', 'SI-4'],
      },
    ]
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const active = alertsResp.value.filter(
    (a) => a.properties?.status === 'Active',
  )
  const activeCritical = active.filter((a) => a.properties?.severity === 'High')
  const activeHigh = active.filter((a) => a.properties?.severity === 'Medium')

  const toAlertItem = (a: AlertItem) => ({
    id: a.name,
    title: a.properties?.alertDisplayName ?? a.name,
    severity: a.properties?.severity ?? 'Medium',
    description: `Status: ${a.properties?.status ?? 'Unknown'} | Intent: ${a.properties?.intent ?? 'N/A'}`,
  })

  results.push({
    category: 'alerts',
    checkId: 'defender.alerts.active_critical',
    title: 'Active Critical Security Alerts',
    status: activeCritical.length > 0 ? 'fail' : 'pass',
    severity: activeCritical.length > 0 ? 'critical' : 'low',
    count: activeCritical.length,
    items: activeCritical.slice(0, 10).map(toAlertItem),
    recommendation:
      activeCritical.length > 0
        ? 'Immediately investigate and remediate critical security alerts.'
        : 'No active critical alerts detected.',
    nistControls: ['IR-4', 'IR-5', 'SI-4'],
  })

  results.push({
    category: 'alerts',
    checkId: 'defender.alerts.active_high',
    title: 'Active High Severity Alerts',
    status: activeHigh.length > 5 ? 'fail' : activeHigh.length > 0 ? 'warn' : 'pass',
    severity: activeHigh.length > 5 ? 'high' : activeHigh.length > 0 ? 'medium' : 'low',
    count: activeHigh.length,
    items: activeHigh.slice(0, 10).map(toAlertItem),
    recommendation: 'Triage and respond to high severity alerts within 24 hours.',
    nistControls: ['IR-4', 'SI-4'],
  })

  // Unresolved >30 days
  const unresolved30d = alertsResp.value.filter((a) => {
    if (a.properties?.status === 'Dismissed' || a.properties?.status === 'Resolved') return false
    const ts = a.properties?.timeGeneratedUtc ? new Date(a.properties.timeGeneratedUtc) : null
    return ts && ts < thirtyDaysAgo
  })
  results.push({
    category: 'alerts',
    checkId: 'defender.alerts.unresolved_30d',
    title: 'Alerts Unresolved >30 Days',
    status: unresolved30d.length > 0 ? 'warn' : 'pass',
    severity: unresolved30d.length > 10 ? 'high' : unresolved30d.length > 0 ? 'medium' : 'low',
    count: unresolved30d.length,
    items: unresolved30d.slice(0, 10).map(toAlertItem),
    recommendation: 'Review alerts older than 30 days. Either remediate, dismiss, or accept the risk.',
    nistControls: ['IR-5', 'CA-7'],
  })

  // Alerts by MITRE ATT&CK tactic
  const tacticMap: Record<string, number> = {}
  for (const alert of alertsResp.value) {
    const tactic = alert.properties?.intent ?? 'Unknown'
    tacticMap[tactic] = (tacticMap[tactic] ?? 0) + 1
  }
  const tacticItems = Object.entries(tacticMap).map(([tactic, count]) => ({
    id: tactic,
    title: tactic,
    severity: 'info',
    description: `${count} alert(s)`,
  }))

  results.push({
    category: 'alerts',
    checkId: 'defender.alerts.by_category',
    title: 'Alert Distribution by MITRE ATT&CK Tactic',
    status: 'info',
    severity: 'info',
    count: alertsResp.value.length,
    items: tacticItems,
    recommendation: 'Review tactic distribution to identify attack pattern concentrations.',
    nistControls: ['IR-4', 'SI-4'],
  })

  return results
}

// ── M365 Defender XDR checks ──────────────────────────────────────────────────

async function checkXDRIncidents(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<DefenderCheckResult[]> {
  const results: DefenderCheckResult[] = []

  let incidents: XdrIncident[] = []
  try {
    const graphToken = await getMSGraphToken(tenantId, clientId, clientSecret)
    incidents = await graphGetAll<XdrIncident>(graphToken, '/security/incidents')
  } catch {
    return [
      {
        category: 'xdr_incidents',
        checkId: 'defender.xdr.active_incidents',
        title: 'XDR Incidents — Unable to Fetch',
        status: 'warn',
        severity: 'medium',
        recommendation: 'Unable to fetch M365 Defender incidents. Verify SecurityIncident.Read.All permission.',
        nistControls: ['IR-4', 'IR-6'],
      },
    ]
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const active = incidents.filter((i) => i.status === 'active' || i.status === 'inProgress')
  const activeCritical = active.filter((i) => i.severity === 'high' || i.severity === 'critical')
  const unassigned = active.filter((i) => !i.assignedTo)

  const toIncidentItem = (i: XdrIncident) => ({
    id: i.id,
    title: i.displayName ?? i.id,
    severity: i.severity ?? 'medium',
    description: `Status: ${i.status ?? 'unknown'} | Assigned: ${i.assignedTo ?? 'Unassigned'}`,
  })

  results.push({
    category: 'xdr_incidents',
    checkId: 'defender.xdr.active_incidents',
    title: 'XDR Active Critical Incidents',
    status: activeCritical.length > 0 ? 'fail' : 'pass',
    severity: activeCritical.length > 0 ? 'critical' : 'low',
    count: activeCritical.length,
    items: activeCritical.slice(0, 10).map(toIncidentItem),
    recommendation:
      activeCritical.length > 0
        ? 'Escalate critical incidents immediately. Assign to senior analysts.'
        : 'No active critical XDR incidents.',
    nistControls: ['IR-4', 'IR-6', 'SI-4'],
  })

  // Average resolution time
  const resolved = incidents.filter((i) => i.status === 'resolved' && i.createdDateTime && i.lastUpdateDateTime)
  const recentResolved = resolved.filter((i) => new Date(i.createdDateTime!) > thirtyDaysAgo)
  let avgResolutionHours = 0
  if (recentResolved.length > 0) {
    const totalMs = recentResolved.reduce((acc, i) => {
      const created = new Date(i.createdDateTime!).getTime()
      const updated = new Date(i.lastUpdateDateTime!).getTime()
      return acc + (updated - created)
    }, 0)
    avgResolutionHours = totalMs / recentResolved.length / 3600000
  }

  results.push({
    category: 'xdr_incidents',
    checkId: 'defender.xdr.avg_resolution_time',
    title: 'XDR Average Incident Resolution Time',
    status: avgResolutionHours > 24 ? 'fail' : avgResolutionHours > 4 ? 'warn' : 'pass',
    severity: avgResolutionHours > 24 ? 'high' : avgResolutionHours > 4 ? 'medium' : 'low',
    score: Math.round(avgResolutionHours),
    count: recentResolved.length,
    recommendation:
      avgResolutionHours > 24
        ? 'Average resolution time exceeds 24h. Review incident response playbooks and staffing.'
        : avgResolutionHours > 4
        ? 'Resolution time is elevated. Aim for <4h mean time to resolve.'
        : 'Incident resolution time is within acceptable range.',
    nistControls: ['IR-4', 'IR-8'],
  })

  results.push({
    category: 'xdr_incidents',
    checkId: 'defender.xdr.unassigned_incidents',
    title: 'Unassigned Active XDR Incidents',
    status: unassigned.length > 0 ? 'warn' : 'pass',
    severity: unassigned.length > 5 ? 'high' : unassigned.length > 0 ? 'medium' : 'low',
    count: unassigned.length,
    items: unassigned.slice(0, 10).map(toIncidentItem),
    recommendation: 'Assign all active incidents to analysts within 1 hour of creation.',
    nistControls: ['IR-4', 'IR-10'],
  })

  // Repeated threat actors
  const actorMap: Record<string, number> = {}
  for (const incident of incidents) {
    if (new Date(incident.createdDateTime ?? 0) > thirtyDaysAgo) {
      for (const alert of incident.alerts ?? []) {
        const actor = alert.actorDisplayName
        if (actor) actorMap[actor] = (actorMap[actor] ?? 0) + 1
      }
    }
  }
  const repeatedActors = Object.entries(actorMap)
    .filter(([, count]) => count > 2)
    .map(([actor, count]) => ({
      id: actor,
      title: actor,
      severity: 'high',
      description: `Seen ${count} times in last 30 days`,
    }))

  results.push({
    category: 'xdr_incidents',
    checkId: 'defender.xdr.repeated_attackers',
    title: 'Repeated Threat Actors (30d)',
    status: repeatedActors.length > 0 ? 'fail' : 'pass',
    severity: repeatedActors.length > 0 ? 'high' : 'low',
    count: repeatedActors.length,
    items: repeatedActors,
    recommendation:
      repeatedActors.length > 0
        ? 'Threat actors are persistent. Escalate to threat intelligence team and consider blocking IOCs.'
        : 'No repeated threat actors detected in the past 30 days.',
    nistControls: ['IR-4', 'RA-3', 'SI-5'],
  })

  return results
}

// ── Defender Plans / Coverage checks ─────────────────────────────────────────

async function checkPlans(
  armToken: string,
  subscriptionId: string,
): Promise<DefenderCheckResult[]> {
  const results: DefenderCheckResult[] = []

  let pricings: { value: PricingItem[] } = { value: [] }
  try {
    pricings = await armGet<{ value: PricingItem[] }>(
      armToken,
      `${ARM_BASE}/subscriptions/${subscriptionId}/providers/Microsoft.Security/pricings?api-version=2022-03-01`,
    )
  } catch {
    return [
      {
        category: 'coverage',
        checkId: 'defender.plans.coverage',
        title: 'Defender Plans — Unable to Fetch',
        status: 'warn',
        severity: 'medium',
        recommendation: 'Unable to retrieve Defender plan pricing data. Check Microsoft.Security/pricings/read permission.',
        nistControls: ['SI-3', 'SI-4'],
      },
    ]
  }

  const planMap: Record<string, boolean> = {}
  for (const p of pricings.value) {
    planMap[p.name] = p.properties?.pricingTier === 'Standard'
  }

  const planItems = pricings.value.map((p) => ({
    id: p.name,
    title: p.name,
    severity: planMap[p.name] ? 'info' : 'medium',
    description: `Plan: ${p.properties?.pricingTier ?? 'Free'} ${p.properties?.subPlan ? `(${p.properties.subPlan})` : ''}`,
  }))

  const enabledCount = Object.values(planMap).filter(Boolean).length
  const totalCount = pricings.value.length

  results.push({
    category: 'coverage',
    checkId: 'defender.plans.coverage',
    title: 'Defender Plans Coverage',
    status: enabledCount === 0 ? 'fail' : enabledCount < totalCount / 2 ? 'warn' : 'pass',
    severity: enabledCount === 0 ? 'critical' : enabledCount < totalCount / 2 ? 'high' : 'low',
    score: totalCount > 0 ? Math.round((enabledCount / totalCount) * 100) : 0,
    maxScore: 100,
    count: enabledCount,
    items: planItems,
    recommendation: 'Enable Defender Standard tier for all critical resource types.',
    nistControls: ['SI-3', 'SI-4', 'CA-7'],
  })

  results.push({
    category: 'coverage',
    checkId: 'defender.plans.servers_enabled',
    title: 'Defender for Servers Enabled',
    status: planMap['VirtualMachines'] ? 'pass' : 'fail',
    severity: planMap['VirtualMachines'] ? 'low' : 'critical',
    recommendation: planMap['VirtualMachines']
      ? 'Defender for Servers is enabled.'
      : 'Enable Defender for Servers to protect virtual machines with vulnerability assessment and threat detection.',
    nistControls: ['SI-2', 'SI-3', 'SI-4'],
  })

  results.push({
    category: 'coverage',
    checkId: 'defender.plans.containers_enabled',
    title: 'Defender for Containers Enabled',
    status: planMap['Containers'] ? 'pass' : 'warn',
    severity: planMap['Containers'] ? 'low' : 'medium',
    recommendation: planMap['Containers']
      ? 'Defender for Containers is enabled.'
      : 'Enable Defender for Containers if AKS workloads are present to detect runtime threats.',
    nistControls: ['SI-3', 'SI-4', 'CM-7'],
  })

  return results
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runDefenderChecks(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  subscriptionId: string,
): Promise<DefenderCheckResult[]> {
  const armToken = await getARMToken(tenantId, clientId, clientSecret)

  const [scoreChecks, recChecks, alertChecks, xdrChecks, planChecks] = await Promise.allSettled([
    checkSecureScore(armToken, subscriptionId),
    checkRecommendations(armToken, subscriptionId),
    checkAlerts(armToken, subscriptionId),
    checkXDRIncidents(tenantId, clientId, clientSecret),
    checkPlans(armToken, subscriptionId),
  ])

  const allResults: DefenderCheckResult[] = []
  for (const result of [scoreChecks, recChecks, alertChecks, xdrChecks, planChecks]) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value)
    }
  }

  return allResults
}
