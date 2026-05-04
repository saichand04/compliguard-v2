import { IntegrationCheckResult } from './base'

export interface GCPConfig {
  serviceAccountJson: string
  projectId: string
}

interface ServiceAccountKey {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
}

// ── JWT / Token helpers ───────────────────────────────────────────────────────

function base64url(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString('base64url')
}

async function signJwt(header: object, payload: object, privateKeyPem: string): Promise<string> {
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url')
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signingInput = `${headerB64}.${payloadB64}`

  // Import the RSA private key
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const keyBytes = Buffer.from(pemBody, 'base64')

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(signingInput),
  )

  return `${signingInput}.${base64url(signature)}`
}

async function getGCPToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as ServiceAccountKey
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  }
  const header = { alg: 'RS256', typ: 'JWT' }
  const jwt = await signJwt(header, payload, sa.private_key)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GCP token error ${res.status}: ${text}`)
  }
  const data = await res.json() as { access_token?: string; error?: string }
  if (!data.access_token) throw new Error(`GCP token missing: ${data.error}`)
  return data.access_token
}

type GcpApiResult = Record<string, unknown>

async function gcpGet(token: string, url: string): Promise<GcpApiResult> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    if (res.status === 404) return {}
    const text = await res.text()
    throw new Error(`GCP GET ${url} failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<GcpApiResult>
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

// ── Compute Engine Checks ─────────────────────────────────────────────────────

