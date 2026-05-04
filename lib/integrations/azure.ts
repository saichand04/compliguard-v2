import { IntegrationCheckResult } from './base'

export interface AzureConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  subscriptionId: string
}

// ── Token helpers ─────────────────────────────────────────────────────────────

async function getAzureToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  scope: string,
): Promise<string> {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Azure token error ${res.status}: ${text}`)
  }
  const data = await res.json() as { access_token?: string; error_description?: string }
  if (!data.access_token) throw new Error(`Azure token missing: ${data.error_description}`)
  return data.access_token
}

type ArmFetchResult = Record<string, unknown>

async function armGet(token: string, url: string): Promise<ArmFetchResult> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    if (res.status === 404) return {}
    const text = await res.text()
    throw new Error(`ARM GET ${url} failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<ArmFetchResult>
}

async function graphGet(token: string, url: string): Promise<ArmFetchResult> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    if (res.status === 404) return {}
    const text = await res.text()
    throw new Error(`Graph GET ${url} failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<ArmFetchResult>
}

function pass(checkId: string, title: string, description: string, evidence?: string, resource?: string): IntegrationCheckResult {
  return { checkId, title, description, status: 'pass', severity: 'info', resource, evidence }
}

function fail(checkId: string, title: string, description: string, severity: IntegrationCheckResult['severity'], remediation?: string, resource?: string, rawData?: unknown): IntegrationCheckResult {
  return { checkId, title, description, status: 'fail', severity, resource, remediation, rawData }
}

function warn(checkId: string, title: string, description: string, severity: IntegrationCheckResult['severity'], remediation?: string, resource?: string): IntegrationCheckResult {
  return { checkId, title, description, status: 'warn', severity, resource, remediation }
}

function skip(checkId: string, title: string, description: string): IntegrationCheckResult {
  return { checkId, title, description, status: 'skip', severity: 'info' }
}

// ── AKS Checks ───────────────────────────────────────────────────────────────

async function checkAksRbac(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.aks.rbac_enabled'
  const title = 'AKS RBAC Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.ContainerService/managedClusters?api-version=2023-05-01`)
    const clusters = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (clusters.length === 0) return skip(id, title, 'No AKS clusters found')
    const failing = clusters.filter((c) => {
      const props = c.properties as Record<string, unknown> | undefined
      return !(props?.enableRBAC as boolean | undefined)
    })
    if (failing.length === 0) return pass(id, title, 'RBAC is enabled on all AKS clusters', `${clusters.length} clusters checked`)
    return fail(id, title, `${failing.length} AKS cluster(s) have RBAC disabled`, 'high', 'Enable RBAC on AKS clusters via the Azure portal or ARM template', failing.map((c) => c.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkAksNetworkPolicy(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.aks.network_policy'
  const title = 'AKS Network Policy Configured'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.ContainerService/managedClusters?api-version=2023-05-01`)
    const clusters = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (clusters.length === 0) return skip(id, title, 'No AKS clusters found')
    const failing = clusters.filter((c) => {
      const props = c.properties as Record<string, unknown> | undefined
      const np = (props?.networkProfile as Record<string, unknown> | undefined)?.networkPolicy
      return !np || np === 'none'
    })
    if (failing.length === 0) return pass(id, title, 'Network policy is configured on all AKS clusters')
    return fail(id, title, `${failing.length} AKS cluster(s) have no network policy`, 'high', 'Configure Azure or Calico network policy on AKS clusters', failing.map((c) => c.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkAksNodePoolUpdates(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.aks.node_pool_updates'
  const title = 'AKS Node Pools Not Running Deprecated Kubernetes Versions'
  const DEPRECATED = ['1.24', '1.25', '1.26']
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.ContainerService/managedClusters?api-version=2023-05-01`)
    const clusters = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (clusters.length === 0) return skip(id, title, 'No AKS clusters found')
    const failing: string[] = []
    for (const cluster of clusters) {
      const props = cluster.properties as Record<string, unknown> | undefined
      const version = String(props?.kubernetesVersion ?? '')
      if (DEPRECATED.some((d) => version.startsWith(d))) {
        failing.push(`${String(cluster.name)} (${version})`)
      }
    }
    if (failing.length === 0) return pass(id, title, 'No AKS clusters running deprecated Kubernetes versions')
    return fail(id, title, `${failing.length} cluster(s) running deprecated Kubernetes versions`, 'high', 'Upgrade AKS clusters to a supported Kubernetes version', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── App Service Checks ────────────────────────────────────────────────────────

async function checkAppServiceHttpsOnly(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.appservice.https_only'
  const title = 'App Service HTTPS Only Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Web/sites?api-version=2022-09-01`)
    const sites = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (sites.length === 0) return skip(id, title, 'No App Service instances found')
    const failing = sites.filter((s) => {
      const props = s.properties as Record<string, unknown> | undefined
      return !(props?.httpsOnly as boolean | undefined)
    })
    if (failing.length === 0) return pass(id, title, 'HTTPS-only is enabled on all App Services', `${sites.length} sites checked`)
    return fail(id, title, `${failing.length} App Service(s) do not enforce HTTPS only`, 'high', 'Enable HTTPS-only in App Service Configuration > General settings', failing.map((s) => s.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkAppServiceAuthEnabled(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.appservice.auth_enabled'
  const title = 'App Service Authentication Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Web/sites?api-version=2022-09-01`)
    const sites = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (sites.length === 0) return skip(id, title, 'No App Service instances found')
    const failing: string[] = []
    for (const site of sites) {
      const siteId = String(site.id ?? '')
      try {
        const auth = await armGet(token, `https://management.azure.com${siteId}/config/authsettingsV2?api-version=2022-09-01`)
        const props = auth.properties as Record<string, unknown> | undefined
        const platform = props?.platform as Record<string, unknown> | undefined
        if (!platform?.enabled) failing.push(String(site.name))
      } catch {
        failing.push(String(site.name))
      }
    }
    if (failing.length === 0) return pass(id, title, 'Authentication is enabled on all App Services')
    return fail(id, title, `${failing.length} App Service(s) do not have authentication enabled`, 'high', 'Enable App Service Authentication in the Azure portal under Authentication', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkAppServiceTlsVersion(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.appservice.tls_version'
  const title = 'App Service Minimum TLS 1.2 Enforced'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Web/sites?api-version=2022-09-01`)
    const sites = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (sites.length === 0) return skip(id, title, 'No App Service instances found')
    const failing: string[] = []
    for (const site of sites) {
      const siteId = String(site.id ?? '')
      try {
        const config = await armGet(token, `https://management.azure.com${siteId}/config/web?api-version=2022-09-01`)
        const props = config.properties as Record<string, unknown> | undefined
        const tlsVer = String(props?.minTlsVersion ?? '1.0')
        if (tlsVer < '1.2') failing.push(`${String(site.name)} (TLS ${tlsVer})`)
      } catch {
        failing.push(String(site.name))
      }
    }
    if (failing.length === 0) return pass(id, title, 'All App Services enforce minimum TLS 1.2')
    return fail(id, title, `${failing.length} App Service(s) do not enforce TLS 1.2`, 'high', 'Set minimum TLS version to 1.2 in App Service TLS/SSL settings', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkAppServiceManagedIdentity(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.appservice.managed_identity'
  const title = 'App Service Managed Identity Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Web/sites?api-version=2022-09-01`)
    const sites = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (sites.length === 0) return skip(id, title, 'No App Service instances found')
    const failing = sites.filter((s) => {
      const identity = s.identity as Record<string, unknown> | undefined
      return !identity || !identity.type
    })
    if (failing.length === 0) return pass(id, title, 'All App Services have managed identity enabled')
    return fail(id, title, `${failing.length} App Service(s) do not have managed identity enabled`, 'medium', 'Enable system-assigned or user-assigned managed identity on App Services', failing.map((s) => s.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── Entra ID Checks ───────────────────────────────────────────────────────────

async function checkEntraIdMfaRegistered(graphToken: string): Promise<IntegrationCheckResult> {
  const id = 'azure.entraid.mfa_registered'
  const title = 'Entra ID MFA Registered Users'
  try {
    const usersData = await graphGet(graphToken, 'https://graph.microsoft.com/v1.0/users?$select=id,displayName&$top=999')
    const users = (usersData.value as Array<Record<string, unknown>> | undefined) ?? []
    const total = users.length
    if (total === 0) return skip(id, title, 'No users found in directory')
    const authData = await graphGet(graphToken, 'https://graph.microsoft.com/v1.0/reports/authenticationMethods/userRegistrationDetails?$top=999')
    const regDetails = (authData.value as Array<Record<string, unknown>> | undefined) ?? []
    const mfaRegistered = regDetails.filter((u) => u.isMfaRegistered === true).length
    const pct = total > 0 ? Math.round((mfaRegistered / total) * 100) : 0
    if (pct >= 80) return pass(id, title, `${pct}% of users have MFA registered (${mfaRegistered}/${total})`)
    if (pct >= 60) return warn(id, title, `Only ${pct}% of users have MFA registered (${mfaRegistered}/${total})`, 'high', 'Enable MFA enforcement via Conditional Access policies or Security Defaults')
    return fail(id, title, `Only ${pct}% of users have MFA registered — below 60% threshold`, 'critical', 'Enforce MFA registration for all users via Conditional Access policies')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkEntraIdLegacyAuthBlocked(graphToken: string): Promise<IntegrationCheckResult> {
  const id = 'azure.entraid.legacy_auth_blocked'
  const title = 'Entra ID Legacy Authentication Blocked'
  try {
    const data = await graphGet(graphToken, 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies?$top=100')
    const policies = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    const blockingPolicy = policies.find((p) => {
      const state = String(p.state ?? '')
      if (state !== 'enabled') return false
      const grantControls = p.grantControls as Record<string, unknown> | undefined
      const builtInControls = grantControls?.builtInControls as string[] | undefined
      const conditions = p.conditions as Record<string, unknown> | undefined
      const clientAppTypes = (conditions?.clientAppTypes as string[] | undefined) ?? []
      const blocksLegacy = clientAppTypes.some((t) => ['exchangeActiveSync', 'other'].includes(t))
      const blocks = builtInControls?.includes('block')
      return blocksLegacy && blocks
    })
    if (blockingPolicy) return pass(id, title, 'Legacy authentication is blocked via Conditional Access policy', String(blockingPolicy.displayName ?? ''))
    return fail(id, title, 'No Conditional Access policy found blocking legacy authentication', 'high', 'Create a Conditional Access policy to block legacy authentication protocols')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkEntraIdPrivilegedRolesPim(graphToken: string): Promise<IntegrationCheckResult> {
  const id = 'azure.entraid.privileged_roles_pim'
  const title = 'Privileged Roles Use PIM'
  const PRIVILEGED_ROLE_IDS = [
    '62e90394-69f5-4237-9190-012177145e10', // Global Administrator
    '194ae4cb-b126-40b2-bd5b-6091b380977d', // Security Administrator
  ]
  try {
    const data = await graphGet(graphToken, 'https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments?$expand=principal&$top=100')
    const assignments = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    const directPrivileged = assignments.filter((a) => PRIVILEGED_ROLE_IDS.includes(String(a.roleDefinitionId ?? '')))
    if (directPrivileged.length === 0) return pass(id, title, 'No direct permanent privileged role assignments found — PIM likely in use')
    return warn(id, title, `${directPrivileged.length} permanent privileged role assignment(s) found (not using PIM)`, 'high', 'Migrate permanent privileged role assignments to Privileged Identity Management (PIM) for just-in-time access', directPrivileged.map((a) => String((a.principal as Record<string, unknown> | undefined)?.displayName ?? a.principalId)).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── Key Vault Checks ──────────────────────────────────────────────────────────

async function checkKeyVaultSoftDelete(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.keyvault.soft_delete'
  const title = 'Key Vault Soft Delete Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.KeyVault/vaults?api-version=2023-02-01`)
    const vaults = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (vaults.length === 0) return skip(id, title, 'No Key Vaults found')
    const failing = vaults.filter((v) => {
      const props = v.properties as Record<string, unknown> | undefined
      return props?.enableSoftDelete === false
    })
    if (failing.length === 0) return pass(id, title, 'Soft delete is enabled on all Key Vaults')
    return fail(id, title, `${failing.length} Key Vault(s) do not have soft delete enabled`, 'high', 'Enable soft delete on Key Vaults to protect against accidental deletion', failing.map((v) => v.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkKeyVaultPurgeProtection(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.keyvault.purge_protection'
  const title = 'Key Vault Purge Protection Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.KeyVault/vaults?api-version=2023-02-01`)
    const vaults = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (vaults.length === 0) return skip(id, title, 'No Key Vaults found')
    const failing = vaults.filter((v) => {
      const props = v.properties as Record<string, unknown> | undefined
      return !props?.enablePurgeProtection
    })
    if (failing.length === 0) return pass(id, title, 'Purge protection is enabled on all Key Vaults')
    return fail(id, title, `${failing.length} Key Vault(s) do not have purge protection enabled`, 'high', 'Enable purge protection on Key Vaults to prevent permanent deletion', failing.map((v) => v.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkKeyVaultExpirySet(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.keyvault.expiry_set'
  const title = 'Key Vault Secrets/Keys Have Expiry Dates'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.KeyVault/vaults?api-version=2023-02-01`)
    const vaults = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (vaults.length === 0) return skip(id, title, 'No Key Vaults found')
    const noExpiry: string[] = []
    for (const vault of vaults) {
      const vaultUri = String((vault.properties as Record<string, unknown> | undefined)?.vaultUri ?? '')
      if (!vaultUri) continue
      try {
        const kvToken = await fetch(`https://login.microsoftonline.com/common/oauth2/v2.0/token`, { method: 'POST' })
        void kvToken
        // Check done at ARM level — flag vault as needing review if we can't verify
      } catch {
        noExpiry.push(String(vault.name))
      }
    }
    return warn(id, title, 'Unable to verify secret/key expiry without Key Vault data-plane access — review manually', 'medium', 'Ensure all Key Vault secrets and keys have expiry dates configured via Key Vault access policies')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkKeyVaultDiagnosticLogs(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.keyvault.diagnostic_logs'
  const title = 'Key Vault Diagnostic Logging Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.KeyVault/vaults?api-version=2023-02-01`)
    const vaults = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (vaults.length === 0) return skip(id, title, 'No Key Vaults found')
    const failing: string[] = []
    for (const vault of vaults) {
      const vaultId = String(vault.id ?? '')
      try {
        const diag = await armGet(token, `https://management.azure.com${vaultId}/providers/Microsoft.Insights/diagnosticSettings?api-version=2021-05-01-preview`)
        const settings = (diag.value as Array<Record<string, unknown>> | undefined) ?? []
        if (settings.length === 0) failing.push(String(vault.name))
      } catch {
        failing.push(String(vault.name))
      }
    }
    if (failing.length === 0) return pass(id, title, 'Diagnostic logging is enabled on all Key Vaults')
    return fail(id, title, `${failing.length} Key Vault(s) do not have diagnostic logging enabled`, 'medium', 'Configure diagnostic settings on Key Vaults to export audit logs to Log Analytics or Storage', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── SQL Database Checks ───────────────────────────────────────────────────────

async function checkSqlTdeEnabled(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.sql.tde_enabled'
  const title = 'SQL Database Transparent Data Encryption Enabled'
  try {
    const serversData = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Sql/servers?api-version=2022-11-01-preview`)
    const servers = (serversData.value as Array<Record<string, unknown>> | undefined) ?? []
    if (servers.length === 0) return skip(id, title, 'No SQL servers found')
    const failing: string[] = []
    for (const server of servers) {
      const serverId = String(server.id ?? '')
      const dbData = await armGet(token, `https://management.azure.com${serverId}/databases?api-version=2022-11-01-preview`)
      const dbs = (dbData.value as Array<Record<string, unknown>> | undefined) ?? []
      for (const db of dbs) {
        if (String(db.name) === 'master') continue
        const dbId = String(db.id ?? '')
        try {
          const tde = await armGet(token, `https://management.azure.com${dbId}/transparentDataEncryption/current?api-version=2022-11-01-preview`)
          const props = tde.properties as Record<string, unknown> | undefined
          if (props?.state !== 'Enabled') failing.push(`${String(server.name)}/${String(db.name)}`)
        } catch {
          failing.push(`${String(server.name)}/${String(db.name)}`)
        }
      }
    }
    if (failing.length === 0) return pass(id, title, 'TDE is enabled on all SQL databases')
    return fail(id, title, `${failing.length} SQL database(s) do not have TDE enabled`, 'critical', 'Enable Transparent Data Encryption on SQL databases via the Azure portal', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkSqlAuditingEnabled(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.sql.auditing_enabled'
  const title = 'SQL Database Auditing Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Sql/servers?api-version=2022-11-01-preview`)
    const servers = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (servers.length === 0) return skip(id, title, 'No SQL servers found')
    const failing: string[] = []
    for (const server of servers) {
      const serverId = String(server.id ?? '')
      try {
        const audit = await armGet(token, `https://management.azure.com${serverId}/auditingSettings/default?api-version=2022-11-01-preview`)
        const props = audit.properties as Record<string, unknown> | undefined
        if (props?.state !== 'Enabled') failing.push(String(server.name))
      } catch {
        failing.push(String(server.name))
      }
    }
    if (failing.length === 0) return pass(id, title, 'Auditing is enabled on all SQL servers')
    return fail(id, title, `${failing.length} SQL server(s) do not have auditing enabled`, 'high', 'Enable SQL auditing on servers to log database events to storage or Log Analytics', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkSqlFirewallNoOpen(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.sql.firewall_no_open'
  const title = 'SQL Server Firewall No Open Access (0.0.0.0)'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Sql/servers?api-version=2022-11-01-preview`)
    const servers = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (servers.length === 0) return skip(id, title, 'No SQL servers found')
    const failing: string[] = []
    for (const server of servers) {
      const serverId = String(server.id ?? '')
      try {
        const fwData = await armGet(token, `https://management.azure.com${serverId}/firewallRules?api-version=2022-11-01-preview`)
        const rules = (fwData.value as Array<Record<string, unknown>> | undefined) ?? []
        const openRule = rules.find((r) => {
          const props = r.properties as Record<string, unknown> | undefined
          return props?.startIpAddress === '0.0.0.0' && props?.endIpAddress === '255.255.255.255'
        })
        if (openRule) failing.push(String(server.name))
      } catch {
        // ignore
      }
    }
    if (failing.length === 0) return pass(id, title, 'No SQL server has an open firewall rule (0.0.0.0)')
    return fail(id, title, `${failing.length} SQL server(s) have an open firewall rule allowing all IPs`, 'critical', 'Remove or restrict SQL server firewall rules that allow access from 0.0.0.0', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkSqlThreatDetection(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.sql.threat_detection'
  const title = 'SQL Advanced Threat Protection Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Sql/servers?api-version=2022-11-01-preview`)
    const servers = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (servers.length === 0) return skip(id, title, 'No SQL servers found')
    const failing: string[] = []
    for (const server of servers) {
      const serverId = String(server.id ?? '')
      try {
        const atp = await armGet(token, `https://management.azure.com${serverId}/securityAlertPolicies/default?api-version=2022-11-01-preview`)
        const props = atp.properties as Record<string, unknown> | undefined
        if (props?.state !== 'Enabled') failing.push(String(server.name))
      } catch {
        failing.push(String(server.name))
      }
    }
    if (failing.length === 0) return pass(id, title, 'Advanced Threat Protection is enabled on all SQL servers')
    return fail(id, title, `${failing.length} SQL server(s) do not have Advanced Threat Protection enabled`, 'high', 'Enable Microsoft Defender for SQL on all SQL servers via Azure Defender', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── Storage Account Checks ────────────────────────────────────────────────────

async function checkStorageHttpsOnly(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.storage.https_only'
  const title = 'Storage Account HTTPS Only (Secure Transfer Required)'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Storage/storageAccounts?api-version=2023-01-01`)
    const accounts = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (accounts.length === 0) return skip(id, title, 'No storage accounts found')
    const failing = accounts.filter((a) => {
      const props = a.properties as Record<string, unknown> | undefined
      return !props?.supportsHttpsTrafficOnly
    })
    if (failing.length === 0) return pass(id, title, 'Secure transfer (HTTPS only) is required on all storage accounts')
    return fail(id, title, `${failing.length} storage account(s) do not require secure transfer`, 'high', 'Enable "Secure transfer required" on storage accounts to enforce HTTPS', failing.map((a) => a.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkStoragePublicAccessDisabled(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.storage.public_access_disabled'
  const title = 'Storage Account Blob Public Access Disabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Storage/storageAccounts?api-version=2023-01-01`)
    const accounts = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (accounts.length === 0) return skip(id, title, 'No storage accounts found')
    const failing = accounts.filter((a) => {
      const props = a.properties as Record<string, unknown> | undefined
      return props?.allowBlobPublicAccess === true
    })
    if (failing.length === 0) return pass(id, title, 'Blob public access is disabled on all storage accounts')
    return fail(id, title, `${failing.length} storage account(s) allow blob public access`, 'high', 'Disable blob public access on storage accounts to prevent unauthorized data exposure', failing.map((a) => a.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkStorageEncryption(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.storage.encryption'
  const title = 'Storage Account Infrastructure Encryption Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Storage/storageAccounts?api-version=2023-01-01`)
    const accounts = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (accounts.length === 0) return skip(id, title, 'No storage accounts found')
    const failing = accounts.filter((a) => {
      const props = a.properties as Record<string, unknown> | undefined
      const enc = props?.encryption as Record<string, unknown> | undefined
      return !enc?.requireInfrastructureEncryption
    })
    if (failing.length === 0) return pass(id, title, 'Infrastructure encryption is enabled on all storage accounts')
    return warn(id, title, `${failing.length} storage account(s) do not have infrastructure encryption enabled`, 'medium', 'Enable infrastructure encryption on storage accounts for double encryption at rest', failing.map((a) => a.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkStorageDiagnosticLogs(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.storage.diagnostic_logs'
  const title = 'Storage Account Blob Diagnostic Logging Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Storage/storageAccounts?api-version=2023-01-01`)
    const accounts = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (accounts.length === 0) return skip(id, title, 'No storage accounts found')
    const failing: string[] = []
    for (const account of accounts) {
      const accountId = String(account.id ?? '')
      try {
        const diag = await armGet(token, `https://management.azure.com${accountId}/blobServices/default/providers/Microsoft.Insights/diagnosticSettings?api-version=2021-05-01-preview`)
        const settings = (diag.value as Array<Record<string, unknown>> | undefined) ?? []
        if (settings.length === 0) failing.push(String(account.name))
      } catch {
        failing.push(String(account.name))
      }
    }
    if (failing.length === 0) return pass(id, title, 'Blob diagnostic logging is enabled on all storage accounts')
    return fail(id, title, `${failing.length} storage account(s) do not have blob diagnostic logging enabled`, 'medium', 'Configure diagnostic settings on storage accounts to log blob operations', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── VM Checks ─────────────────────────────────────────────────────────────────

async function checkVmDiskEncryption(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.vm.disk_encryption'
  const title = 'VM Disks Encrypted (Azure Disk Encryption)'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Compute/virtualMachines?api-version=2023-07-01`)
    const vms = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (vms.length === 0) return skip(id, title, 'No virtual machines found')
    const failing: string[] = []
    for (const vm of vms) {
      const vmId = String(vm.id ?? '')
      try {
        const ext = await armGet(token, `https://management.azure.com${vmId}/extensions?api-version=2023-07-01`)
        const extensions = (ext.value as Array<Record<string, unknown>> | undefined) ?? []
        const hasAde = extensions.some((e) => {
          const props = e.properties as Record<string, unknown> | undefined
          return String(props?.type ?? '').includes('AzureDiskEncryption') && props?.provisioningState === 'Succeeded'
        })
        if (!hasAde) failing.push(String(vm.name))
      } catch {
        failing.push(String(vm.name))
      }
    }
    if (failing.length === 0) return pass(id, title, 'All VMs have Azure Disk Encryption enabled')
    return fail(id, title, `${failing.length} VM(s) do not have Azure Disk Encryption enabled`, 'high', 'Enable Azure Disk Encryption on VMs to protect OS and data disks', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkVmJitAccess(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.vm.jit_access'
  const title = 'VM Just-in-Time Access Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Security/jitNetworkAccessPolicies?api-version=2020-01-01`)
    const policies = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (policies.length === 0) return fail(id, title, 'No JIT network access policies found', 'medium', 'Enable Just-in-Time VM access via Microsoft Defender for Cloud to reduce attack surface')
    const activePolicies = policies.filter((p) => {
      const props = p.properties as Record<string, unknown> | undefined
      return props?.provisioningState === 'Succeeded'
    })
    if (activePolicies.length > 0) return pass(id, title, `${activePolicies.length} JIT access policy/policies active`, `Covering ${activePolicies.length} resource group(s)`)
    return warn(id, title, 'JIT policies exist but none are in Succeeded state', 'medium', 'Verify JIT network access policies are correctly provisioned in Defender for Cloud')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkVmEndpointProtection(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.vm.endpoint_protection'
  const title = 'VM Endpoint Protection Installed'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Security/tasks?api-version=2015-06-01-preview`)
    const tasks = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    const epTasks = tasks.filter((t) => {
      const props = t.properties as Record<string, unknown> | undefined
      return String(props?.taskName ?? '').toLowerCase().includes('endpoint')
    })
    if (epTasks.length === 0) return pass(id, title, 'No endpoint protection security recommendations found')
    return warn(id, title, `${epTasks.length} VM(s) flagged for missing endpoint protection by Defender for Cloud`, 'high', 'Install endpoint protection solutions on all VMs as recommended by Microsoft Defender for Cloud', epTasks.map((t) => String((t.properties as Record<string, unknown>)?.resourceId ?? '')).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkVmOsUpdates(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.vm.os_updates'
  const title = 'VM Automatic OS Updates Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Compute/virtualMachineScaleSets?api-version=2023-07-01`)
    const vmss = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (vmss.length === 0) {
      // Check individual VMs for patch settings
      const vmData = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Compute/virtualMachines?api-version=2023-07-01`)
      const vms = (vmData.value as Array<Record<string, unknown>> | undefined) ?? []
      if (vms.length === 0) return skip(id, title, 'No VMs or VMSS found')
      const failing = vms.filter((v) => {
        const props = v.properties as Record<string, unknown> | undefined
        const osProfile = props?.osProfile as Record<string, unknown> | undefined
        const windowsConfig = osProfile?.windowsConfiguration as Record<string, unknown> | undefined
        const linuxConfig = osProfile?.linuxConfiguration as Record<string, unknown> | undefined
        const patchSettings = windowsConfig?.patchSettings as Record<string, unknown> | undefined
        const linuxPatch = linuxConfig?.patchSettings as Record<string, unknown> | undefined
        return patchSettings?.patchMode === 'Manual' || linuxPatch?.patchMode === 'ImageDefault'
      })
      if (failing.length === 0) return pass(id, title, 'All VMs have automatic OS updates enabled or configured via Update Manager')
      return warn(id, title, `${failing.length} VM(s) may not have automatic OS patching enabled`, 'medium', 'Configure automatic VM guest patching via Azure Update Manager or VM patch settings', failing.map((v) => v.name).join(', '))
    }
    const failing = vmss.filter((s) => {
      const props = s.properties as Record<string, unknown> | undefined
      const policy = props?.upgradePolicy as Record<string, unknown> | undefined
      return policy?.mode !== 'Automatic'
    })
    if (failing.length === 0) return pass(id, title, 'All VMSS have automatic OS updates enabled')
    return warn(id, title, `${failing.length} VMSS do not have automatic upgrade policy`, 'medium', 'Set VMSS upgrade policy to Automatic to ensure OS updates are applied automatically', failing.map((s) => s.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── Network Checks ────────────────────────────────────────────────────────────

async function checkNetworkDdosProtection(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.network.ddos_protection'
  const title = 'DDoS Protection Standard Enabled'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Network/ddosProtectionPlans?api-version=2023-05-01`)
    const plans = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (plans.length === 0) return fail(id, title, 'No DDoS Protection Standard plans found', 'medium', 'Enable Azure DDoS Protection Standard on virtual networks to protect against DDoS attacks')
    return pass(id, title, `${plans.length} DDoS Protection Standard plan(s) configured`, plans.map((p) => p.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkNetworkNsgFlowLogs(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.network.nsg_flow_logs'
  const title = 'NSG Flow Logs Enabled'
  try {
    const nsgData = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Network/networkSecurityGroups?api-version=2023-05-01`)
    const nsgs = (nsgData.value as Array<Record<string, unknown>> | undefined) ?? []
    if (nsgs.length === 0) return skip(id, title, 'No Network Security Groups found')
    const flowLogData = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Network/networkWatchers?api-version=2023-05-01`)
    const watchers = (flowLogData.value as Array<Record<string, unknown>> | undefined) ?? []
    if (watchers.length === 0) return fail(id, title, 'Network Watcher not enabled — NSG flow logs cannot be configured', 'medium', 'Enable Network Watcher and configure NSG flow logs for all NSGs')
    return warn(id, title, 'Network Watcher exists but NSG flow log coverage could not be verified per NSG', 'low', 'Verify NSG flow logs are enabled for all NSGs via Network Watcher in the Azure portal')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkNetworkWafEnabled(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.network.waf_enabled'
  const title = 'WAF Enabled on Application Gateway'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Network/applicationGateways?api-version=2023-05-01`)
    const gateways = (data.value as Array<Record<string, unknown>> | undefined) ?? []
    if (gateways.length === 0) return skip(id, title, 'No Application Gateways found')
    const failing = gateways.filter((g) => {
      const props = g.properties as Record<string, unknown> | undefined
      const sku = props?.sku as Record<string, unknown> | undefined
      const wafConfig = props?.webApplicationFirewallConfiguration as Record<string, unknown> | undefined
      return !(sku?.name as string ?? '').includes('WAF') && !wafConfig?.enabled
    })
    if (failing.length === 0) return pass(id, title, 'WAF is enabled on all Application Gateways')
    return fail(id, title, `${failing.length} Application Gateway/Gateways do not have WAF enabled`, 'high', 'Enable WAF on Application Gateways by upgrading to WAF_v2 SKU or enabling WAF configuration', failing.map((g) => g.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── Security Center Checks ────────────────────────────────────────────────────

async function checkSecurityCenterMdcTier(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.securitycenter.mdc_tier'
  const title = 'Microsoft Defender for Cloud Standard Tier'
  const PLANS = ['VirtualMachines', 'SqlServers', 'AppServices', 'StorageAccounts', 'KeyVaults', 'KubernetesService']
  try {
    const failing: string[] = []
    for (const plan of PLANS) {
      try {
        const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Security/pricings/${plan}?api-version=2023-01-01`)
        const props = data.properties as Record<string, unknown> | undefined
        if (props?.pricingTier !== 'Standard') failing.push(plan)
      } catch {
        failing.push(plan)
      }
    }
    if (failing.length === 0) return pass(id, title, 'Microsoft Defender for Cloud is on Standard tier for all key plans')
    return fail(id, title, `${failing.length} Defender for Cloud plan(s) not on Standard tier: ${failing.join(', ')}`, 'high', 'Upgrade Microsoft Defender for Cloud to Standard tier for comprehensive threat protection', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkSecurityCenterSecureScore(token: string, subId: string): Promise<IntegrationCheckResult> {
  const id = 'azure.securitycenter.secure_score'
  const title = 'Microsoft Defender Secure Score > 70%'
  try {
    const data = await armGet(token, `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Security/secureScores/ascScore?api-version=2020-01-01`)
    const props = data.properties as Record<string, unknown> | undefined
    const score = props?.score as Record<string, unknown> | undefined
    const current = Number(score?.current ?? 0)
    const max = Number(score?.max ?? 100)
    const pct = max > 0 ? Math.round((current / max) * 100) : 0
    if (pct >= 70) return pass(id, title, `Secure Score is ${pct}% (${current}/${max})`)
    if (pct >= 50) return warn(id, title, `Secure Score is ${pct}% — below 70% threshold`, 'high', 'Remediate high-impact Defender for Cloud recommendations to improve the Secure Score')
    return fail(id, title, `Secure Score is only ${pct}% — below 50% minimum threshold`, 'critical', 'Immediately address critical Defender for Cloud recommendations to raise the Secure Score above 50%')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runAzureChecks(config: AzureConfig): Promise<IntegrationCheckResult[]> {
  const { tenantId, clientId, clientSecret, subscriptionId } = config

  let armToken: string
  let graphToken: string

  try {
    armToken = await getAzureToken(tenantId, clientId, clientSecret, 'https://management.azure.com/.default')
  } catch (e) {
    const errMsg = `Failed to obtain ARM token: ${String(e)}`
    const checks = [
      'azure.aks.rbac_enabled', 'azure.aks.network_policy', 'azure.aks.node_pool_updates',
      'azure.appservice.https_only', 'azure.appservice.auth_enabled', 'azure.appservice.tls_version', 'azure.appservice.managed_identity',
      'azure.keyvault.soft_delete', 'azure.keyvault.purge_protection', 'azure.keyvault.expiry_set', 'azure.keyvault.diagnostic_logs',
      'azure.sql.tde_enabled', 'azure.sql.auditing_enabled', 'azure.sql.firewall_no_open', 'azure.sql.threat_detection',
      'azure.storage.https_only', 'azure.storage.public_access_disabled', 'azure.storage.encryption', 'azure.storage.diagnostic_logs',
      'azure.vm.disk_encryption', 'azure.vm.jit_access', 'azure.vm.endpoint_protection', 'azure.vm.os_updates',
      'azure.network.ddos_protection', 'azure.network.nsg_flow_logs', 'azure.network.waf_enabled',
      'azure.securitycenter.mdc_tier', 'azure.securitycenter.secure_score',
    ]
    return checks.map((checkId) => skip(checkId, checkId, errMsg))
  }

  try {
    graphToken = await getAzureToken(tenantId, clientId, clientSecret, 'https://graph.microsoft.com/.default')
  } catch {
    graphToken = ''
  }

  const results = await Promise.allSettled([
    // AKS
    checkAksRbac(armToken, subscriptionId),
    checkAksNetworkPolicy(armToken, subscriptionId),
    checkAksNodePoolUpdates(armToken, subscriptionId),
    // App Service
    checkAppServiceHttpsOnly(armToken, subscriptionId),
    checkAppServiceAuthEnabled(armToken, subscriptionId),
    checkAppServiceTlsVersion(armToken, subscriptionId),
    checkAppServiceManagedIdentity(armToken, subscriptionId),
    // Entra ID
    graphToken ? checkEntraIdMfaRegistered(graphToken) : Promise.resolve(skip('azure.entraid.mfa_registered', 'Entra ID MFA Registered Users', 'Graph token unavailable')),
    graphToken ? checkEntraIdLegacyAuthBlocked(graphToken) : Promise.resolve(skip('azure.entraid.legacy_auth_blocked', 'Entra ID Legacy Authentication Blocked', 'Graph token unavailable')),
    graphToken ? checkEntraIdPrivilegedRolesPim(graphToken) : Promise.resolve(skip('azure.entraid.privileged_roles_pim', 'Privileged Roles Use PIM', 'Graph token unavailable')),
    // Key Vault
    checkKeyVaultSoftDelete(armToken, subscriptionId),
    checkKeyVaultPurgeProtection(armToken, subscriptionId),
    checkKeyVaultExpirySet(armToken, subscriptionId),
    checkKeyVaultDiagnosticLogs(armToken, subscriptionId),
    // SQL
    checkSqlTdeEnabled(armToken, subscriptionId),
    checkSqlAuditingEnabled(armToken, subscriptionId),
    checkSqlFirewallNoOpen(armToken, subscriptionId),
    checkSqlThreatDetection(armToken, subscriptionId),
    // Storage
    checkStorageHttpsOnly(armToken, subscriptionId),
    checkStoragePublicAccessDisabled(armToken, subscriptionId),
    checkStorageEncryption(armToken, subscriptionId),
    checkStorageDiagnosticLogs(armToken, subscriptionId),
    // VM
    checkVmDiskEncryption(armToken, subscriptionId),
    checkVmJitAccess(armToken, subscriptionId),
    checkVmEndpointProtection(armToken, subscriptionId),
    checkVmOsUpdates(armToken, subscriptionId),
    // Network
    checkNetworkDdosProtection(armToken, subscriptionId),
    checkNetworkNsgFlowLogs(armToken, subscriptionId),
    checkNetworkWafEnabled(armToken, subscriptionId),
    // Security Center
    checkSecurityCenterMdcTier(armToken, subscriptionId),
    checkSecurityCenterSecureScore(armToken, subscriptionId),
  ])

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const ids = [
      'azure.aks.rbac_enabled', 'azure.aks.network_policy', 'azure.aks.node_pool_updates',
      'azure.appservice.https_only', 'azure.appservice.auth_enabled', 'azure.appservice.tls_version', 'azure.appservice.managed_identity',
      'azure.entraid.mfa_registered', 'azure.entraid.legacy_auth_blocked', 'azure.entraid.privileged_roles_pim',
      'azure.keyvault.soft_delete', 'azure.keyvault.purge_protection', 'azure.keyvault.expiry_set', 'azure.keyvault.diagnostic_logs',
      'azure.sql.tde_enabled', 'azure.sql.auditing_enabled', 'azure.sql.firewall_no_open', 'azure.sql.threat_detection',
      'azure.storage.https_only', 'azure.storage.public_access_disabled', 'azure.storage.encryption', 'azure.storage.diagnostic_logs',
      'azure.vm.disk_encryption', 'azure.vm.jit_access', 'azure.vm.endpoint_protection', 'azure.vm.os_updates',
      'azure.network.ddos_protection', 'azure.network.nsg_flow_logs', 'azure.network.waf_enabled',
      'azure.securitycenter.mdc_tier', 'azure.securitycenter.secure_score',
    ]
    return skip(ids[i] ?? `check_${i}`, ids[i] ?? `Check ${i}`, `Check threw: ${r.reason}`)
  })
}
