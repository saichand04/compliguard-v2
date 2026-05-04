/**
 * lib/microsoft/sentinel.ts
 * Azure Sentinel SIEM integration via Security Insights API + Log Analytics.
 */

const TOKEN_ENDPOINT = 'https://login.microsoftonline.com'
const ARM_BASE = 'https://management.azure.com'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SentinelConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  subscriptionId: string
  resourceGroup: string
  workspaceName: string
}

export interface SentinelCheckResult {
  category: 'incidents' | 'analytics_rules' | 'watchlists' | 'threat_intel' | 'data_connectors'
  checkId: string
  title: string
  status: 'pass' | 'fail' | 'warn' | 'info'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  count?: number
  score?: number
  items?: Array<{ id: string; name: string; severity?: string; status?: string; tactics?: string[] }>
  recommendation: string
  nistControls: string[]
}

// ── Sentinel raw API types ────────────────────────────────────────────────────

interface SentinelIncident {
  id: string
  name: string
  properties?: {
    title?: string
    severity?: string
    status?: string
    owner?: { assignedTo?: string }
    createdTimeUtc?: string
    lastModifiedTimeUtc?: string
    firstActivityTimeUtc?: string
    additionalData?: { tactics?: string[]; alertProductNames?: string[] }
    labels?: Array<{ labelName?: string }>
  }
}

interface AlertRule {
  id: string
  name: string
  kind?: string
  properties?: {
    displayName?: string
    enabled?: boolean
    severity?: string
    tactics?: string[]
  }
}

interface Watchlist {
  id: string
  name: string
  properties?: {
    displayName?: string
    itemsSearchKey?: string
    numberOfLinesToSkip?: number
    watchlistItemsCount?: number
    description?: string
  }
}

interface DataConnector {
  id: string
  name: string
  kind?: string
  properties?: {
    tenantId?: string
    dataTypes?: Record<string, unknown>
    connectorUiConfig?: { title?: string }
  }
}

interface ThreatIndicator {
  id: string
  name: string
  properties?: {
    pattern?: string
    patternType?: string
    validFrom?: string
    validUntil?: string
    confidence?: number
    indicatorTypes?: string[]
  }
}

// ── Token + request helpers ───────────────────────────────────────────────────

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

function sentinelBase(cfg: SentinelConfig): string {
  return (
    `${ARM_BASE}/subscriptions/${cfg.subscriptionId}` +
    `/resourceGroups/${cfg.resourceGroup}` +
    `/providers/Microsoft.OperationalInsights/workspaces/${cfg.workspaceName}` +
    `/providers/Microsoft.SecurityInsights`
  )
}

// ── Incidents checks ──────────────────────────────────────────────────────────