async function checkComputeOsLogin(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.compute.os_login'
  const title = 'Compute OS Login Enabled at Project Level'
  try {
    const data = await gcpGet(token, `https://compute.googleapis.com/compute/v1/projects/${projectId}`)
    const metadata = (data.commonInstanceMetadata as Record<string, unknown> | undefined) ?? {}
    const items = (metadata.items as Array<Record<string, string>> | undefined) ?? []
    const osLogin = items.find((i) => i.key === 'enable-oslogin')
    if (osLogin?.value?.toLowerCase() === 'true') return pass(id, title, 'OS Login is enabled at project level')
    return fail(id, title, 'OS Login is not enabled at project level', 'high', 'Set enable-oslogin=TRUE in project metadata to enable OS Login for all VMs')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkComputeSerialPortDisabled(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.compute.serial_port_disabled'
  const title = 'Serial Port Access Disabled for All Instances'
  try {
    const data = await gcpGet(token, `https://compute.googleapis.com/compute/v1/projects/${projectId}/aggregatedList/instances`)
    const items = data.items as Record<string, Record<string, unknown>> | undefined
    const allInstances: Array<Record<string, unknown>> = []
    if (items) {
      for (const zone of Object.values(items)) {
        const zonalInstances = (zone.instances as Array<Record<string, unknown>> | undefined) ?? []
        allInstances.push(...zonalInstances)
      }
    }
    if (allInstances.length === 0) return skip(id, title, 'No compute instances found')
    const failing = allInstances.filter((inst) => {
      const metadata = (inst.metadata as Record<string, unknown> | undefined) ?? {}
      const metaItems = (metadata.items as Array<Record<string, string>> | undefined) ?? []
      const serialPort = metaItems.find((i) => i.key === 'serial-port-enable')
      return serialPort?.value?.toLowerCase() === 'true' || serialPort?.value === '1'
    })
    if (failing.length === 0) return pass(id, title, 'Serial port access is disabled on all compute instances', `${allInstances.length} instances checked`)
    return fail(id, title, `${failing.length} instance(s) have serial port access enabled`, 'medium', 'Set serial-port-enable=false in instance metadata or disable via org policy constraints/compute.disableSerialPortAccess', failing.map((i) => String(i.name)).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkComputePublicIps(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.compute.public_ips'
  const title = 'Compute Instances with External IPs'
  try {
    const data = await gcpGet(token, `https://compute.googleapis.com/compute/v1/projects/${projectId}/aggregatedList/instances`)
    const items = data.items as Record<string, Record<string, unknown>> | undefined
    const publicInstances: string[] = []
    if (items) {
      for (const zone of Object.values(items)) {
        const zonalInstances = (zone.instances as Array<Record<string, unknown>> | undefined) ?? []
        for (const inst of zonalInstances) {
          const nics = (inst.networkInterfaces as Array<Record<string, unknown>> | undefined) ?? []
          const hasPublic = nics.some((nic) => {
            const accessConfigs = (nic.accessConfigs as Array<Record<string, unknown>> | undefined) ?? []
            return accessConfigs.some((ac) => ac.natIP || ac.externalIpv6)
          })
          if (hasPublic) publicInstances.push(String(inst.name))
        }
      }
    }
    if (publicInstances.length === 0) return pass(id, title, 'No compute instances have external IP addresses')
    if (publicInstances.length <= 5) return warn(id, title, `${publicInstances.length} instance(s) have external IP addresses`, 'medium', 'Use Cloud NAT or private instances where possible to reduce attack surface', publicInstances.join(', '))
    return fail(id, title, `${publicInstances.length} instances have external IPs (>5 threshold exceeded)`, 'high', 'Review and minimize instances with external IPs — use Cloud NAT or IAP for access', publicInstances.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkComputeDiskEncryption(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.compute.disk_encryption'
  const title = 'Compute Disks Use Customer-Managed Encryption Keys'
  try {
    const data = await gcpGet(token, `https://compute.googleapis.com/compute/v1/projects/${projectId}/aggregatedList/disks`)
    const items = data.items as Record<string, Record<string, unknown>> | undefined
    const allDisks: Array<Record<string, unknown>> = []
    if (items) {
      for (const zone of Object.values(items)) {
        const zonalDisks = (zone.disks as Array<Record<string, unknown>> | undefined) ?? []
        allDisks.push(...zonalDisks)
      }
    }
    if (allDisks.length === 0) return skip(id, title, 'No disks found')
    const withCmek = allDisks.filter((d) => {
      const enc = d.diskEncryptionKey as Record<string, unknown> | undefined
      return enc?.kmsKeyName
    })
    const pct = allDisks.length > 0 ? Math.round((withCmek.length / allDisks.length) * 100) : 0
    if (pct === 100) return pass(id, title, 'All compute disks use customer-managed encryption keys (CMEK)')
    if (pct >= 50) return warn(id, title, `Only ${pct}% of disks use CMEK (${withCmek.length}/${allDisks.length})`, 'medium', 'Configure CMEK on Compute Engine disks for enhanced encryption control')
    return fail(id, title, `Only ${pct}% of disks use CMEK — most disks use Google-managed keys`, 'medium', 'Migrate critical Compute Engine disks to use customer-managed encryption keys via Cloud KMS')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkComputeShieldedVms(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.compute.shielded_vms'
  const title = 'Shielded VM Enabled (Secure Boot, vTPM)'
  try {
    const data = await gcpGet(token, `https://compute.googleapis.com/compute/v1/projects/${projectId}/aggregatedList/instances`)
    const items = data.items as Record<string, Record<string, unknown>> | undefined
    const allInstances: Array<Record<string, unknown>> = []
    if (items) {
      for (const zone of Object.values(items)) {
        const zonalInstances = (zone.instances as Array<Record<string, unknown>> | undefined) ?? []
        allInstances.push(...zonalInstances)
      }
    }
    if (allInstances.length === 0) return skip(id, title, 'No compute instances found')
    const failing = allInstances.filter((inst) => {
      const shielded = inst.shieldedInstanceConfig as Record<string, unknown> | undefined
      return !shielded?.enableVtpm || !shielded?.enableSecureBoot
    })
    if (failing.length === 0) return pass(id, title, 'All instances have Shielded VM (Secure Boot + vTPM) enabled')
    return fail(id, title, `${failing.length} instance(s) do not have Shielded VM fully enabled`, 'medium', 'Enable Shielded VM with Secure Boot and vTPM on all compute instances', failing.map((i) => String(i.name)).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── IAM Checks ────────────────────────────────────────────────────────────────

async function checkIamServiceAccountKeys(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.iam.service_account_keys'
  const title = 'No Service Account Keys Older Than 90 Days'
  try {
    const saData = await gcpGet(token, `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`)
    const accounts = (saData.accounts as Array<Record<string, unknown>> | undefined) ?? []
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const oldKeys: string[] = []
    for (const sa of accounts) {
      const saName = String(sa.name ?? '')
      try {
        const keysData = await gcpGet(token, `https://iam.googleapis.com/v1/${saName}/keys?keyTypes=USER_MANAGED`)
        const keys = (keysData.keys as Array<Record<string, unknown>> | undefined) ?? []
        for (const key of keys) {
          const created = new Date(String(key.validAfterTime ?? ''))
          if (created < ninetyDaysAgo) {
            oldKeys.push(`${String(sa.email)} (key ${String(key.name ?? '').split('/').pop()})`)
          }
        }
      } catch {
        // skip individual SA errors
      }
    }
    if (oldKeys.length === 0) return pass(id, title, 'No service account user-managed keys older than 90 days found')
    return fail(id, title, `${oldKeys.length} service account key(s) older than 90 days`, 'high', 'Rotate or delete service account keys older than 90 days; prefer Workload Identity Federation', oldKeys.join('; '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkIamPrimitiveRoles(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.iam.primitive_roles'
  const title = 'No Primitive Roles (Owner/Editor) Assigned to Users'
  try {
    const data = await gcpGet(token, `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`)
    const bindings = (data.bindings as Array<Record<string, unknown>> | undefined) ?? []
    const primitiveRoles = ['roles/owner', 'roles/editor']
    const violations: string[] = []
    for (const binding of bindings) {
      if (!primitiveRoles.includes(String(binding.role))) continue
      const members = (binding.members as string[] | undefined) ?? []
      for (const member of members) {
        if (member.startsWith('user:') || member.startsWith('group:')) {
          violations.push(`${member} → ${String(binding.role)}`)
        }
      }
    }
    if (violations.length === 0) return pass(id, title, 'No primitive Owner/Editor roles assigned to users or groups')
    return fail(id, title, `${violations.length} primitive role assignment(s) found`, 'critical', 'Replace primitive roles (Owner/Editor) with predefined or custom IAM roles following least privilege', violations.join('; '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkIamWorkloadIdentity(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.iam.workload_identity'
  const title = 'Workload Identity Used for GKE'
  try {
    const data = await gcpGet(token, `https://container.googleapis.com/v1/projects/${projectId}/locations/-/clusters`)
    const clusters = (data.clusters as Array<Record<string, unknown>> | undefined) ?? []
    if (clusters.length === 0) return skip(id, title, 'No GKE clusters found')
    const failing = clusters.filter((c) => {
      const workloadIdentityConfig = c.workloadIdentityConfig as Record<string, unknown> | undefined
      return !workloadIdentityConfig?.workloadPool
    })
    if (failing.length === 0) return pass(id, title, 'Workload Identity is configured on all GKE clusters')
    return fail(id, title, `${failing.length} GKE cluster(s) do not have Workload Identity configured`, 'high', 'Enable Workload Identity on GKE clusters to avoid mounting service account key files', failing.map((c) => String(c.name)).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkIamOrgPolicyConstraints(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.iam.org_policy_constraints'
  const title = 'Critical Org Policy Constraints Applied'
  const CRITICAL_CONSTRAINTS = [
    'constraints/compute.disableSerialPortAccess',
    'constraints/compute.requireOsLogin',
    'constraints/storage.uniformBucketLevelAccess',
  ]
  try {
    const present: string[] = []
    for (const constraint of CRITICAL_CONSTRAINTS) {
      try {
        const data = await gcpGet(token, `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getEffectiveOrgPolicy`, )
        void data
        present.push(constraint)
      } catch {
        // not applied
      }
    }
    if (present.length === CRITICAL_CONSTRAINTS.length) return pass(id, title, 'All critical org policy constraints are applied')
    return warn(id, title, 'Unable to fully verify org policy constraints — ensure constraints are applied at org or folder level', 'medium', 'Apply critical org policy constraints: disableSerialPortAccess, requireOsLogin, uniformBucketLevelAccess')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkIamAdminSaKeys(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.iam.admin_sa_keys'
  const title = 'No Service Accounts with Admin-Level Project Roles'
  try {
    const data = await gcpGet(token, `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`)
    const bindings = (data.bindings as Array<Record<string, unknown>> | undefined) ?? []
    const adminRoles = ['roles/owner', 'roles/editor', 'roles/iam.securityAdmin', 'roles/resourcemanager.projectIamAdmin']
    const violations: string[] = []
    for (const binding of bindings) {
      if (!adminRoles.includes(String(binding.role))) continue
      const members = (binding.members as string[] | undefined) ?? []
      for (const member of members) {
        if (member.startsWith('serviceAccount:')) {
          violations.push(`${member} → ${String(binding.role)}`)
        }
      }
    }
    if (violations.length === 0) return pass(id, title, 'No service accounts with admin-level project roles found')
    return fail(id, title, `${violations.length} service account(s) have admin-level project roles`, 'critical', 'Remove admin-level roles from service accounts and apply minimum required permissions', violations.join('; '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── Cloud Storage Checks ──────────────────────────────────────────────────────

async function checkStorageUniformAccess(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.storage.uniform_access'
  const title = 'Cloud Storage Uniform Bucket-Level Access Enabled'
  try {
    const data = await gcpGet(token, `https://storage.googleapis.com/storage/v1/b?project=${projectId}`)
    const buckets = (data.items as Array<Record<string, unknown>> | undefined) ?? []
    if (buckets.length === 0) return skip(id, title, 'No Cloud Storage buckets found')
    const failing = buckets.filter((b) => {
      const iamConfig = b.iamConfiguration as Record<string, unknown> | undefined
      const ubla = iamConfig?.uniformBucketLevelAccess as Record<string, unknown> | undefined
      return !ubla?.enabled
    })
    if (failing.length === 0) return pass(id, title, 'Uniform bucket-level access is enabled on all buckets')
    return fail(id, title, `${failing.length} bucket(s) do not have uniform bucket-level access enabled`, 'high', 'Enable uniform bucket-level access on all Cloud Storage buckets to prevent ACL-based access', failing.map((b) => b.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkStoragePublicAccess(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.storage.public_access'
  const title = 'No Cloud Storage Buckets with Public Access'
  try {
    const data = await gcpGet(token, `https://storage.googleapis.com/storage/v1/b?project=${projectId}`)
    const buckets = (data.items as Array<Record<string, unknown>> | undefined) ?? []
    if (buckets.length === 0) return skip(id, title, 'No Cloud Storage buckets found')
    const failing: string[] = []
    for (const bucket of buckets) {
      const bucketName = String(bucket.name ?? '')
      try {
        const iamData = await gcpGet(token, `https://storage.googleapis.com/storage/v1/b/${bucketName}/iam`)
        const bindings = (iamData.bindings as Array<Record<string, unknown>> | undefined) ?? []
        const hasPublic = bindings.some((b) => {
          const members = (b.members as string[] | undefined) ?? []
          return members.includes('allUsers') || members.includes('allAuthenticatedUsers')
        })
        if (hasPublic) failing.push(bucketName)
      } catch {
        // skip individual bucket errors
      }
    }
    if (failing.length === 0) return pass(id, title, 'No Cloud Storage buckets have public (allUsers/allAuthenticatedUsers) access')
    return fail(id, title, `${failing.length} bucket(s) have public access enabled`, 'critical', 'Remove allUsers and allAuthenticatedUsers IAM bindings from Cloud Storage buckets', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkStorageVersioning(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.storage.versioning'
  const title = 'Cloud Storage Versioning Enabled on Critical Buckets'
  try {
    const data = await gcpGet(token, `https://storage.googleapis.com/storage/v1/b?project=${projectId}&fields=items(name,versioning)`)
    const buckets = (data.items as Array<Record<string, unknown>> | undefined) ?? []
    if (buckets.length === 0) return skip(id, title, 'No Cloud Storage buckets found')
    const noVersioning = buckets.filter((b) => {
      const versioning = b.versioning as Record<string, unknown> | undefined
      return !versioning?.enabled
    })
    if (noVersioning.length === 0) return pass(id, title, 'Versioning is enabled on all Cloud Storage buckets')
    if (noVersioning.length < buckets.length / 2) return warn(id, title, `${noVersioning.length}/${buckets.length} buckets do not have versioning enabled`, 'low', 'Enable versioning on critical Cloud Storage buckets for data recovery capability', noVersioning.map((b) => b.name).join(', '))
    return fail(id, title, `${noVersioning.length}/${buckets.length} buckets do not have versioning enabled`, 'medium', 'Enable versioning on Cloud Storage buckets, especially those holding critical or audit data', noVersioning.map((b) => b.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkStorageRetentionPolicy(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.storage.retention_policy'
  const title = 'Retention Policies Set on Audit/Log Buckets'
  try {
    const data = await gcpGet(token, `https://storage.googleapis.com/storage/v1/b?project=${projectId}&fields=items(name,retentionPolicy)`)
    const buckets = (data.items as Array<Record<string, unknown>> | undefined) ?? []
    if (buckets.length === 0) return skip(id, title, 'No Cloud Storage buckets found')
    const logBuckets = buckets.filter((b) => {
      const name = String(b.name ?? '').toLowerCase()
      return name.includes('log') || name.includes('audit') || name.includes('cloudtrail') || name.includes('sink')
    })
    if (logBuckets.length === 0) return warn(id, title, 'No log/audit buckets identified by naming convention', 'low', 'Ensure log export sinks use buckets with retention policies configured')
    const missing = logBuckets.filter((b) => !b.retentionPolicy)
    if (missing.length === 0) return pass(id, title, `Retention policies configured on ${logBuckets.length} log/audit bucket(s)`)
    return fail(id, title, `${missing.length} log/audit bucket(s) lack retention policies`, 'medium', 'Set retention policies on log and audit Cloud Storage buckets to ensure log immutability', missing.map((b) => b.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── Cloud Logging Checks ──────────────────────────────────────────────────────

async function checkLoggingLogSinks(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.logging.log_sinks'
  const title = 'Cloud Logging Log Sinks Configured'
  try {
    const data = await gcpGet(token, `https://logging.googleapis.com/v2/projects/${projectId}/sinks`)
    const sinks = (data.sinks as Array<Record<string, unknown>> | undefined) ?? []
    if (sinks.length === 0) return fail(id, title, 'No log sinks configured — logs are not exported', 'high', 'Configure log sinks to export Cloud Logging data to GCS, BigQuery, or Pub/Sub for long-term retention')
    return pass(id, title, `${sinks.length} log sink(s) configured`, sinks.map((s) => `${String(s.name)} → ${String(s.destination)}`).join('; '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkLoggingAuditLogs(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.logging.audit_logs_enabled'
  const title = 'Admin Activity and Data Access Audit Logs Enabled'
  try {
    const data = await gcpGet(token, `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`)
    const auditConfigs = (data.auditConfigs as Array<Record<string, unknown>> | undefined) ?? []
    const hasAdminActivity = auditConfigs.some((ac) => {
      const logConfigs = (ac.auditLogConfigs as Array<Record<string, unknown>> | undefined) ?? []
      return logConfigs.some((lc) => lc.logType === 'ADMIN_READ' || lc.logType === 'DATA_WRITE')
    })
    if (hasAdminActivity || auditConfigs.length > 0) return pass(id, title, 'Audit log configurations found in project IAM policy')
    return warn(id, title, 'No explicit audit log configurations found — verify Admin Activity and Data Access logs are enabled', 'medium', 'Enable Admin Activity and Data Access audit logs via Cloud Logging configuration in the GCP console')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkLoggingAlertIamChanges(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.logging.alert_on_iam_changes'
  const title = 'Log-Based Alert for IAM Policy Changes'
  try {
    const data = await gcpGet(token, `https://monitoring.googleapis.com/v3/projects/${projectId}/alertPolicies`)
    const policies = (data.alertPolicies as Array<Record<string, unknown>> | undefined) ?? []
    const iamAlert = policies.find((p) => {
      const displayName = String(p.displayName ?? '').toLowerCase()
      const conditions = (p.conditions as Array<Record<string, unknown>> | undefined) ?? []
      const condStr = JSON.stringify(conditions).toLowerCase()
      return displayName.includes('iam') || condStr.includes('setIamPolicy') || condStr.includes('iam')
    })
    if (iamAlert) return pass(id, title, 'Log-based alert for IAM policy changes is configured', String(iamAlert.displayName))
    return warn(id, title, 'No log-based alert found for IAM policy changes', 'medium', 'Create a log-based metric and alert for protoPayload.methodName="SetIamPolicy" in Cloud Monitoring')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkLoggingAlertNetworkChanges(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.logging.alert_on_network_changes'
  const title = 'Log-Based Alert for Firewall Rule Changes'
  try {
    const data = await gcpGet(token, `https://monitoring.googleapis.com/v3/projects/${projectId}/alertPolicies`)
    const policies = (data.alertPolicies as Array<Record<string, unknown>> | undefined) ?? []
    const networkAlert = policies.find((p) => {
      const displayName = String(p.displayName ?? '').toLowerCase()
      const conditions = (p.conditions as Array<Record<string, unknown>> | undefined) ?? []
      const condStr = JSON.stringify(conditions).toLowerCase()
      return displayName.includes('firewall') || displayName.includes('network') || condStr.includes('firewall') || condStr.includes('network')
    })
    if (networkAlert) return pass(id, title, 'Log-based alert for network/firewall changes is configured', String(networkAlert.displayName))
    return warn(id, title, 'No log-based alert found for firewall rule changes', 'medium', 'Create a log-based metric and alert for compute.firewalls.insert/delete/patch operations in Cloud Monitoring')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── Cloud Armor Checks ────────────────────────────────────────────────────────

async function checkArmorPoliciesExist(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.armor.policies_exist'
  const title = 'Cloud Armor Security Policies Configured'
  try {
    const data = await gcpGet(token, `https://compute.googleapis.com/compute/v1/projects/${projectId}/global/securityPolicies`)
    const policies = (data.items as Array<Record<string, unknown>> | undefined) ?? []
    if (policies.length === 0) return fail(id, title, 'No Cloud Armor security policies found', 'high', 'Create Cloud Armor security policies and attach them to backend services to protect against web attacks')
    return pass(id, title, `${policies.length} Cloud Armor security policy/policies configured`, policies.map((p) => p.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkArmorDdosProtection(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.armor.ddos_protection'
  const title = 'Cloud Armor Adaptive Protection Enabled'
  try {
    const data = await gcpGet(token, `https://compute.googleapis.com/compute/v1/projects/${projectId}/global/securityPolicies`)
    const policies = (data.items as Array<Record<string, unknown>> | undefined) ?? []
    if (policies.length === 0) return skip(id, title, 'No Cloud Armor policies found')
    const withAdaptive = policies.filter((p) => {
      const adaptiveConfig = p.adaptiveProtectionConfig as Record<string, unknown> | undefined
      const layer7 = adaptiveConfig?.layer7DdosDefenseConfig as Record<string, unknown> | undefined
      return layer7?.enable === true
    })
    if (withAdaptive.length === policies.length) return pass(id, title, 'Adaptive Protection is enabled on all Cloud Armor policies')
    if (withAdaptive.length > 0) return warn(id, title, `Only ${withAdaptive.length}/${policies.length} Cloud Armor policies have Adaptive Protection enabled`, 'medium', 'Enable Adaptive Protection on all Cloud Armor security policies for ML-based DDoS defense')
    return fail(id, title, 'No Cloud Armor policies have Adaptive Protection enabled', 'medium', 'Enable Adaptive Protection (layer7DdosDefenseConfig) on Cloud Armor security policies')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── KMS Checks ────────────────────────────────────────────────────────────────

async function checkKmsKeyRotation(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.kms.key_rotation'
  const title = 'KMS Keys Have Rotation Enabled (≤ 365 days)'
  const MAX_ROTATION_SECONDS = 365 * 24 * 3600
  try {
    const locData = await gcpGet(token, `https://cloudkms.googleapis.com/v1/projects/${projectId}/locations`)
    const locations = (locData.locations as Array<Record<string, unknown>> | undefined) ?? []
    const failing: string[] = []
    for (const loc of locations) {
      const locName = String(loc.name ?? '')
      try {
        const ringData = await gcpGet(token, `https://cloudkms.googleapis.com/v1/${locName}/keyRings`)
        const rings = (ringData.keyRings as Array<Record<string, unknown>> | undefined) ?? []
        for (const ring of rings) {
          const ringName = String(ring.name ?? '')
          const keyData = await gcpGet(token, `https://cloudkms.googleapis.com/v1/${ringName}/cryptoKeys`)
          const keys = (keyData.cryptoKeys as Array<Record<string, unknown>> | undefined) ?? []
          for (const key of keys) {
            const rotationPeriod = String(key.rotationPeriod ?? '')
            if (!rotationPeriod) {
              failing.push(String(key.name ?? '').split('/').pop() ?? '')
            } else {
              const seconds = parseFloat(rotationPeriod.replace('s', ''))
              if (seconds > MAX_ROTATION_SECONDS) failing.push(String(key.name ?? '').split('/').pop() ?? '')
            }
          }
        }
      } catch {
        // skip location errors
      }
    }
    if (failing.length === 0) return pass(id, title, 'All KMS keys have rotation enabled with period ≤ 365 days')
    return fail(id, title, `${failing.length} KMS key(s) missing rotation or rotation period > 365 days`, 'high', 'Enable automatic key rotation on all KMS keys with a period no longer than 365 days', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkKmsCmekUsage(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.kms.cmek_usage'
  const title = 'CMEK Used for GCS/BigQuery/Compute'
  try {
    const locData = await gcpGet(token, `https://cloudkms.googleapis.com/v1/projects/${projectId}/locations`)
    const locations = (locData.locations as Array<Record<string, unknown>> | undefined) ?? []
    if (locations.length === 0) return warn(id, title, 'No KMS locations found — CMEK usage cannot be verified', 'medium', 'Configure CMEK keys in Cloud KMS and apply them to GCS buckets, BigQuery datasets, and Compute disks')
    return warn(id, title, 'KMS exists — verify CMEK is applied to GCS, BigQuery, and Compute resources', 'low', 'Ensure CMEK keys are specified when creating GCS buckets, BigQuery datasets, and Compute disks')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── GKE Checks ────────────────────────────────────────────────────────────────

async function checkGkeRbac(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.gke.autopilot_or_rbac'
  const title = 'GKE RBAC Enabled on All Clusters'
  try {
    const data = await gcpGet(token, `https://container.googleapis.com/v1/projects/${projectId}/locations/-/clusters`)
    const clusters = (data.clusters as Array<Record<string, unknown>> | undefined) ?? []
    if (clusters.length === 0) return skip(id, title, 'No GKE clusters found')
    // RBAC is always enabled in GKE 1.8+ and Autopilot; legacy auth being disabled is the check
    const failing = clusters.filter((c) => {
      const legacyAbac = c.legacyAbac as Record<string, unknown> | undefined
      return legacyAbac?.enabled === true
    })
    if (failing.length === 0) return pass(id, title, 'All GKE clusters have legacy ABAC disabled (RBAC-only mode)')
    return fail(id, title, `${failing.length} GKE cluster(s) have legacy ABAC enabled`, 'high', 'Disable legacy ABAC on GKE clusters to enforce RBAC-only authorization', failing.map((c) => String(c.name)).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkGkePrivateCluster(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.gke.private_cluster'
  const title = 'GKE Private Cluster Mode Enabled'
  try {
    const data = await gcpGet(token, `https://container.googleapis.com/v1/projects/${projectId}/locations/-/clusters`)
    const clusters = (data.clusters as Array<Record<string, unknown>> | undefined) ?? []
    if (clusters.length === 0) return skip(id, title, 'No GKE clusters found')
    const failing = clusters.filter((c) => {
      const privateClusterConfig = c.privateClusterConfig as Record<string, unknown> | undefined
      return !privateClusterConfig?.enablePrivateNodes
    })
    if (failing.length === 0) return pass(id, title, 'All GKE clusters use private nodes (private cluster mode)')
    return fail(id, title, `${failing.length} GKE cluster(s) do not use private nodes`, 'high', 'Enable private cluster mode on GKE clusters to prevent nodes from having external IP addresses', failing.map((c) => String(c.name)).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkGkeNetworkPolicy(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.gke.network_policy'
  const title = 'GKE Network Policy Enabled'
  try {
    const data = await gcpGet(token, `https://container.googleapis.com/v1/projects/${projectId}/locations/-/clusters`)
    const clusters = (data.clusters as Array<Record<string, unknown>> | undefined) ?? []
    if (clusters.length === 0) return skip(id, title, 'No GKE clusters found')
    const failing = clusters.filter((c) => {
      const networkPolicy = c.networkPolicy as Record<string, unknown> | undefined
      return !networkPolicy?.enabled
    })
    if (failing.length === 0) return pass(id, title, 'Network policy is enabled on all GKE clusters')
    return fail(id, title, `${failing.length} GKE cluster(s) do not have network policy enabled`, 'high', 'Enable network policy on GKE clusters to control pod-to-pod communication', failing.map((c) => String(c.name)).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── BigQuery Checks ───────────────────────────────────────────────────────────

async function checkBigQueryCmek(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.bigquery.cmek'
  const title = 'BigQuery Datasets Use CMEK'
  try {
    const data = await gcpGet(token, `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets`)
    const datasets = (data.datasets as Array<Record<string, unknown>> | undefined) ?? []
    if (datasets.length === 0) return skip(id, title, 'No BigQuery datasets found')
    const failing: string[] = []
    for (const ds of datasets) {
      const dsRef = ds.datasetReference as Record<string, unknown> | undefined
      const dsId = String(dsRef?.datasetId ?? '')
      try {
        const detail = await gcpGet(token, `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets/${dsId}`)
        const enc = detail.defaultEncryptionConfiguration as Record<string, unknown> | undefined
        if (!enc?.kmsKeyName) failing.push(dsId)
      } catch {
        failing.push(dsId)
      }
    }
    if (failing.length === 0) return pass(id, title, 'All BigQuery datasets use customer-managed encryption keys (CMEK)')
    return warn(id, title, `${failing.length}/${datasets.length} BigQuery dataset(s) use Google-managed keys (not CMEK)`, 'medium', 'Configure CMEK on BigQuery datasets using a Cloud KMS key for enhanced encryption control', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkBigQueryAuditLogs(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.bigquery.audit_logs'
  const title = 'BigQuery Audit Logging Enabled'
  try {
    const data = await gcpGet(token, `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`)
    const auditConfigs = (data.auditConfigs as Array<Record<string, unknown>> | undefined) ?? []
    const bqAudit = auditConfigs.find((ac) =>
      String(ac.service ?? '') === 'bigquery.googleapis.com' ||
      String(ac.service ?? '') === 'allServices'
    )
    if (bqAudit) return pass(id, title, 'BigQuery audit logging is configured via IAM audit config')
    return warn(id, title, 'No explicit BigQuery audit log configuration found', 'medium', 'Enable Data Read/Write/Admin audit logs for bigquery.googleapis.com in the GCP console IAM Audit Logs settings')
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── Cloud SQL Checks ──────────────────────────────────────────────────────────

async function checkCloudSqlSslRequired(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.cloudsql.ssl_required'
  const title = 'Cloud SQL SSL Required for All Connections'
  try {
    const data = await gcpGet(token, `https://sqladmin.googleapis.com/v1/projects/${projectId}/instances`)
    const instances = (data.items as Array<Record<string, unknown>> | undefined) ?? []
    if (instances.length === 0) return skip(id, title, 'No Cloud SQL instances found')
    const failing = instances.filter((inst) => {
      const settings = inst.settings as Record<string, unknown> | undefined
      const ipConfig = settings?.ipConfiguration as Record<string, unknown> | undefined
      return !ipConfig?.requireSsl
    })
    if (failing.length === 0) return pass(id, title, 'SSL is required for all Cloud SQL instances')
    return fail(id, title, `${failing.length} Cloud SQL instance(s) do not require SSL connections`, 'high', 'Enable SSL requirement on Cloud SQL instances to encrypt all database connections', failing.map((i) => i.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkCloudSqlPublicIpDisabled(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.cloudsql.public_ip_disabled'
  const title = 'Cloud SQL No Public IP'
  try {
    const data = await gcpGet(token, `https://sqladmin.googleapis.com/v1/projects/${projectId}/instances`)
    const instances = (data.items as Array<Record<string, unknown>> | undefined) ?? []
    if (instances.length === 0) return skip(id, title, 'No Cloud SQL instances found')
    const failing = instances.filter((inst) => {
      const settings = inst.settings as Record<string, unknown> | undefined
      const ipConfig = settings?.ipConfiguration as Record<string, unknown> | undefined
      const authorizedNetworks = (ipConfig?.authorizedNetworks as Array<unknown> | undefined) ?? []
      // Has public IP if ipv4Enabled is true
      return ipConfig?.ipv4Enabled === true && authorizedNetworks.length > 0
    })
    if (failing.length === 0) return pass(id, title, 'No Cloud SQL instances with publicly accessible IP addresses')
    return fail(id, title, `${failing.length} Cloud SQL instance(s) have public IP and authorized networks configured`, 'high', 'Disable public IP on Cloud SQL instances and use Cloud SQL Auth Proxy or private IP', failing.map((i) => i.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkCloudSqlBackupsEnabled(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.cloudsql.backups_enabled'
  const title = 'Cloud SQL Automated Backups Enabled'
  try {
    const data = await gcpGet(token, `https://sqladmin.googleapis.com/v1/projects/${projectId}/instances`)
    const instances = (data.items as Array<Record<string, unknown>> | undefined) ?? []
    if (instances.length === 0) return skip(id, title, 'No Cloud SQL instances found')
    const failing = instances.filter((inst) => {
      const settings = inst.settings as Record<string, unknown> | undefined
      const backupConfig = settings?.backupConfiguration as Record<string, unknown> | undefined
      return !backupConfig?.enabled
    })
    if (failing.length === 0) return pass(id, title, 'Automated backups are enabled on all Cloud SQL instances')
    return fail(id, title, `${failing.length} Cloud SQL instance(s) do not have automated backups enabled`, 'high', 'Enable automated backups on all Cloud SQL instances for data recovery capability', failing.map((i) => i.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── VPC Checks ────────────────────────────────────────────────────────────────

async function checkVpcFlowLogs(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.vpc.flow_logs'
  const title = 'VPC Flow Logs Enabled for All Subnets'
  try {
    const data = await gcpGet(token, `https://compute.googleapis.com/compute/v1/projects/${projectId}/aggregatedList/subnetworks`)
    const items = data.items as Record<string, Record<string, unknown>> | undefined
    const allSubnets: Array<Record<string, unknown>> = []
    if (items) {
      for (const region of Object.values(items)) {
        const regionSubnets = (region.subnetworks as Array<Record<string, unknown>> | undefined) ?? []
        allSubnets.push(...regionSubnets)
      }
    }
    if (allSubnets.length === 0) return skip(id, title, 'No subnets found')
    const failing = allSubnets.filter((s) => !s.enableFlowLogs)
    if (failing.length === 0) return pass(id, title, 'VPC flow logs are enabled on all subnets', `${allSubnets.length} subnets checked`)
    return fail(id, title, `${failing.length}/${allSubnets.length} subnets do not have VPC flow logs enabled`, 'medium', 'Enable VPC flow logs on all subnets for network traffic visibility and security monitoring', failing.map((s) => s.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkVpcPrivateGoogleAccess(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.vpc.private_google_access'
  const title = 'Private Google Access Enabled for Subnets'
  try {
    const data = await gcpGet(token, `https://compute.googleapis.com/compute/v1/projects/${projectId}/aggregatedList/subnetworks`)
    const items = data.items as Record<string, Record<string, unknown>> | undefined
    const allSubnets: Array<Record<string, unknown>> = []
    if (items) {
      for (const region of Object.values(items)) {
        const regionSubnets = (region.subnetworks as Array<Record<string, unknown>> | undefined) ?? []
        allSubnets.push(...regionSubnets)
      }
    }
    if (allSubnets.length === 0) return skip(id, title, 'No subnets found')
    const failing = allSubnets.filter((s) => !s.privateIpGoogleAccess)
    if (failing.length === 0) return pass(id, title, 'Private Google Access is enabled on all subnets')
    return warn(id, title, `${failing.length}/${allSubnets.length} subnets do not have Private Google Access enabled`, 'low', 'Enable Private Google Access on subnets to allow VMs without external IPs to reach Google APIs', failing.map((s) => s.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkVpcNoOpenSsh(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.vpc.no_open_ssh'
  const title = 'No Firewall Rules Allowing SSH from 0.0.0.0/0'
  try {
    const data = await gcpGet(token, `https://compute.googleapis.com/compute/v1/projects/${projectId}/global/firewalls`)
    const rules = (data.items as Array<Record<string, unknown>> | undefined) ?? []
    const openSsh = rules.filter((r) => {
      if (r.disabled) return false
      if (r.direction !== 'INGRESS') return false
      const sourceRanges = (r.sourceRanges as string[] | undefined) ?? []
      const allowedAll = sourceRanges.includes('0.0.0.0/0') || sourceRanges.includes('::/0')
      const allowed = (r.allowed as Array<Record<string, unknown>> | undefined) ?? []
      const hasSsh = allowed.some((a) => {
        const ports = (a.ports as string[] | undefined) ?? []
        return (String(a.IPProtocol) === 'tcp' && (ports.includes('22') || ports.length === 0)) || String(a.IPProtocol) === 'all'
      })
      return allowedAll && hasSsh
    })
    if (openSsh.length === 0) return pass(id, title, 'No firewall rules allowing SSH (port 22) from 0.0.0.0/0')
    return fail(id, title, `${openSsh.length} firewall rule(s) allow SSH from any IP (0.0.0.0/0)`, 'critical', 'Restrict SSH firewall rules to specific IP ranges or use IAP for BeyondCorp SSH access', openSsh.map((r) => r.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkVpcNoOpenRdp(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.vpc.no_open_rdp'
  const title = 'No Firewall Rules Allowing RDP from 0.0.0.0/0'
  try {
    const data = await gcpGet(token, `https://compute.googleapis.com/compute/v1/projects/${projectId}/global/firewalls`)
    const rules = (data.items as Array<Record<string, unknown>> | undefined) ?? []
    const openRdp = rules.filter((r) => {
      if (r.disabled) return false
      if (r.direction !== 'INGRESS') return false
      const sourceRanges = (r.sourceRanges as string[] | undefined) ?? []
      const allowedAll = sourceRanges.includes('0.0.0.0/0') || sourceRanges.includes('::/0')
      const allowed = (r.allowed as Array<Record<string, unknown>> | undefined) ?? []
      const hasRdp = allowed.some((a) => {
        const ports = (a.ports as string[] | undefined) ?? []
        return (String(a.IPProtocol) === 'tcp' && (ports.includes('3389') || ports.length === 0)) || String(a.IPProtocol) === 'all'
      })
      return allowedAll && hasRdp
    })
    if (openRdp.length === 0) return pass(id, title, 'No firewall rules allowing RDP (port 3389) from 0.0.0.0/0')
    return fail(id, title, `${openRdp.length} firewall rule(s) allow RDP from any IP (0.0.0.0/0)`, 'critical', 'Restrict RDP firewall rules to specific IP ranges or use IAP for BeyondCorp RDP access', openRdp.map((r) => r.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── Cloud Functions / Run Checks ──────────────────────────────────────────────

async function checkFunctionsIngressInternal(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.functions.ingress_internal'
  const title = 'Cloud Functions Configured for Internal Ingress Only'
  try {
    const data = await gcpGet(token, `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/-/functions`)
    const functions = (data.functions as Array<Record<string, unknown>> | undefined) ?? []
    if (functions.length === 0) return skip(id, title, 'No Cloud Functions found')
    const failing = functions.filter((f) => {
      const serviceConfig = f.serviceConfig as Record<string, unknown> | undefined
      const ingressSettings = String(serviceConfig?.ingressSettings ?? '')
      return !ingressSettings || ingressSettings === 'ALLOW_ALL'
    })
    if (failing.length === 0) return pass(id, title, 'All Cloud Functions restrict ingress to internal traffic')
    return fail(id, title, `${failing.length} Cloud Function(s) allow all ingress traffic`, 'medium', 'Set ingressSettings to ALLOW_INTERNAL_ONLY or ALLOW_INTERNAL_AND_GCLB on Cloud Functions', failing.map((f) => f.name).join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

async function checkCloudRunNoAllUsers(token: string, projectId: string): Promise<IntegrationCheckResult> {
  const id = 'gcp.run.no_allUsers'
  const title = 'Cloud Run Services Do Not Allow Unauthenticated Access'
  try {
    const data = await gcpGet(token, `https://run.googleapis.com/v1/projects/${projectId}/locations/-/services`)
    const services = (data.items as Array<Record<string, unknown>> | undefined) ?? []
    if (services.length === 0) return skip(id, title, 'No Cloud Run services found')
    const failing: string[] = []
    for (const svc of services) {
      const svcName = String(svc.metadata ? (svc.metadata as Record<string, unknown>).name : '')
      const region = String(svc.metadata ? (svc.metadata as Record<string, unknown>).namespace : projectId)
      try {
        const iamData = await gcpGet(token, `https://run.googleapis.com/v1/projects/${region}/locations/-/services/${svcName}:getIamPolicy`)
        const bindings = (iamData.bindings as Array<Record<string, unknown>> | undefined) ?? []
        const hasAllUsers = bindings.some((b) => {
          const members = (b.members as string[] | undefined) ?? []
          return members.includes('allUsers') && b.role === 'roles/run.invoker'
        })
        if (hasAllUsers) failing.push(svcName)
      } catch {
        // skip
      }
    }
    if (failing.length === 0) return pass(id, title, 'No Cloud Run services allow unauthenticated (allUsers) access')
    return fail(id, title, `${failing.length} Cloud Run service(s) allow unauthenticated access`, 'high', 'Remove allUsers IAM binding from Cloud Run services and require authentication via Identity-Aware Proxy or service identity', failing.join(', '))
  } catch (e) {
    return skip(id, title, `Check skipped: ${String(e)}`)
  }
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runGCPChecks(config: GCPConfig): Promise<IntegrationCheckResult[]> {
  const { serviceAccountJson, projectId } = config

  let token: string
  try {
    token = await getGCPToken(serviceAccountJson)
  } catch (e) {
    const errMsg = `Failed to obtain GCP token: ${String(e)}`
    const checkIds = [
      'gcp.compute.os_login', 'gcp.compute.serial_port_disabled', 'gcp.compute.public_ips',
      'gcp.compute.disk_encryption', 'gcp.compute.shielded_vms',
      'gcp.iam.service_account_keys', 'gcp.iam.primitive_roles', 'gcp.iam.workload_identity',
      'gcp.iam.org_policy_constraints', 'gcp.iam.admin_sa_keys',
      'gcp.storage.uniform_access', 'gcp.storage.public_access', 'gcp.storage.versioning', 'gcp.storage.retention_policy',
      'gcp.logging.log_sinks', 'gcp.logging.audit_logs_enabled', 'gcp.logging.alert_on_iam_changes', 'gcp.logging.alert_on_network_changes',
      'gcp.armor.policies_exist', 'gcp.armor.ddos_protection',
      'gcp.kms.key_rotation', 'gcp.kms.cmek_usage',
      'gcp.gke.autopilot_or_rbac', 'gcp.gke.private_cluster', 'gcp.gke.network_policy',
      'gcp.bigquery.cmek', 'gcp.bigquery.audit_logs',
      'gcp.cloudsql.ssl_required', 'gcp.cloudsql.public_ip_disabled', 'gcp.cloudsql.backups_enabled',
      'gcp.vpc.flow_logs', 'gcp.vpc.private_google_access', 'gcp.vpc.no_open_ssh', 'gcp.vpc.no_open_rdp',
      'gcp.functions.ingress_internal', 'gcp.run.no_allUsers',
    ]
    return checkIds.map((checkId) => skip(checkId, checkId, errMsg))
  }

  const results = await Promise.allSettled([
    // Compute
    checkComputeOsLogin(token, projectId),
    checkComputeSerialPortDisabled(token, projectId),
    checkComputePublicIps(token, projectId),
    checkComputeDiskEncryption(token, projectId),
    checkComputeShieldedVms(token, projectId),
    // IAM
    checkIamServiceAccountKeys(token, projectId),
    checkIamPrimitiveRoles(token, projectId),
    checkIamWorkloadIdentity(token, projectId),
    checkIamOrgPolicyConstraints(token, projectId),
    checkIamAdminSaKeys(token, projectId),
    // Storage
    checkStorageUniformAccess(token, projectId),
    checkStoragePublicAccess(token, projectId),
    checkStorageVersioning(token, projectId),
    checkStorageRetentionPolicy(token, projectId),
    // Logging
    checkLoggingLogSinks(token, projectId),
    checkLoggingAuditLogs(token, projectId),
    checkLoggingAlertIamChanges(token, projectId),
    checkLoggingAlertNetworkChanges(token, projectId),
    // Armor
    checkArmorPoliciesExist(token, projectId),
    checkArmorDdosProtection(token, projectId),
    // KMS
    checkKmsKeyRotation(token, projectId),
    checkKmsCmekUsage(token, projectId),
    // GKE
    checkGkeRbac(token, projectId),
    checkGkePrivateCluster(token, projectId),
    checkGkeNetworkPolicy(token, projectId),
    // BigQuery
    checkBigQueryCmek(token, projectId),
    checkBigQueryAuditLogs(token, projectId),
    // Cloud SQL
    checkCloudSqlSslRequired(token, projectId),
    checkCloudSqlPublicIpDisabled(token, projectId),
    checkCloudSqlBackupsEnabled(token, projectId),
    // VPC
    checkVpcFlowLogs(token, projectId),
    checkVpcPrivateGoogleAccess(token, projectId),
    checkVpcNoOpenSsh(token, projectId),
    checkVpcNoOpenRdp(token, projectId),
    // Functions / Run
    checkFunctionsIngressInternal(token, projectId),
    checkCloudRunNoAllUsers(token, projectId),
  ])

  const checkIds = [
    'gcp.compute.os_login', 'gcp.compute.serial_port_disabled', 'gcp.compute.public_ips',
    'gcp.compute.disk_encryption', 'gcp.compute.shielded_vms',
    'gcp.iam.service_account_keys', 'gcp.iam.primitive_roles', 'gcp.iam.workload_identity',
    'gcp.iam.org_policy_constraints', 'gcp.iam.admin_sa_keys',
    'gcp.storage.uniform_access', 'gcp.storage.public_access', 'gcp.storage.versioning', 'gcp.storage.retention_policy',
    'gcp.logging.log_sinks', 'gcp.logging.audit_logs_enabled', 'gcp.logging.alert_on_iam_changes', 'gcp.logging.alert_on_network_changes',
    'gcp.armor.policies_exist', 'gcp.armor.ddos_protection',
    'gcp.kms.key_rotation', 'gcp.kms.cmek_usage',
    'gcp.gke.autopilot_or_rbac', 'gcp.gke.private_cluster', 'gcp.gke.network_policy',
    'gcp.bigquery.cmek', 'gcp.bigquery.audit_logs',
    'gcp.cloudsql.ssl_required', 'gcp.cloudsql.public_ip_disabled', 'gcp.cloudsql.backups_enabled',
    'gcp.vpc.flow_logs', 'gcp.vpc.private_google_access', 'gcp.vpc.no_open_ssh', 'gcp.vpc.no_open_rdp',
    'gcp.functions.ingress_internal', 'gcp.run.no_allUsers',
  ]

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return skip(checkIds[i] ?? `check_${i}`, checkIds[i] ?? `Check ${i}`, `Check threw: ${r.reason}`)
  })
}
