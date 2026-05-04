/**
 * Entra ID (Azure AD) Deep Compliance Checks via Microsoft Graph API
 * Phase 4.1 — 20 checks across MFA, Conditional Access, Privileged Roles, Users/Groups, Sign-in Risk
 */

import { getMSGraphToken, graphGet, graphGetAll } from './graph'

export interface EntraCheckResult {
  category: 'users' | 'groups' | 'conditional_access' | 'privileged_roles' | 'sign_in_risk' | 'mfa'
  checkId: string
  title: string
  status: 'pass' | 'fail' | 'warn' | 'info'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  count?: number
  items?: Array<{ id: string; displayName: string; detail: string }>
  recommendation: string
  nistControls: string[]
}

// ─── Type Definitions ────────────────────────────────────────────────────────

interface CredentialUserRegistrationDetails {
  id: string
  userDisplayName: string
  userPrincipalName: string
  isMfaRegistered: boolean
  isMfaCapable: boolean
  authMethods: string[]
}

interface ConditionalAccessPolicy {
  id: string
  displayName: string
  state: 'enabled' | 'disabled' | 'enabledForReportingButNotEnforced'
  conditions: {
    users?: { includeUsers?: string[]; excludeUsers?: string[]; includeGroups?: string[] }
    applications?: { includeApplications?: string[] }
    signInRiskLevels?: string[]
    clientAppTypes?: string[]
  }
  grantControls?: {
    operator?: string
    builtInControls?: string[]
    customAuthenticationFactors?: string[]
  } | null
  sessionControls?: {
    persistentBrowser?: { isEnabled?: boolean; mode?: string }
  } | null
}

interface RoleAssignment {
  id: string
  principalId: string
  roleDefinitionId: string
  directoryScopeId: string
}

interface RoleDefinition {
  id: string
  displayName: string
  isBuiltIn: boolean
}

interface DirectoryObject {
  id: string
  displayName?: string
  userPrincipalName?: string
  userType?: string
  accountEnabled?: boolean
  signInActivity?: { lastSignInDateTime?: string }
  onPremisesSyncEnabled?: boolean | null
  servicePrincipalType?: string
}

interface Group {
  id: string
  displayName?: string
  securityEnabled?: boolean
  membershipRule?: string | null
  owners?: DirectoryObject[]
}

interface RiskyUser {
  id: string
  userDisplayName: string
  userPrincipalName: string
  riskState: string
  riskLevel: string
  riskLastUpdatedDateTime: string
}

interface RiskDetection {
  id: string
  userDisplayName: string
  userPrincipalName: string
  riskState: string
  riskLevel: string
  riskEventType: string
  activityDateTime: string
}

interface PimAssignment {
  id: string
  principalId: string
  roleDefinitionId: string
  assignmentType?: string
  status?: string
}

// ─── Well-known privileged role IDs (Microsoft built-in) ─────────────────────
const PRIVILEGED_ROLE_TEMPLATE_IDS = new Set([
  '62e90394-69f5-4237-9190-012177145e10', // Global Administrator
  '194ae4cb-b126-40b2-bd5b-6091b380977d', // Security Administrator
  '729827e3-9c14-49f7-bb1b-9608f156bbb8', // Helpdesk Administrator
  'f28a1f50-f6e7-4571-818b-6a12f2af6b6c', // SharePoint Administrator
  'fe930be7-5e62-47db-91af-98c3a49a38b1', // User Administrator
  '9b895d92-2cd3-44c7-9d02-a6ac2d5ea5c3', // Application Administrator
  'c4e39bd9-1100-46d3-8c65-fb160da0071f', // Authentication Administrator
  '966707d0-3269-4727-9be2-8c3a10f19b9d', // Password Administrator
  '7be44c8a-adaf-4e2a-84d6-ab2649e08a13', // Privileged Authentication Administrator
  'e8611ab8-c189-46e8-94e1-60213ab1f814', // Privileged Role Administrator
  '29232cdf-9323-42fd-ade2-1d097af3e4de', // Exchange Administrator
  '75941009-915a-4869-abe7-691bff18279e', // Intune Administrator
])