async function checkIncidents(
  token: string,
  cfg: SentinelConfig,
): Promise<SentinelCheckResult[]> {
  const results: SentinelCheckResult[] = []
  const base = sentinelBase(cfg)

  let incidents: SentinelIncident[] = []
  try {
    const resp = await armGet<{ value: SentinelIncident[] }>(
      token,
      `${base}/incidents?api-version=2023-02-01&$top=200`,
    )
    incidents = resp.value ?? []
  } catch {
    return [
      {
        category: 'incidents',
        checkId: 'sentinel.incidents.open_critical',
        title: 'Sentinel Incidents — Unable to Fetch',
        status: 'warn',
        severity: 'medium',
        recommendation: 'Unable to fetch Sentinel incidents. Verify Microsoft.SecurityInsights/incidents/read permission.',
        nistControls: ['IR-4', 'IR-5'],
      },
    ]
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const open = incidents.filter((i) => i.properties?.status === 'New' || i.properties?.status === 'Active')
  const openCritical = open.filter((i) => i.properties?.severity === 'High')
  const openCriticalUnassigned = openCritical.filter((i) => !i.properties?.owner?.assignedTo)
  const openHigh = open.filter((i) => i.properties?.severity === 'Medium')
  const openHighUnassigned = openHigh.filter((i) => !i.properties?.owner?.assignedTo)

  const toItem = (i: SentinelIncident) => ({
    id: i.name,
    name: i.properties?.title ?? i.name,
    severity: i.properties?.severity,
    status: i.properties?.status,
    tactics: i.properties?.additionalData?.tactics,
  })

  results.push({
    category: 'incidents',
    checkId: 'sentinel.incidents.open_critical',
    title: 'Open Critical Incidents (Unassigned)',
    status: openCriticalUnassigned.length > 0 ? 'fail' : 'pass',
    severity: openCriticalUnassigned.length > 0 ? 'critical' : 'low',
    count: openCriticalUnassigned.length,
    items: openCriticalUnassigned.slice(0, 10).map(toItem),
    recommendation:
      openCriticalUnassigned.length > 0
        ? 'Immediately assign and investigate all unassigned critical incidents.'
        : 'All critical incidents are assigned.',
    nistControls: ['IR-4', 'IR-5', 'IR-6'],
  })

  results.push({
    category: 'incidents',
    checkId: 'sentinel.incidents.open_high',
    title: 'Open High Severity Incidents (Unassigned)',
    status: openHighUnassigned.length > 3 ? 'fail' : openHighUnassigned.length > 0 ? 'warn' : 'pass',
    severity: openHighUnassigned.length > 3 ? 'high' : openHighUnassigned.length > 0 ? 'medium' : 'low',
    count: openHighUnassigned.length,
    items: openHighUnassigned.slice(0, 10).map(toItem),
    recommendation: 'Assign all high severity incidents within 1 hour of creation.',
    nistControls: ['IR-4', 'IR-5'],
  })

  // Average triage time
  const triaged = incidents.filter(
    (i) => i.properties?.status === 'Active' && i.properties?.createdTimeUtc && i.properties?.lastModifiedTimeUtc,
  )
  let avgTriageHours = 0
  if (triaged.length > 0) {
    const totalMs = triaged.reduce((acc, i) => {
      const created = new Date(i.properties!.createdTimeUtc!).getTime()
      const modified = new Date(i.properties!.lastModifiedTimeUtc!).getTime()
      return acc + (modified - created)
    }, 0)
    avgTriageHours = totalMs / triaged.length / 3600000
  }

  results.push({
    category: 'incidents',
    checkId: 'sentinel.incidents.avg_triage_time',
    title: 'Average Incident Triage Time',
    status: avgTriageHours > 4 ? 'fail' : avgTriageHours > 1 ? 'warn' : 'pass',
    severity: avgTriageHours > 4 ? 'high' : avgTriageHours > 1 ? 'medium' : 'low',
    score: Math.round(avgTriageHours * 10) / 10,
    count: triaged.length,
    recommendation:
      avgTriageHours > 4
        ? 'Triage time exceeds 4h. Review analyst workload and automation rules.'
        : avgTriageHours > 1
        ? 'Triage time above 1h target. Consider additional automation playbooks.'
        : 'Triage time is within acceptable range.',
    nistControls: ['IR-4', 'IR-8'],
  })

  // High/critical incidents last 30 days
  const highCrit30d = incidents.filter((i) => {
    const created = i.properties?.createdTimeUtc ? new Date(i.properties.createdTimeUtc) : null
    return created && created > thirtyDaysAgo && ['High', 'Medium'].includes(i.properties?.severity ?? '')
  })

  results.push({
    category: 'incidents',
    checkId: 'sentinel.incidents.high_severity_30d',
    title: 'High/Critical Incidents — Last 30 Days',
    status: highCrit30d.length > 50 ? 'fail' : highCrit30d.length > 20 ? 'warn' : 'info',
    severity: highCrit30d.length > 50 ? 'high' : 'info',
    count: highCrit30d.length,
    items: highCrit30d.slice(0, 10).map(toItem),
    recommendation: 'Track incident volume trends. A sudden spike may indicate an active threat campaign.',
    nistControls: ['IR-5', 'CA-7'],
  })

  // MITRE coverage from incidents
  const tacticSet = new Set<string>()
  for (const i of incidents) {
    for (const t of i.properties?.additionalData?.tactics ?? []) {
      tacticSet.add(t)
    }
  }
  results.push({
    category: 'incidents',
    checkId: 'sentinel.incidents.mitre_coverage',
    title: 'MITRE ATT&CK Tactic Coverage (from Incidents)',
    status: 'info',
    severity: 'info',
    count: tacticSet.size,
    items: Array.from(tacticSet).map((t) => ({ id: t, name: t })),
    recommendation: 'Use tactic coverage to identify detection gaps in your MITRE ATT&CK matrix.',
    nistControls: ['SI-4', 'CA-7'],
  })

  return results
}

// ── Analytics Rules checks ────────────────────────────────────────────────────

async function checkAnalyticsRules(
  token: string,
  cfg: SentinelConfig,
): Promise<SentinelCheckResult[]> {
  const results: SentinelCheckResult[] = []
  const base = sentinelBase(cfg)

  let rules: AlertRule[] = []
  try {
    const resp = await armGet<{ value: AlertRule[] }>(
      token,
      `${base}/alertRules?api-version=2023-02-01`,
    )
    rules = resp.value ?? []
  } catch {
    return [
      {
        category: 'analytics_rules',
        checkId: 'sentinel.rules.total_enabled',
        title: 'Analytics Rules — Unable to Fetch',
        status: 'warn',
        severity: 'medium',
        recommendation: 'Unable to fetch analytics rules. Verify Microsoft.SecurityInsights/alertRules/read permission.',
        nistControls: ['SI-4', 'CA-7'],
      },
    ]
  }

  const enabled = rules.filter((r) => r.properties?.enabled)
  const scheduled = enabled.filter((r) => r.kind === 'Scheduled')
  const mlRules = enabled.filter((r) => r.kind === 'MLBehaviorAnalytics')
  const fusion = enabled.filter((r) => r.kind === 'Fusion')
  const nrt = enabled.filter((r) => r.kind === 'NRT')

  results.push({
    category: 'analytics_rules',
    checkId: 'sentinel.rules.total_enabled',
    title: 'Total Enabled Analytics Rules',
    status: enabled.length < 10 ? 'warn' : 'pass',
    severity: enabled.length < 10 ? 'medium' : 'low',
    count: enabled.length,
    recommendation:
      enabled.length < 10
        ? 'Enable more analytics rules. Consider deploying Microsoft Sentinel Content Hub solutions.'
        : 'Analytics rules coverage is adequate.',
    nistControls: ['SI-4', 'CA-7', 'AU-6'],
  })

  results.push({
    category: 'analytics_rules',
    checkId: 'sentinel.rules.scheduled_enabled',
    title: 'Scheduled Query Rules Enabled',
    status: scheduled.length < 5 ? 'warn' : 'pass',
    severity: scheduled.length < 5 ? 'medium' : 'low',
    count: scheduled.length,
    items: scheduled.slice(0, 10).map((r) => ({
      id: r.name,
      name: r.properties?.displayName ?? r.name,
      severity: r.properties?.severity,
      tactics: r.properties?.tactics,
    })),
    recommendation: 'Deploy scheduled query rules aligned to your threat model and compliance requirements.',
    nistControls: ['SI-4', 'AU-6'],
  })

  results.push({
    category: 'analytics_rules',
    checkId: 'sentinel.rules.ml_rules',
    title: 'ML Behavior Analytics Rules Enabled',
    status: mlRules.length === 0 ? 'warn' : 'pass',
    severity: mlRules.length === 0 ? 'medium' : 'low',
    count: mlRules.length,
    recommendation:
      mlRules.length === 0
        ? 'Enable ML Behavior Analytics rules for anomaly-based detection.'
        : 'ML rules are enabled for behavioral anomaly detection.',
    nistControls: ['SI-4', 'AU-6'],
  })

  results.push({
    category: 'analytics_rules',
    checkId: 'sentinel.rules.fusion_enabled',
    title: 'Fusion (Correlation) Rule Enabled',
    status: fusion.length === 0 ? 'fail' : 'pass',
    severity: fusion.length === 0 ? 'high' : 'low',
    count: fusion.length,
    recommendation:
      fusion.length === 0
        ? 'Enable the Fusion rule to correlate low-fidelity signals into high-confidence incidents.'
        : 'Fusion correlation rule is active.',
    nistControls: ['SI-4', 'IR-4'],
  })

  results.push({
    category: 'analytics_rules',
    checkId: 'sentinel.rules.nrt_enabled',
    title: 'Near-Real-Time Detection Rules',
    status: nrt.length === 0 ? 'warn' : 'pass',
    severity: nrt.length === 0 ? 'medium' : 'low',
    count: nrt.length,
    recommendation:
      nrt.length === 0
        ? 'Consider enabling NRT rules for time-sensitive threat scenarios.'
        : 'NRT rules are enabled for rapid threat detection.',
    nistControls: ['SI-4', 'IR-4'],
  })

  return results
}

// ── Watchlists checks ─────────────────────────────────────────────────────────

async function checkWatchlists(
  token: string,
  cfg: SentinelConfig,
): Promise<SentinelCheckResult[]> {
  const results: SentinelCheckResult[] = []
  const base = sentinelBase(cfg)

  let watchlists: Watchlist[] = []
  try {
    const resp = await armGet<{ value: Watchlist[] }>(
      token,
      `${base}/watchlists?api-version=2023-02-01`,
    )
    watchlists = resp.value ?? []
  } catch {
    return [
      {
        category: 'watchlists',
        checkId: 'sentinel.watchlists.count',
        title: 'Watchlists — Unable to Fetch',
        status: 'warn',
        severity: 'medium',
        recommendation: 'Unable to fetch watchlists. Verify Microsoft.SecurityInsights/watchlists/read permission.',
        nistControls: ['SI-4'],
      },
    ]
  }

  const wlItems = watchlists.map((w) => ({
    id: w.name,
    name: w.properties?.displayName ?? w.name,
    status: `${w.properties?.watchlistItemsCount ?? 0} items`,
  }))

  results.push({
    category: 'watchlists',
    checkId: 'sentinel.watchlists.count',
    title: 'Watchlists Configured',
    status: 'info',
    severity: 'info',
    count: watchlists.length,
    items: wlItems,
    recommendation: 'Maintain watchlists for trusted IPs, vulnerable assets, and sensitive users.',
    nistControls: ['SI-4', 'CA-7'],
  })

  const hasIpAllowlist = watchlists.some(
    (w) =>
      (w.properties?.displayName ?? w.name).toLowerCase().includes('ip') ||
      (w.properties?.displayName ?? w.name).toLowerCase().includes('allow'),
  )
  results.push({
    category: 'watchlists',
    checkId: 'sentinel.watchlists.ip_allowlist',
    title: 'Trusted IP Allowlist Watchlist',
    status: hasIpAllowlist ? 'pass' : 'warn',
    severity: hasIpAllowlist ? 'low' : 'medium',
    recommendation: hasIpAllowlist
      ? 'Trusted IP allowlist watchlist is configured.'
      : 'Create a watchlist for trusted/allowlisted IP ranges to reduce false positives.',
    nistControls: ['SC-7', 'SI-4'],
  })

  const hasVulnAssets = watchlists.some(
    (w) =>
      (w.properties?.displayName ?? w.name).toLowerCase().includes('vuln') ||
      (w.properties?.displayName ?? w.name).toLowerCase().includes('asset'),
  )
  results.push({
    category: 'watchlists',
    checkId: 'sentinel.watchlists.vuln_assets',
    title: 'Vulnerable Assets Watchlist',
    status: hasVulnAssets ? 'pass' : 'warn',
    severity: hasVulnAssets ? 'low' : 'medium',
    recommendation: hasVulnAssets
      ? 'Vulnerable assets watchlist is maintained.'
      : 'Maintain a vulnerable assets watchlist to prioritize alerts on high-risk resources.',
    nistControls: ['RA-5', 'SI-4'],
  })

  return results
}

// ── Data Connectors checks ────────────────────────────────────────────────────

async function checkDataConnectors(
  token: string,
  cfg: SentinelConfig,
): Promise<SentinelCheckResult[]> {
  const results: SentinelCheckResult[] = []
  const base = sentinelBase(cfg)

  let connectors: DataConnector[] = []
  try {
    const resp = await armGet<{ value: DataConnector[] }>(
      token,
      `${base}/dataConnectors?api-version=2023-02-01`,
    )
    connectors = resp.value ?? []
  } catch {
    return [
      {
        category: 'data_connectors',
        checkId: 'sentinel.connectors.aad_enabled',
        title: 'Data Connectors — Unable to Fetch',
        status: 'warn',
        severity: 'medium',
        recommendation: 'Unable to fetch data connectors. Verify Microsoft.SecurityInsights/dataConnectors/read permission.',
        nistControls: ['AU-2', 'SI-4'],
      },
    ]
  }

  const hasConnector = (kinds: string[]) =>
    connectors.some((c) => c.kind && kinds.some((k) => c.kind!.toLowerCase().includes(k.toLowerCase())))

  const aadEnabled = hasConnector(['AzureActiveDirectory', 'AzureActiveDirectoryDiagnostics'])
  const defenderEnabled = hasConnector(['MicrosoftDefenderAdvancedThreatProtection', 'MicrosoftThreatProtection'])
  const office365Enabled = hasConnector(['Office365', 'OfficeATP'])
  const syslogEnabled = hasConnector(['Syslog', 'CommonEventFormat', 'CEF'])

  results.push({
    category: 'data_connectors',
    checkId: 'sentinel.connectors.aad_enabled',
    title: 'Azure Active Directory Connector',
    status: aadEnabled ? 'pass' : 'fail',
    severity: aadEnabled ? 'low' : 'high',
    recommendation: aadEnabled
      ? 'Azure AD connector is ingesting sign-in and audit logs.'
      : 'Enable the Azure AD connector to ingest identity and authentication telemetry.',
    nistControls: ['AU-2', 'AU-12', 'IA-5'],
  })

  results.push({
    category: 'data_connectors',
    checkId: 'sentinel.connectors.defender_enabled',
    title: 'Microsoft Defender Connector',
    status: defenderEnabled ? 'pass' : 'warn',
    severity: defenderEnabled ? 'low' : 'medium',
    recommendation: defenderEnabled
      ? 'Microsoft Defender alerts are flowing into Sentinel.'
      : 'Enable the Microsoft Defender connector for correlated endpoint and XDR telemetry.',
    nistControls: ['SI-4', 'IR-4'],
  })

  results.push({
    category: 'data_connectors',
    checkId: 'sentinel.connectors.office365_enabled',
    title: 'Office 365 Connector',
    status: office365Enabled ? 'pass' : 'warn',
    severity: office365Enabled ? 'low' : 'medium',
    recommendation: office365Enabled
      ? 'Office 365 activity logs are ingested.'
      : 'Enable Office 365 connector to monitor Exchange, SharePoint, and Teams activities.',
    nistControls: ['AU-2', 'AU-12'],
  })

  results.push({
    category: 'data_connectors',
    checkId: 'sentinel.connectors.syslog_enabled',
    title: 'Syslog / CEF Connector for On-Prem',
    status: syslogEnabled ? 'pass' : 'warn',
    severity: syslogEnabled ? 'low' : 'medium',
    recommendation: syslogEnabled
      ? 'Syslog/CEF connector is configured for on-premises systems.'
      : 'Configure Syslog or CEF connector for on-premises security appliances and servers.',
    nistControls: ['AU-2', 'AU-12', 'SI-4'],
  })

  return results
}

// ── Threat Intelligence checks ────────────────────────────────────────────────

async function checkThreatIntelligence(
  token: string,
  cfg: SentinelConfig,
): Promise<SentinelCheckResult[]> {
  const results: SentinelCheckResult[] = []
  const base = sentinelBase(cfg)

  let indicators: ThreatIndicator[] = []
  try {
    const resp = await armGet<{ value: ThreatIndicator[] }>(
      token,
      `${base}/threatIntelligence/main/indicators?api-version=2022-12-01-preview&$top=200`,
    )
    indicators = resp.value ?? []
  } catch {
    return [
      {
        category: 'threat_intel',
        checkId: 'sentinel.ti.indicators_count',
        title: 'Threat Intelligence — Unable to Fetch',
        status: 'info',
        severity: 'info',
        recommendation: 'Unable to fetch threat intelligence indicators. This is optional but recommended.',
        nistControls: ['RA-3', 'SI-5'],
      },
    ]
  }

  const now = new Date()
  const active = indicators.filter((i) => {
    if (!i.properties?.validUntil) return true
    return new Date(i.properties.validUntil) > now
  })

  results.push({
    category: 'threat_intel',
    checkId: 'sentinel.ti.indicators_count',
    title: 'Threat Intelligence Indicators Count',
    status: 'info',
    severity: 'info',
    count: indicators.length,
    recommendation: 'Integrate threat intelligence feeds to enrich detections with IOC context.',
    nistControls: ['RA-3', 'SI-5'],
  })

  results.push({
    category: 'threat_intel',
    checkId: 'sentinel.ti.active_indicators',
    title: 'Active (Non-Expired) TI Indicators',
    status: active.length === 0 && indicators.length > 0 ? 'warn' : 'info',
    severity: 'info',
    count: active.length,
    recommendation:
      active.length === 0
        ? 'All threat intelligence indicators have expired. Refresh TI feeds.'
        : 'Active indicators are present for IOC matching.',
    nistControls: ['RA-3', 'SI-5'],
  })

  // IoC types
  const iocTypes = new Set<string>()
  for (const i of indicators) {
    const pt = i.properties?.patternType ?? 'unknown'
    iocTypes.add(pt)
  }

  results.push({
    category: 'threat_intel',
    checkId: 'sentinel.ti.ioc_types',
    title: 'IoC Types Present',
    status: 'info',
    severity: 'info',
    count: iocTypes.size,
    items: Array.from(iocTypes).map((t) => ({ id: t, name: t })),
    recommendation: 'Ensure a diverse set of IoC types (IP, domain, hash, URL) for broad threat coverage.',
    nistControls: ['SI-5', 'RA-3'],
  })

  return results
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runSentinelChecks(config: SentinelConfig): Promise<SentinelCheckResult[]> {
  const token = await getARMToken(config.tenantId, config.clientId, config.clientSecret)

  const [incidentChecks, ruleChecks, watchlistChecks, connectorChecks, tiChecks] =
    await Promise.allSettled([
      checkIncidents(token, config),
      checkAnalyticsRules(token, config),
      checkWatchlists(token, config),
      checkDataConnectors(token, config),
      checkThreatIntelligence(token, config),
    ])

  const allResults: SentinelCheckResult[] = []
  for (const result of [incidentChecks, ruleChecks, watchlistChecks, connectorChecks, tiChecks]) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value)
    }
  }

  return allResults
}

// ── Sentinel incidents (for ingestion) ───────────────────────────────────────

export async function fetchSentinelIncidents(config: SentinelConfig): Promise<SentinelIncident[]> {
  const token = await getARMToken(config.tenantId, config.clientId, config.clientSecret)
  const base = sentinelBase(config)
  const resp = await armGet<{ value: SentinelIncident[] }>(
    token,
    `${base}/incidents?api-version=2023-02-01&$top=100&$filter=properties/status ne 'Closed'`,
  )
  return resp.value ?? []
}

export type { SentinelIncident }
