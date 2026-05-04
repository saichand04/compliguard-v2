/**
 * lib/integrations/jira.ts
 * Jira Cloud REST API v3 integration — no SDK, raw fetch().
 */

export interface JiraConfig {
  email: string
  apiToken: string
  subdomain: string
  projectKey: string
  findingIssuetype?: string
}

interface JiraAdfNode {
  type: string
  attrs?: Record<string, unknown>
  content?: JiraAdfNode[]
  text?: string
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

function getBaseUrl(subdomain: string): string {
  return `https://${subdomain}.atlassian.net/rest/api/3`
}

function getAuthHeader(email: string, apiToken: string): string {
  const encoded = Buffer.from(`${email}:${apiToken}`).toString('base64')
  return `Basic ${encoded}`
}

/** Map finding severity to Jira priority name */
function severityToPriority(severity: string): string {
  const map: Record<string, string> = {
    critical: 'Highest',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    info: 'Lowest',
  }
  return map[severity.toLowerCase()] ?? 'Medium'
}

/** Build Atlassian Document Format (ADF) body for a finding */
function buildAdfDescription(description: string, remediation?: string): JiraAdfNode {
  const content: JiraAdfNode[] = [
    {
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Finding Details' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: description || 'No description provided.' }],
    },
  ]

  if (remediation) {
    content.push(
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Remediation' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: remediation }],
      },
    )
  }

  return { version: 1, type: 'doc', content } as unknown as JiraAdfNode
}

/**
 * Create a Jira issue from a finding.
 * Returns the issueKey and issueUrl.
 */
export async function createJiraIssue(
  config: JiraConfig,
  finding: {
    id: string
    title: string
    description: string
    severity: string
    source: string
    cveId?: string
    remediation?: string
  },
): Promise<{ issueKey: string; issueUrl: string }> {
  const baseUrl = getBaseUrl(config.subdomain)
  const auth = getAuthHeader(config.email, config.apiToken)

  // Build issue summary — include CVE if present
  const summary = finding.cveId
    ? `[${finding.severity.toUpperCase()}] ${finding.title} (${finding.cveId})`
    : `[${finding.severity.toUpperCase()}] ${finding.title}`

  const issueBody: Record<string, unknown> = {
    fields: {
      project: { key: config.projectKey },
      summary,
      description: buildAdfDescription(finding.description, finding.remediation),
      issuetype: { name: config.findingIssuetype || 'Bug' },
      priority: { name: severityToPriority(finding.severity) },
      labels: ['compliguard', finding.source, finding.severity],
    },
  }

  const res = await fetch(`${baseUrl}/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth,
      Accept: 'application/json',
    },
    body: JSON.stringify(issueBody),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Jira createIssue failed (${res.status}): ${errText}`)
  }

  const data = await res.json() as { id: string; key: string; self: string }
  const issueKey = data.key
  const issueUrl = `https://${config.subdomain}.atlassian.net/browse/${issueKey}`

  return { issueKey, issueUrl }
}

/**
 * Get the status name of a Jira issue.
 */
export async function getJiraIssueStatus(config: JiraConfig, issueKey: string): Promise<string> {
  const baseUrl = getBaseUrl(config.subdomain)
  const auth = getAuthHeader(config.email, config.apiToken)

  const res = await fetch(`${baseUrl}/issue/${issueKey}?fields=status`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`Jira getIssueStatus failed (${res.status})`)
  }

  const data = await res.json() as {
    fields: { status: { name: string } }
  }
  return data.fields.status.name
}

/** Map Jira status to CompliGuard finding status */
export function jiraStatusToFindingStatus(
  jiraStatus: string,
): 'open' | 'in_remediation' | 'resolved' | 'accepted' {
  const normalized = jiraStatus.toLowerCase()

  if (['to do', 'open', 'new', 'backlog'].includes(normalized)) return 'open'
  if (['in progress', 'in review', 'in development', 'review'].includes(normalized))
    return 'in_remediation'
  if (['done', 'resolved', 'closed', 'complete', 'completed'].includes(normalized))
    return 'resolved'
  if (["won't fix", "won't do", 'wont fix', 'wont do', 'invalid', 'duplicate'].includes(normalized))
    return 'accepted'

  return 'open'
}

/**
 * Sync a finding's status from its linked Jira issue.
 */
export async function syncFindingFromJira(
  config: JiraConfig,
  issueKey: string,
  findingId: string,
): Promise<void> {
  const { db } = await import('@/lib/db')
  const { findings } = await import('@/lib/db/schema')
  const { eq } = await import('drizzle-orm')

  const jiraStatus = await getJiraIssueStatus(config, issueKey)
  const findingStatus = jiraStatusToFindingStatus(jiraStatus)

  await db
    .update(findings)
    .set({ status: findingStatus, updatedAt: new Date() })
    .where(eq(findings.id, findingId))
}

/**
 * List available Jira projects.
 */
export async function listJiraProjects(
  config: JiraConfig,
): Promise<{ key: string; name: string }[]> {
  const baseUrl = getBaseUrl(config.subdomain)
  const auth = getAuthHeader(config.email, config.apiToken)

  const res = await fetch(`${baseUrl}/project/search?maxResults=100&orderBy=name`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`Jira listProjects failed (${res.status})`)
  }

  const data = await res.json() as {
    values: Array<{ key: string; name: string }>
  }
  return data.values.map((p) => ({ key: p.key, name: p.name }))
}

/**
 * List issue types for a Jira project.
 */
export async function listJiraIssueTypes(
  config: JiraConfig,
  projectKey: string,
): Promise<{ id: string; name: string }[]> {
  const baseUrl = getBaseUrl(config.subdomain)
  const auth = getAuthHeader(config.email, config.apiToken)

  const res = await fetch(`${baseUrl}/issue/createmeta/${projectKey}/issuetypes`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`Jira listIssueTypes failed (${res.status})`)
  }

  const data = await res.json() as {
    issueTypes: Array<{ id: string; name: string }>
  }
  return (data.issueTypes || []).map((t) => ({ id: t.id, name: t.name }))
}