const GLOBAL_ADMIN_ROLE_TEMPLATE_ID = '62e90394-69f5-4237-9190-012177145e10'

// ─── Helper: check if CA policy is enabled ───────────────────────────────────
function isPolicyEnabled(p: ConditionalAccessPolicy): boolean {
  return p.state === 'enabled'
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function runEntraChecks(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<EntraCheckResult[]> {
  const token = await getMSGraphToken(tenantId, clientId, clientSecret)
  const results: EntraCheckResult[] = []

  // ── Fetch all data in parallel ──────────────────────────────────────────────
  const [
    credDetails,
    caPolicies,
    roleAssignments,
    roleDefinitions,
    users,
    groups,
    riskyUsers,
    riskDetections,
  ] = await Promise.allSettled([
    graphGetAll<CredentialUserRegistrationDetails>(token, '/reports/credentialUserRegistrationDetails'),
    graphGetAll<ConditionalAccessPolicy>(token, '/identity/conditionalAccessPolicies'),
    graphGetAll<RoleAssignment>(token, '/roleManagement/directory/roleAssignments?$top=999'),
    graphGetAll<RoleDefinition>(token, '/roleManagement/directory/roleDefinitions?$filter=isBuiltIn eq true&$top=999'),
    graphGetAll<DirectoryObject>(token, '/users?$select=id,displayName,userPrincipalName,userType,accountEnabled,signInActivity,onPremisesSyncEnabled&$top=999'),
    graphGetAll<Group>(token, '/groups?$select=id,displayName,securityEnabled,membershipRule&$top=999'),
    graphGetAll<RiskyUser>(token, '/identityProtection/riskyUsers?$top=999').catch(() => [] as RiskyUser[]),
    graphGetAll<RiskDetection>(token, '/identityProtection/riskDetections?$top=999').catch(() => [] as RiskDetection[]),
  ])

  const mfaData = credDetails.status === 'fulfilled' ? credDetails.value : []
  const policies = caPolicies.status === 'fulfilled' ? caPolicies.value : []
  const assignments = roleAssignments.status === 'fulfilled' ? roleAssignments.value : []
  const roleDefs = roleDefinitions.status === 'fulfilled' ? roleDefinitions.value : []
  const allUsers = users.status === 'fulfilled' ? users.value : []
  const allGroups = groups.status === 'fulfilled' ? groups.value : []
  const riskyUsersData = riskyUsers.status === 'fulfilled' ? riskyUsers.value : []
  const riskDetectionsData = riskDetections.status === 'fulfilled' ? riskDetections.value : []

  // Build role def map
  const roleDefMap = new Map<string, RoleDefinition>()
  for (const rd of roleDefs) roleDefMap.set(rd.id, rd)

  // Get privileged assignments
  const privilegedAssignments = assignments.filter((a) => {
    const rd = roleDefMap.get(a.roleDefinitionId)
    return rd && PRIVILEGED_ROLE_TEMPLATE_IDS.has(rd.id)
  })

  // Get global admin assignments
  const globalAdminDef = roleDefs.find((r) => r.id === GLOBAL_ADMIN_ROLE_TEMPLATE_ID || r.displayName === 'Global Administrator')
  const globalAdminAssignments = globalAdminDef
    ? assignments.filter((a) => a.roleDefinitionId === globalAdminDef.id)
    : []

  // Fetch PIM eligible assignments (best-effort)
  let pimEligible: PimAssignment[] = []
  try {
    pimEligible = await graphGetAll<PimAssignment>(
      token,
      '/roleManagement/directory/roleEligibilitySchedules?$top=999'
    )
  } catch { /* PIM not licensed */ }

  // ── MFA Checks ───────────────────────────────────────────────────────────────

  // 1. MFA registration rate
  {
    const total = mfaData.length
    const registered = mfaData.filter((u) => u.isMfaRegistered).length
    const rate = total > 0 ? Math.round((registered / total) * 100) : 0
    results.push({
      category: 'mfa',
      checkId: 'entra.mfa.registration_rate',
      title: 'MFA Registration Rate',
      status: rate < 60 ? 'fail' : rate < 80 ? 'warn' : 'pass',
      severity: rate < 60 ? 'critical' : rate < 80 ? 'high' : 'low',
      count: registered,
      recommendation: rate < 80
        ? `Only ${rate}% of users are registered for MFA. Enforce MFA registration via Conditional Access and user onboarding policies.`
        : 'MFA registration rate is acceptable.',
      nistControls: ['IA-2', 'IA-5'],
    })
  }

  // 2. Admin users MFA enabled
  {
    const adminPrincipalIds = new Set(privilegedAssignments.map((a) => a.principalId))
    const adminUsers = mfaData.filter((u) => adminPrincipalIds.has(u.id))
    const adminWithoutMfa = adminUsers.filter((u) => !u.isMfaRegistered)
    results.push({
      category: 'mfa',
      checkId: 'entra.mfa.per_admin_enabled',
      title: 'Admin Users With MFA Enabled',
      status: adminWithoutMfa.length > 0 ? 'fail' : 'pass',
      severity: adminWithoutMfa.length > 0 ? 'critical' : 'low',
      count: adminWithoutMfa.length,
      items: adminWithoutMfa.map((u) => ({
        id: u.id,
        displayName: u.userDisplayName,
        detail: `${u.userPrincipalName} — MFA not registered`,
      })),
      recommendation: adminWithoutMfa.length > 0
        ? 'Immediately enable MFA for all admin-role users. Use Conditional Access to enforce MFA on every admin sign-in.'
        : 'All admin users have MFA registered.',
      nistControls: ['IA-2', 'AC-2'],
    })
  }

  // 3. Weak MFA methods (SMS only)
  {
    const smsOnly = mfaData.filter(
      (u) =>
        u.isMfaRegistered &&
        u.authMethods.length === 1 &&
        u.authMethods[0].toLowerCase().includes('mobile')
    )
    results.push({
      category: 'mfa',
      checkId: 'entra.mfa.methods',
      title: 'Users Using Weak MFA Methods (SMS Only)',
      status: smsOnly.length > 0 ? 'warn' : 'pass',
      severity: smsOnly.length > 0 ? 'medium' : 'info',
      count: smsOnly.length,
      items: smsOnly.slice(0, 20).map((u) => ({
        id: u.id,
        displayName: u.userDisplayName,
        detail: `Auth methods: ${u.authMethods.join(', ')}`,
      })),
      recommendation: smsOnly.length > 0
        ? 'Encourage users to register stronger MFA methods (Authenticator app, FIDO2 key) instead of SMS-only.'
        : 'No users are limited to SMS-only MFA.',
      nistControls: ['IA-2', 'IA-5'],
    })
  }

  // ── Conditional Access Checks ─────────────────────────────────────────────

  const enabledPolicies = policies.filter(isPolicyEnabled)

  // 4. Require MFA for all users
  {
    const policy = enabledPolicies.find(
      (p) =>
        (p.conditions.users?.includeUsers?.includes('All') ||
          p.conditions.users?.includeGroups?.includes('All')) &&
        p.grantControls?.builtInControls?.includes('mfa')
    )
    results.push({
      category: 'conditional_access',
      checkId: 'entra.ca.require_mfa_all_users',
      title: 'Conditional Access: MFA Required for All Users',
      status: policy ? 'pass' : 'fail',
      severity: policy ? 'info' : 'critical',
      recommendation: policy
        ? `Policy "${policy.displayName}" enforces MFA for all users.`
        : 'Create and enable a Conditional Access policy requiring MFA for all users.',
      nistControls: ['IA-2', 'AC-17'],
    })
  }

  // 5. Block legacy auth
  {
    const policy = enabledPolicies.find(
      (p) =>
        p.conditions.clientAppTypes?.some((t) =>
          ['exchangeActiveSync', 'other', 'mobileAppsAndDesktopClients'].includes(t)
        ) &&
        p.grantControls?.builtInControls?.includes('block')
    )
    results.push({
      category: 'conditional_access',
      checkId: 'entra.ca.block_legacy_auth',
      title: 'Conditional Access: Block Legacy Authentication',
      status: policy ? 'pass' : 'fail',
      severity: policy ? 'info' : 'high',
      recommendation: policy
        ? `Policy "${policy.displayName}" blocks legacy authentication.`
        : 'Create a Conditional Access policy blocking legacy authentication protocols (EAS, basic auth).',
      nistControls: ['AC-17', 'SC-8'],
    })
  }

  // 6. Require compliant device
  {
    const policy = enabledPolicies.find(
      (p) =>
        p.grantControls?.builtInControls?.includes('compliantDevice') ||
        p.grantControls?.builtInControls?.includes('domainJoinedDevice')
    )
    results.push({
      category: 'conditional_access',
      checkId: 'entra.ca.require_compliant_device',
      title: 'Conditional Access: Require Compliant Device',
      status: policy ? 'pass' : 'warn',
      severity: policy ? 'info' : 'medium',
      recommendation: policy
        ? `Policy "${policy.displayName}" requires a compliant or domain-joined device.`
        : 'Create a Conditional Access policy requiring Intune-compliant devices for corporate applications.',
      nistControls: ['CM-2', 'SC-7'],
    })
  }

  // 7. Block risky sign-ins
  {
    const policy = enabledPolicies.find(
      (p) =>
        p.conditions.signInRiskLevels?.includes('high') &&
        p.grantControls?.builtInControls?.includes('block')
    )
    results.push({
      category: 'conditional_access',
      checkId: 'entra.ca.risky_sign_in_block',
      title: 'Conditional Access: Block High-Risk Sign-Ins',
      status: policy ? 'pass' : 'fail',
      severity: policy ? 'info' : 'high',
      recommendation: policy
        ? `Policy "${policy.displayName}" blocks high-risk sign-ins.`
        : 'Create a Conditional Access policy that blocks sign-ins with high sign-in risk level.',
      nistControls: ['AC-7', 'SI-4'],
    })
  }

  // 8. Admin MFA always (no persistent session)
  {
    const policy = enabledPolicies.find(
      (p) =>
        p.sessionControls?.persistentBrowser?.isEnabled === false ||
        p.sessionControls?.persistentBrowser?.mode === 'never'
    )
    results.push({
      category: 'conditional_access',
      checkId: 'entra.ca.admin_mfa_always',
      title: 'Conditional Access: No Persistent Sessions for Admins',
      status: policy ? 'pass' : 'warn',
      severity: policy ? 'info' : 'medium',
      recommendation: policy
        ? `Policy "${policy.displayName}" disables persistent browser sessions.`
        : 'Disable persistent browser sessions for admin roles to ensure re-authentication on every sign-in.',
      nistControls: ['AC-12', 'IA-2'],
    })
  }

  // ── Privileged Role Checks ────────────────────────────────────────────────

  // 9. Global Admin count
  {
    const count = globalAdminAssignments.length
    results.push({
      category: 'privileged_roles',
      checkId: 'entra.roles.global_admin_count',
      title: 'Global Administrator Count',
      status: count > 5 ? 'fail' : count > 2 ? 'warn' : 'pass',
      severity: count > 5 ? 'critical' : count > 2 ? 'high' : 'low',
      count,
      recommendation:
        count > 2
          ? `${count} Global Admins detected. Best practice is 2–3 break-glass accounts. Use PIM for just-in-time elevation.`
          : 'Global Admin count is within acceptable range.',
      nistControls: ['AC-2', 'AC-6'],
    })
  }

  // 10. PIM enabled
  {
    const hasPim = pimEligible.length > 0
    const eligibleCount = pimEligible.length
    const permanentCount = privilegedAssignments.length
    results.push({
      category: 'privileged_roles',
      checkId: 'entra.roles.pim_enabled',
      title: 'Privileged Identity Management (PIM) in Use',
      status: hasPim ? 'pass' : 'warn',
      severity: hasPim ? 'info' : 'high',
      count: eligibleCount,
      recommendation: hasPim
        ? `${eligibleCount} eligible PIM assignments found. ${permanentCount} permanent assignments detected.`
        : 'Enable Azure AD PIM to manage privileged role activation with just-in-time access and approval workflows.',
      nistControls: ['AC-2', 'AC-6', 'AU-9'],
    })
  }

  // 11. Service accounts with privileged roles
  {
    const spAssignments = privilegedAssignments.filter((a) => {
      // Service principals have UUIDs as principalIds; we check against non-user objects
      return !mfaData.some((u) => u.id === a.principalId)
    })
    results.push({
      category: 'privileged_roles',
      checkId: 'entra.roles.service_accounts_privileged',
      title: 'Service Principals / Apps With Privileged Roles',
      status: spAssignments.length === 0 ? 'pass' : 'warn',
      severity: spAssignments.length === 0 ? 'info' : 'medium',
      count: spAssignments.length,
      recommendation:
        spAssignments.length > 0
          ? `${spAssignments.length} non-user principals hold privileged role assignments. Review and remove unnecessary service principal role assignments.`
          : 'No service principals found with privileged directory roles.',
      nistControls: ['AC-2', 'IA-9'],
    })
  }

  // 12. Stale privileged assignments (90 days)
  {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const staleUsers = privilegedAssignments
      .map((a) => allUsers.find((u) => u.id === a.principalId))
      .filter((u): u is DirectoryObject => !!u)
      .filter((u) => {
        const lastSignIn = u.signInActivity?.lastSignInDateTime
        if (!lastSignIn) return true
        return new Date(lastSignIn) < ninetyDaysAgo
      })

    results.push({
      category: 'privileged_roles',
      checkId: 'entra.roles.stale_privileged_assignments',
      title: 'Stale Privileged Role Assignments (90+ days)',
      status: staleUsers.length === 0 ? 'pass' : 'fail',
      severity: staleUsers.length === 0 ? 'info' : 'high',
      count: staleUsers.length,
      items: staleUsers.slice(0, 20).map((u) => ({
        id: u.id,
        displayName: u.displayName ?? u.id,
        detail: `Last sign-in: ${u.signInActivity?.lastSignInDateTime ?? 'Never'}`,
      })),
      recommendation:
        staleUsers.length > 0
          ? `${staleUsers.length} privileged users have not signed in for 90+ days. Review and revoke unnecessary role assignments.`
          : 'No stale privileged role assignments found.',
      nistControls: ['AC-2', 'AC-6'],
    })
  }

  // ── Users & Groups Checks ─────────────────────────────────────────────────

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  // 13. Stale accounts (90+ days no sign-in)
  {
    const stale = allUsers.filter((u) => {
      if (!u.accountEnabled) return false
      const lastSignIn = u.signInActivity?.lastSignInDateTime
      if (!lastSignIn) return true
      return new Date(lastSignIn) < ninetyDaysAgo
    })
    results.push({
      category: 'users',
      checkId: 'entra.users.stale_accounts',
      title: 'Stale Active Accounts (90+ Days No Sign-In)',
      status: stale.length === 0 ? 'pass' : stale.length < 5 ? 'warn' : 'fail',
      severity: stale.length === 0 ? 'info' : stale.length < 5 ? 'medium' : 'high',
      count: stale.length,
      items: stale.slice(0, 20).map((u) => ({
        id: u.id,
        displayName: u.displayName ?? u.id,
        detail: `Last sign-in: ${u.signInActivity?.lastSignInDateTime ?? 'Never'} | Enabled: ${u.accountEnabled}`,
      })),
      recommendation:
        stale.length > 0
          ? `${stale.length} enabled accounts with no sign-in in 90+ days. Disable or delete unused accounts.`
          : 'No stale enabled accounts detected.',
      nistControls: ['AC-2', 'IA-4'],
    })
  }

  // 14. Guest user count
  {
    const guests = allUsers.filter((u) => u.userType === 'Guest')
    const total = allUsers.length
    const guestPct = total > 0 ? Math.round((guests.length / total) * 100) : 0
    results.push({
      category: 'users',
      checkId: 'entra.users.guest_count',
      title: 'Guest User Percentage',
      status: guestPct > 10 ? 'warn' : 'pass',
      severity: guestPct > 10 ? 'medium' : 'info',
      count: guests.length,
      recommendation:
        guestPct > 10
          ? `${guests.length} guest users (${guestPct}% of total). Review guest access policies and apply least-privilege external collaboration settings.`
          : `${guests.length} guest users (${guestPct}% of total) — within acceptable range.`,
      nistControls: ['AC-2', 'AC-6'],
    })
  }

  // 15. Shared mailboxes with interactive login
  {
    const sharedWithLogin = allUsers.filter(
      (u) =>
        u.accountEnabled &&
        u.displayName?.toLowerCase().includes('shared') &&
        u.userType !== 'Guest'
    )
    results.push({
      category: 'users',
      checkId: 'entra.users.shared_mailboxes_licensed',
      title: 'Shared Mailboxes With Interactive Login Enabled',
      status: sharedWithLogin.length === 0 ? 'pass' : 'warn',
      severity: sharedWithLogin.length === 0 ? 'info' : 'medium',
      count: sharedWithLogin.length,
      items: sharedWithLogin.slice(0, 10).map((u) => ({
        id: u.id,
        displayName: u.displayName ?? u.id,
        detail: `UPN: ${u.userPrincipalName ?? 'N/A'} — account enabled`,
      })),
      recommendation:
        sharedWithLogin.length > 0
          ? 'Disable interactive login for shared mailboxes. Shared mailbox accounts should have account sign-in blocked.'
          : 'No shared mailboxes with interactive login detected.',
      nistControls: ['AC-2', 'IA-4'],
    })
  }

  // 16. Dynamic group rules
  {
    const securityGroups = allGroups.filter((g) => g.securityEnabled)
    const dynamicGroups = securityGroups.filter((g) => !!g.membershipRule)
    const dynamicPct =
      securityGroups.length > 0 ? Math.round((dynamicGroups.length / securityGroups.length) * 100) : 0
    results.push({
      category: 'groups',
      checkId: 'entra.groups.dynamic_group_rules',
      title: 'Security Groups Using Dynamic Membership',
      status: dynamicPct >= 50 ? 'pass' : dynamicPct > 0 ? 'info' : 'info',
      severity: 'info',
      count: dynamicGroups.length,
      recommendation:
        dynamicPct >= 50
          ? `${dynamicGroups.length} of ${securityGroups.length} security groups use dynamic membership rules — good hygiene.`
          : 'Consider using dynamic membership rules for security groups to reduce manual provisioning errors.',
      nistControls: ['AC-2', 'CM-7'],
    })
  }

  // 17. Groups with owners
  {
    // Fetch group owners (sample first 50 groups for performance)
    const secGroups = allGroups.filter((g) => g.securityEnabled).slice(0, 50)
    const ownerResults = await Promise.allSettled(
      secGroups.map((g) =>
        graphGet<{ value: DirectoryObject[] }>(token, `/groups/${g.id}/owners?$top=5`).then(
          (r) => ({ groupId: g.id, displayName: g.displayName ?? g.id, owners: r.value })
        )
      )
    )
    const groupsWithoutOwners = ownerResults
      .filter((r) => r.status === 'fulfilled' && r.value.owners.length === 0)
      .map((r) => {
        const v = (r as PromiseFulfilledResult<{ groupId: string; displayName: string; owners: DirectoryObject[] }>).value
        return { id: v.groupId, displayName: v.displayName, detail: 'No owners assigned' }
      })

    results.push({
      category: 'groups',
      checkId: 'entra.groups.owners_set',
      title: 'Security Groups Without Owners',
      status: groupsWithoutOwners.length === 0 ? 'pass' : 'warn',
      severity: groupsWithoutOwners.length === 0 ? 'info' : 'low',
      count: groupsWithoutOwners.length,
      items: groupsWithoutOwners.slice(0, 20),
      recommendation:
        groupsWithoutOwners.length > 0
          ? `${groupsWithoutOwners.length} security groups lack owners. Assign owners to ensure accountability for group membership.`
          : 'All sampled security groups have at least one owner.',
      nistControls: ['AC-2', 'PL-4'],
    })
  }

  // ── Sign-in Risk Checks ───────────────────────────────────────────────────

  // 18. High-risk users not remediated
  {
    const highRisk = riskyUsersData.filter(
      (u) => u.riskLevel === 'high' && u.riskState !== 'remediated' && u.riskState !== 'dismissed'
    )
    results.push({
      category: 'sign_in_risk',
      checkId: 'entra.risk.high_risk_users',
      title: 'High-Risk Users Not Remediated',
      status: highRisk.length === 0 ? 'pass' : 'fail',
      severity: highRisk.length === 0 ? 'info' : 'critical',
      count: highRisk.length,
      items: highRisk.slice(0, 20).map((u) => ({
        id: u.id,
        displayName: u.userDisplayName,
        detail: `Risk state: ${u.riskState} | Updated: ${u.riskLastUpdatedDateTime}`,
      })),
      recommendation:
        highRisk.length > 0
          ? `${highRisk.length} users have high risk state. Investigate and remediate immediately — require password reset and MFA re-registration.`
          : 'No high-risk users with unresolved risk state.',
      nistControls: ['SI-4', 'IR-4'],
    })
  }

  // 19. High-risk sign-ins in last 30 days
  {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentHighRisk = riskDetectionsData.filter(
      (d) => d.riskLevel === 'high' && new Date(d.activityDateTime) > thirtyDaysAgo
    )
    results.push({
      category: 'sign_in_risk',
      checkId: 'entra.risk.risky_sign_ins_30d',
      title: 'High-Risk Sign-Ins (Last 30 Days)',
      status: recentHighRisk.length === 0 ? 'pass' : recentHighRisk.length < 5 ? 'warn' : 'fail',
      severity:
        recentHighRisk.length === 0 ? 'info' : recentHighRisk.length < 5 ? 'medium' : 'high',
      count: recentHighRisk.length,
      items: recentHighRisk.slice(0, 20).map((d) => ({
        id: d.id,
        displayName: d.userDisplayName,
        detail: `Event: ${d.riskEventType} | ${d.activityDateTime}`,
      })),
      recommendation:
        recentHighRisk.length > 0
          ? `${recentHighRisk.length} high-risk sign-ins detected in 30 days. Review detections and ensure CA policies block high-risk sign-ins.`
          : 'No high-risk sign-ins detected in the last 30 days.',
      nistControls: ['AU-6', 'SI-4'],
    })
  }

  // 20. Unresolved risk detections
  {
    const unresolved = riskDetectionsData.filter(
      (d) => d.riskState !== 'dismissed' && d.riskState !== 'remediated'
    )
    results.push({
      category: 'sign_in_risk',
      checkId: 'entra.risk.unresolved_detections',
      title: 'Unresolved Risk Detections',
      status: unresolved.length === 0 ? 'pass' : unresolved.length < 10 ? 'warn' : 'fail',
      severity:
        unresolved.length === 0 ? 'info' : unresolved.length < 10 ? 'medium' : 'high',
      count: unresolved.length,
      recommendation:
        unresolved.length > 0
          ? `${unresolved.length} unresolved risk detections. Review in Identity Protection blade and take appropriate action.`
          : 'All risk detections are resolved or dismissed.',
      nistControls: ['IR-4', 'SI-4', 'AU-6'],
    })
  }

  return results
}
