/**
 * lib/integrations/github.ts
 * GitHub security checks runner using GitHub REST API (no SDK).
 *
 * Config: { token: string, owner?: string }
 * Token: Personal Access Token or GitHub App token
 */

import type { IntegrationCheckResult } from './base'

const GH_API = 'https://api.github.com'

// ── HTTP helper ────────────────────────────────────────────────────────────────

async function ghFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<{ data: T | null; status: number; error?: string }> {
  try {
    const res = await fetch(`${GH_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options?.headers ?? {}),
      },
    })

    if (res.status === 404) return { data: null, status: 404, error: 'Not found' }
    if (res.status === 403) return { data: null, status: 403, error: 'Forbidden / insufficient permissions' }
    if (res.status === 401) return { data: null, status: 401, error: 'Unauthorized — invalid token' }

    if (!res.ok) {
      const text = await res.text()
      return { data: null, status: res.status, error: text }
    }

    const data = (await res.json()) as T
    return { data, status: res.status }
  } catch (err) {
    return { data: null, status: 0, error: String(err) }
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface GHRepo {
  name: string
  full_name: string
  default_branch: string
  private: boolean
  visibility: string
}

interface GHBranchProtection {
  required_pull_request_reviews?: {
    required_approving_review_count: number
    dismiss_stale_reviews: boolean
  }
  required_status_checks?: unknown
  enforce_admins?: { enabled: boolean }
}

interface GHOrg {
  login: string
  two_factor_requirement_enabled: boolean | null
  default_repository_permission: string
}

interface GHMember {
  login: string
  role?: string
}

interface GHDeployKey {
  id: number
  key: string
  title: string
  created_at: string
  read_only: boolean
}

interface GHActionsPermissions {
  default_workflow_permissions?: string
  can_approve_pull_request_reviews?: boolean
}

interface GHDependabotAlert {
  number: number
  state: string
  security_advisory: {
    severity: string
    summary: string
  }
  repository?: { name: string }
}

// ── Individual checks ──────────────────────────────────────────────────────────

/**
 * 1. github.branch_protection
 * NIST: SA-15, CM-3, CM-9
 */
async function checkBranchProtection(
  token: string,
  repos: GHRepo[],
): Promise<IntegrationCheckResult> {
  const unprotected: string[] = []
  const noReviews: string[] = []

  for (const repo of repos.slice(0, 30)) {
    const { data, status } = await ghFetch<GHBranchProtection>(
      `/repos/${repo.full_name}/branches/${repo.default_branch}/protection`,
      token,
    )

    if (status === 404 || !data) {
      unprotected.push(repo.full_name)
    } else {
      if (!data.required_pull_request_reviews) {
        noReviews.push(repo.full_name)
      }
    }
  }

  const allIssues = [...unprotected, ...noReviews]

  return {
    checkId: 'github.branch_protection',
    title: 'Branch Protection Rules',
    description: allIssues.length === 0
      ? 'All default branches have protection rules enforced.'
      : `${allIssues.length} repositories missing branch protection or PR review requirements.`,
    status: allIssues.length === 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: allIssues.slice(0, 5).join(', ') || undefined,
    remediation: 'Enable branch protection on default branches: require PR reviews, dismiss stale reviews, require status checks.',
    evidence: `Checked ${repos.length} repositories. Unprotected: ${unprotected.length}, Missing review requirements: ${noReviews.length}.`,
    rawData: { unprotected, noReviews },
  }
}

/**
 * 2. github.secret_scanning
 * NIST: SI-3, SA-11
 */
async function checkSecretScanning(
  token: string,
  owner: string,
  repos: GHRepo[],
): Promise<IntegrationCheckResult> {
  const { data: orgSecrets } = await ghFetch<{ security_and_analysis?: { secret_scanning?: { status: string } } }>(
    `/orgs/${owner}`,
    token,
  )

  const notEnabled: string[] = []

  for (const repo of repos.slice(0, 20)) {
    const { data } = await ghFetch<{ security_and_analysis?: { secret_scanning?: { status: string } } }>(
      `/repos/${repo.full_name}`,
      token,
    )
    if (data?.security_and_analysis?.secret_scanning?.status !== 'enabled') {
      notEnabled.push(repo.full_name)
    }
  }

  const orgEnabled = (orgSecrets as Record<string, unknown> | null)?.['two_factor_requirement_enabled'] !== undefined

  return {
    checkId: 'github.secret_scanning',
    title: 'Secret Scanning',
    description: notEnabled.length === 0
      ? 'Secret scanning is enabled across repositories.'
      : `${notEnabled.length} repositories do not have secret scanning enabled.`,
    status: notEnabled.length === 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: notEnabled.slice(0, 5).join(', ') || undefined,
    remediation: 'Enable GitHub Advanced Security secret scanning for all repositories. Go to Settings → Code security → Secret scanning.',
    evidence: `Checked ${repos.length} repos. Not enabled: ${notEnabled.length}.`,
    rawData: { notEnabled, orgEnabled },
  }
}

/**
 * 3. github.dependabot_alerts
 * NIST: SI-2, RA-5
 */
async function checkDependabotAlerts(
  token: string,
  owner: string,
): Promise<IntegrationCheckResult> {
  const { data: alerts, status } = await ghFetch<GHDependabotAlert[]>(
    `/orgs/${owner}/dependabot/alerts?state=open&per_page=100`,
    token,
  )

  if (status === 403 || status === 404 || !alerts) {
    return {
      checkId: 'github.dependabot_alerts',
      title: 'Dependabot Vulnerability Alerts',
      description: 'Could not retrieve Dependabot alerts — may require GitHub Advanced Security.',
      status: 'skip',
      severity: 'high',
      remediation: 'Enable Dependabot alerts in organization security settings.',
      evidence: 'API returned permission error or feature not enabled.',
    }
  }

  const critical = alerts.filter((a) => a.security_advisory.severity === 'critical')
  const high = alerts.filter((a) => a.security_advisory.severity === 'high')

  return {
    checkId: 'github.dependabot_alerts',
    title: 'Dependabot Vulnerability Alerts',
    description: alerts.length === 0
      ? 'No open Dependabot vulnerability alerts.'
      : `${alerts.length} open Dependabot alerts (${critical.length} critical, ${high.length} high).`,
    status: critical.length > 0 || high.length > 0 ? 'fail' : alerts.length > 0 ? 'warn' : 'pass',
    severity: critical.length > 0 ? 'critical' : 'high',
    resource: `${alerts.length} open alerts`,
    remediation: 'Remediate critical and high Dependabot alerts by upgrading vulnerable dependencies.',
    evidence: `Total open alerts: ${alerts.length}. Critical: ${critical.length}, High: ${high.length}.`,
    rawData: { total: alerts.length, critical: critical.length, high: high.length },
  }
}

/**
 * 4. github.code_scanning
 * NIST: SA-11, SI-3
 */
async function checkCodeScanning(
  token: string,
  repos: GHRepo[],
): Promise<IntegrationCheckResult> {
  const noScanning: string[] = []

  for (const repo of repos.slice(0, 20)) {
    const { data, status } = await ghFetch<unknown[]>(
      `/repos/${repo.full_name}/code-scanning/analyses?per_page=1`,
      token,
    )
    if (status === 404 || !data || (Array.isArray(data) && data.length === 0)) {
      if (!repo.private) continue // skip public repos — may be OSS
      noScanning.push(repo.full_name)
    }
  }

  return {
    checkId: 'github.code_scanning',
    title: 'Code Scanning (SAST)',
    description: noScanning.length === 0
      ? 'Code scanning is configured for private repositories.'
      : `${noScanning.length} private repositories lack code scanning configuration.`,
    status: noScanning.length === 0 ? 'pass' : 'warn',
    severity: 'medium',
    resource: noScanning.slice(0, 5).join(', ') || undefined,
    remediation: 'Enable GitHub Advanced Security code scanning with CodeQL workflows for all private repositories.',
    evidence: `Checked ${repos.filter((r) => r.private).length} private repos. Missing scanning: ${noScanning.length}.`,
    rawData: { noScanning },
  }
}

/**
 * 5. github.required_reviews
 * NIST: CM-3, SA-15
 */
async function checkRequiredReviews(
  token: string,
  repos: GHRepo[],
): Promise<IntegrationCheckResult> {
  const noReviews: string[] = []

  for (const repo of repos.slice(0, 30)) {
    const { data, status } = await ghFetch<GHBranchProtection>(
      `/repos/${repo.full_name}/branches/${repo.default_branch}/protection`,
      token,
    )
    if (status === 404 || !data) continue
    if (
      !data.required_pull_request_reviews ||
      data.required_pull_request_reviews.required_approving_review_count < 1
    ) {
      noReviews.push(repo.full_name)
    }
  }

  return {
    checkId: 'github.required_reviews',
    title: 'Required Pull Request Reviews',
    description: noReviews.length === 0
      ? 'All protected branches require at least 1 approving review.'
      : `${noReviews.length} repositories do not require at least 1 approving review on PRs.`,
    status: noReviews.length === 0 ? 'pass' : 'fail',
    severity: 'medium',
    resource: noReviews.slice(0, 5).join(', ') || undefined,
    remediation: 'Configure branch protection to require at least 1 approving review before merging.',
    evidence: `Checked ${repos.length} repos. Missing review requirement: ${noReviews.length}.`,
    rawData: { noReviews },
  }
}

/**
 * 6. github.stale_keys
 * NIST: IA-5, AC-2
 */
async function checkStaleKeys(
  token: string,
  repos: GHRepo[],
): Promise<IntegrationCheckResult> {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const staleKeys: Array<{ repo: string; title: string; age: number }> = []

  for (const repo of repos.slice(0, 20)) {
    const { data: keys } = await ghFetch<GHDeployKey[]>(
      `/repos/${repo.full_name}/keys`,
      token,
    )
    if (!keys) continue
    for (const key of keys) {
      const created = new Date(key.created_at)
      if (created < ninetyDaysAgo) {
        const ageDays = Math.floor((Date.now() - created.getTime()) / 86400000)
        staleKeys.push({ repo: repo.full_name, title: key.title, age: ageDays })
      }
    }
  }

  return {
    checkId: 'github.stale_keys',
    title: 'Stale Deploy Keys (>90 days)',
    description: staleKeys.length === 0
      ? 'No deploy keys older than 90 days found.'
      : `${staleKeys.length} deploy keys older than 90 days found.`,
    status: staleKeys.length === 0 ? 'pass' : 'warn',
    severity: 'medium',
    resource: staleKeys.slice(0, 3).map((k) => `${k.repo}: ${k.title} (${k.age}d)`).join(', ') || undefined,
    remediation: 'Rotate or remove deploy keys older than 90 days. Audit key usage and remove unnecessary access.',
    evidence: `Found ${staleKeys.length} stale deploy keys across ${repos.length} repositories.`,
    rawData: { staleKeys },
  }
}

/**
 * 7. github.2fa_enforcement
 * NIST: IA-2, AC-3
 */
async function check2FAEnforcement(
  token: string,
  owner: string,
): Promise<IntegrationCheckResult> {
  const { data: org, status } = await ghFetch<GHOrg>(`/orgs/${owner}`, token)

  if (status === 403 || !org) {
    return {
      checkId: 'github.2fa_enforcement',
      title: '2FA Enforcement for Org Members',
      description: 'Could not check 2FA enforcement — requires organization admin scope.',
      status: 'skip',
      severity: 'critical',
      remediation: 'Enable 2FA requirement in Organization Settings → Authentication security.',
    }
  }

  const enabled = org.two_factor_requirement_enabled === true

  return {
    checkId: 'github.2fa_enforcement',
    title: '2FA Enforcement for Org Members',
    description: enabled
      ? 'Two-factor authentication is required for all organization members.'
      : 'Two-factor authentication is NOT required for organization members.',
    status: enabled ? 'pass' : 'fail',
    severity: 'critical',
    resource: `Organization: ${owner}`,
    remediation: 'Enable 2FA requirement: Organization Settings → Authentication security → Require two-factor authentication.',
    evidence: `Organization ${owner} 2FA requirement: ${enabled ? 'enabled' : 'disabled'}.`,
    rawData: { owner, twoFactorRequired: org.two_factor_requirement_enabled },
  }
}

/**
 * 8. github.admin_count
 * NIST: AC-6, AC-2
 */
async function checkAdminCount(
  token: string,
  owner: string,
): Promise<IntegrationCheckResult> {
  const { data: members, status } = await ghFetch<GHMember[]>(
    `/orgs/${owner}/members?role=admin&per_page=100`,
    token,
  )

  if (status === 403 || !members) {
    return {
      checkId: 'github.admin_count',
      title: 'Organization Admin Count',
      description: 'Could not retrieve admin list — requires organization admin scope.',
      status: 'skip',
      severity: 'medium',
      remediation: 'Audit organization owners and reduce to least-privilege.',
    }
  }

  const count = members.length

  return {
    checkId: 'github.admin_count',
    title: 'Organization Admin Count',
    description: count <= 3
      ? `Organization has ${count} admin(s) — within recommended limit.`
      : `Organization has ${count} admins — exceeds recommended maximum of 3.`,
    status: count <= 3 ? 'pass' : 'warn',
    severity: 'medium',
    resource: `${count} admins: ${members.slice(0, 5).map((m) => m.login).join(', ')}`,
    remediation: 'Reduce organization owners to ≤ 3. Use teams with appropriate permissions instead of org-level admin.',
    evidence: `Found ${count} organization owners/admins.`,
    rawData: { count, admins: members.map((m) => m.login) },
  }
}

/**
 * 9. github.public_repos
 * NIST: AC-3, SC-7
 */
async function checkPublicRepos(repos: GHRepo[]): Promise<IntegrationCheckResult> {
  const publicRepos = repos.filter((r) => r.visibility === 'public' || !r.private)

  return {
    checkId: 'github.public_repos',
    title: 'Public Repository Inventory',
    description: publicRepos.length === 0
      ? 'No public repositories found.'
      : `${publicRepos.length} public repositories found — review for sensitive data exposure.`,
    status: publicRepos.length === 0 ? 'pass' : 'info' as IntegrationCheckResult['status'],
    severity: 'info',
    resource: publicRepos.slice(0, 5).map((r) => r.full_name).join(', ') || undefined,
    remediation: 'Review public repositories for sensitive data, credentials, or internal documentation that should be private.',
    evidence: `Total repos: ${repos.length}. Public: ${publicRepos.length}.`,
    rawData: { publicRepos: publicRepos.map((r) => r.full_name) },
  }
}

/**
 * 10. github.actions_permissions
 * NIST: CM-6, AC-3
 */
async function checkActionsPermissions(
  token: string,
  owner: string,
): Promise<IntegrationCheckResult> {
  const { data: perms, status } = await ghFetch<GHActionsPermissions>(
    `/orgs/${owner}/actions/permissions/workflow`,
    token,
  )

  if (status === 403 || status === 404 || !perms) {
    return {
      checkId: 'github.actions_permissions',
      title: 'GitHub Actions Default Token Permissions',
      description: 'Could not check Actions workflow permissions — requires admin scope.',
      status: 'skip',
      severity: 'medium',
      remediation: 'Set default Actions token permissions to read-only in Organization Settings → Actions → Workflow permissions.',
    }
  }

  const isReadOnly = perms.default_workflow_permissions === 'read'

  return {
    checkId: 'github.actions_permissions',
    title: 'GitHub Actions Default Token Permissions',
    description: isReadOnly
      ? 'GitHub Actions default token permission is read-only (recommended).'
      : `GitHub Actions default token permission is "${perms.default_workflow_permissions}" — should be read-only.`,
    status: isReadOnly ? 'pass' : 'fail',
    severity: 'medium',
    resource: `Organization: ${owner}`,
    remediation: 'Set default workflow permissions to "Read repository contents" in Organization Settings → Actions → Workflow permissions.',
    evidence: `Default workflow permissions: ${perms.default_workflow_permissions ?? 'unknown'}.`,
    rawData: perms,
  }
}

// ── Main runner ────────────────────────────────────────────────────────────────

/**
 * Run all GitHub security checks.
 *
 * @param token Personal Access Token or GitHub App token
 * @param owner GitHub org/user login (optional — inferred from token if absent)
 */
export async function runGitHubChecks(
  token: string,
  owner?: string,
): Promise<IntegrationCheckResult[]> {
  // Resolve the owner if not provided
  let resolvedOwner = owner

  if (!resolvedOwner) {
    const { data: user } = await ghFetch<{ login: string }>('/user', token)
    resolvedOwner = user?.login ?? 'unknown'
  }

  // List repos
  const { data: repos } = await ghFetch<GHRepo[]>(
    `/orgs/${resolvedOwner}/repos?per_page=100&type=all`,
    token,
  )

  // Fall back to user repos if org endpoint fails
  let repoList: GHRepo[] = repos ?? []
  if (!repos || repos.length === 0) {
    const { data: userRepos } = await ghFetch<GHRepo[]>(
      `/user/repos?per_page=100&type=all`,
      token,
    )
    repoList = userRepos ?? []
  }

  // Run all checks in parallel
  const results = await Promise.allSettled([
    checkBranchProtection(token, repoList),
    checkSecretScanning(token, resolvedOwner, repoList),
    checkDependabotAlerts(token, resolvedOwner),
    checkCodeScanning(token, repoList),
    checkRequiredReviews(token, repoList),
    checkStaleKeys(token, repoList),
    check2FAEnforcement(token, resolvedOwner),
    checkAdminCount(token, resolvedOwner),
    checkPublicRepos(repoList),
    checkActionsPermissions(token, resolvedOwner),
  ])

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    // Return a skip result on unexpected error
    const checkIds = [
      'github.branch_protection',
      'github.secret_scanning',
      'github.dependabot_alerts',
      'github.code_scanning',
      'github.required_reviews',
      'github.stale_keys',
      'github.2fa_enforcement',
      'github.admin_count',
      'github.public_repos',
      'github.actions_permissions',
    ]
    return {
      checkId: checkIds[i] ?? `github.check_${i}`,
      title: `Check ${i + 1}`,
      description: `Check failed with error: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
      status: 'skip' as const,
      severity: 'info' as const,
    }
  })
}
