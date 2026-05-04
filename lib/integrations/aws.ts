/**
 * lib/integrations/aws.ts
 * AWS security checks runner using AWS REST APIs with Signature V4 signing.
 * No AWS SDK — uses fetch + Web Crypto API.
 */

import type { IntegrationCheckResult } from './base'

// ── Config ─────────────────────────────────────────────────────────────────────

export interface AWSConfig {
  accessKeyId: string
  secretAccessKey: string
  region: string
  sessionToken?: string
}

// ── SigV4 Signer ───────────────────────────────────────────────────────────────

async function hmacSHA256(key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const keyData = typeof key === 'string' ? encoder.encode(key) : key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
}

async function sha256Hash(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * AWS Signature Version 4 signer.
 * Returns additional headers to add to the request.
 */
async function signRequest(opts: {
  method: string
  url: string
  service: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  body?: string
  extraHeaders?: Record<string, string>
}): Promise<Record<string, string>> {
  const url = new URL(opts.url)
  const body = opts.body ?? ''
  const now = new Date()

  // Format dates
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') // YYYYMMDDTHHmmssZ

  const payloadHash = await sha256Hash(body)

  // Build canonical headers
  const headers: Record<string, string> = {
    host: url.hostname,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    ...(opts.sessionToken ? { 'x-amz-security-token': opts.sessionToken } : {}),
    ...(opts.extraHeaders ?? {}),
  }

  const sortedHeaderKeys = Object.keys(headers).sort()
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headers[k]}\n`).join('')
  const signedHeaders = sortedHeaderKeys.join(';')

  // Build canonical query string
  const queryParams = Array.from(url.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const canonicalRequest = [
    opts.method.toUpperCase(),
    url.pathname || '/',
    queryParams,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${opts.region}/${opts.service}/aws4_request`

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hash(canonicalRequest),
  ].join('\n')

  // Derive signing key
  const kSecret = new TextEncoder().encode(`AWS4${opts.secretAccessKey}`).buffer as ArrayBuffer
  const kDate = await hmacSHA256(kSecret, dateStamp)
  const kRegion = await hmacSHA256(kDate, opts.region)
  const kService = await hmacSHA256(kRegion, opts.service)
  const kSigning = await hmacSHA256(kService, 'aws4_request')
  const signature = bufToHex(await hmacSHA256(kSigning, stringToSign))

  const authHeader = `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    'Authorization': authHeader,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    ...(opts.sessionToken ? { 'x-amz-security-token': opts.sessionToken } : {}),
    ...(opts.extraHeaders ?? {}),
  }
}

// ── HTTP helper ────────────────────────────────────────────────────────────────

async function awsFetch<T>(opts: {
  service: string
  region: string
  config: AWSConfig
  method?: string
  url: string
  body?: string
  extraHeaders?: Record<string, string>
  parseXML?: boolean
}): Promise<{ data: T | null; status: number; error?: string; raw?: string }> {
  const method = opts.method ?? 'POST'
  try {
    const sigHeaders = await signRequest({
      method,
      url: opts.url,
      service: opts.service,
      region: opts.region,
      accessKeyId: opts.config.accessKeyId,
      secretAccessKey: opts.config.secretAccessKey,
      sessionToken: opts.config.sessionToken,
      body: opts.body,
      extraHeaders: opts.extraHeaders,
    })

    const res = await fetch(opts.url, {
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...sigHeaders,
        ...(opts.extraHeaders ?? {}),
      },
      body: opts.body || undefined,
    })

    const raw = await res.text()

    if (res.status === 403 || res.status === 401) {
      return { data: null, status: res.status, error: 'AccessDenied', raw }
    }
    if (!res.ok) {
      return { data: null, status: res.status, error: raw, raw }
    }

    // For JSON APIs (like GuardDuty, SecurityHub)
    if (!opts.parseXML && raw.trimStart().startsWith('{')) {
      return { data: JSON.parse(raw) as T, status: res.status, raw }
    }

    return { data: raw as unknown as T, status: res.status, raw }
  } catch (err) {
    return { data: null, status: 0, error: String(err) }
  }
}

// Simple XML value extractor
function xmlValue(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))
  return m ? m[1] : null
}

function xmlValues(xml: string, tag: string): string[] {
  const results: string[] = []
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1])
  }
  return results
}

function xmlBlocks(xml: string, tag: string): string[] {
  const results: string[] = []
  const re = new RegExp(`<${tag}[\\s\\S]*?</${tag}>`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    results.push(m[0])
  }
  return results
}

// ── IAM Checks ─────────────────────────────────────────────────────────────────

/**
 * 1. aws.iam.mfa_root — Root account has MFA enabled
 * NIST: IA-2(1), IA-2(2)
 */
async function checkIAMMFARoot(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await awsFetch<string>({
    service: 'iam',
    region: 'us-east-1',
    config: cfg,
    method: 'POST',
    url: 'https://iam.amazonaws.com/',
    body: 'Action=GetAccountSummary&Version=2010-05-08',
    parseXML: true,
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.iam.mfa_root', title: 'Root Account MFA', description: 'Access denied — insufficient IAM permissions.', status: 'skip', severity: 'critical' }
  }

  const mfaDevices = xmlValue(raw as string, 'AccountMFAEnabled') ?? '0'
  const enabled = mfaDevices === '1'

  return {
    checkId: 'aws.iam.mfa_root',
    title: 'Root Account MFA Enabled',
    description: enabled ? 'Root account has MFA enabled.' : 'Root account does NOT have MFA enabled — critical security risk.',
    status: enabled ? 'pass' : 'fail',
    severity: 'critical',
    resource: 'AWS Root Account',
    remediation: 'Enable MFA on the root account via AWS Console → Security credentials. Use a hardware MFA device for root.',
    evidence: `AccountMFAEnabled: ${mfaDevices}`,
    rawData: { mfaDevices },
  }
}

/**
 * 2. aws.iam.access_key_rotation — No IAM access keys older than 90 days
 * NIST: IA-5(1), AC-2
 */
async function checkAccessKeyRotation(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await awsFetch<string>({
    service: 'iam',
    region: 'us-east-1',
    config: cfg,
    method: 'POST',
    url: 'https://iam.amazonaws.com/',
    body: 'Action=ListUsers&Version=2010-05-08',
    parseXML: true,
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.iam.access_key_rotation', title: 'IAM Access Key Rotation', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const usernames = xmlValues(raw as string, 'UserName')
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const staleKeys: string[] = []

  for (const username of usernames.slice(0, 20)) {
    const { data: keysRaw } = await awsFetch<string>({
      service: 'iam',
      region: 'us-east-1',
      config: cfg,
      method: 'POST',
      url: 'https://iam.amazonaws.com/',
      body: `Action=ListAccessKeys&UserName=${encodeURIComponent(username)}&Version=2010-05-08`,
      parseXML: true,
    })
    if (!keysRaw) continue
    const createDates = xmlValues(keysRaw as string, 'CreateDate')
    const statuses = xmlValues(keysRaw as string, 'Status')

    createDates.forEach((dateStr, i) => {
      const created = new Date(dateStr)
      const isActive = statuses[i] === 'Active'
      if (isActive && created < ninetyDaysAgo) {
        staleKeys.push(username)
      }
    })
  }

  return {
    checkId: 'aws.iam.access_key_rotation',
    title: 'IAM Access Key Rotation (>90 days)',
    description: staleKeys.length === 0 ? 'No active access keys older than 90 days.' : `${staleKeys.length} users have active access keys older than 90 days.`,
    status: staleKeys.length === 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: staleKeys.slice(0, 5).join(', ') || undefined,
    remediation: 'Rotate IAM access keys older than 90 days. Use IAM Console → Users → Security credentials.',
    evidence: `Checked ${usernames.length} users. Stale active keys: ${staleKeys.length}.`,
    rawData: { staleKeys },
  }
}

/**
 * 3. aws.iam.unused_credentials — No credentials unused for 90+ days
 * NIST: AC-2(3), IA-5
 */
async function checkUnusedCredentials(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await awsFetch<string>({
    service: 'iam',
    region: 'us-east-1',
    config: cfg,
    method: 'POST',
    url: 'https://iam.amazonaws.com/',
    body: 'Action=GenerateCredentialReport&Version=2010-05-08',
    parseXML: true,
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.iam.unused_credentials', title: 'Unused IAM Credentials', description: 'Access denied.', status: 'skip', severity: 'medium' }
  }

  // Credential report takes a moment to generate — we just check the status
  const reportState = xmlValue(raw as string, 'State') ?? 'unknown'

  return {
    checkId: 'aws.iam.unused_credentials',
    title: 'Unused IAM Credentials (>90 days)',
    description: 'IAM credential report generation initiated. Review the report in IAM Console for unused credentials.',
    status: 'warn',
    severity: 'medium',
    resource: `Credential report state: ${reportState}`,
    remediation: 'Download the IAM credential report and disable/remove credentials unused for 90+ days.',
    evidence: `Credential report state: ${reportState}. Manual review required.`,
    rawData: { reportState },
  }
}

/**
 * 4. aws.iam.password_policy — Strong password policy
 * NIST: IA-5(1), AC-2
 */
async function checkPasswordPolicy(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await awsFetch<string>({
    service: 'iam',
    region: 'us-east-1',
    config: cfg,
    method: 'POST',
    url: 'https://iam.amazonaws.com/',
    body: 'Action=GetAccountPasswordPolicy&Version=2010-05-08',
    parseXML: true,
  })

  if (status === 404) {
    return {
      checkId: 'aws.iam.password_policy',
      title: 'IAM Password Policy',
      description: 'No custom IAM password policy configured — using AWS defaults (weak).',
      status: 'fail',
      severity: 'high',
      remediation: 'Configure a strong IAM password policy: minimum 14 chars, require uppercase, lowercase, numbers, symbols, disable reuse of last 24 passwords.',
    }
  }
  if (status === 403 || !raw) {
    return { checkId: 'aws.iam.password_policy', title: 'IAM Password Policy', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const minLength = parseInt(xmlValue(raw as string, 'MinimumPasswordLength') ?? '0', 10)
  const requireUpper = xmlValue(raw as string, 'RequireUppercaseCharacters') === 'true'
  const requireLower = xmlValue(raw as string, 'RequireLowercaseCharacters') === 'true'
  const requireNumbers = xmlValue(raw as string, 'RequireNumbers') === 'true'
  const requireSymbols = xmlValue(raw as string, 'RequireSymbols') === 'true'

  const issues: string[] = []
  if (minLength < 14) issues.push(`minimum length ${minLength} < 14`)
  if (!requireUpper) issues.push('uppercase not required')
  if (!requireLower) issues.push('lowercase not required')
  if (!requireNumbers) issues.push('numbers not required')
  if (!requireSymbols) issues.push('symbols not required')

  return {
    checkId: 'aws.iam.password_policy',
    title: 'IAM Password Policy Strength',
    description: issues.length === 0 ? 'IAM password policy meets security requirements.' : `IAM password policy is weak: ${issues.join(', ')}.`,
    status: issues.length === 0 ? 'pass' : issues.length <= 1 ? 'warn' : 'fail',
    severity: 'high',
    resource: 'Account Password Policy',
    remediation: 'Strengthen IAM password policy: min 14 chars, require uppercase, lowercase, numbers, symbols.',
    evidence: `Min length: ${minLength}, Upper: ${requireUpper}, Lower: ${requireLower}, Numbers: ${requireNumbers}, Symbols: ${requireSymbols}`,
    rawData: { minLength, requireUpper, requireLower, requireNumbers, requireSymbols },
  }
}

/**
 * 5. aws.iam.support_role — IAM role for AWS Support exists
 * NIST: IR-7, SA-9
 */
async function checkSupportRole(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await awsFetch<string>({
    service: 'iam',
    region: 'us-east-1',
    config: cfg,
    method: 'POST',
    url: 'https://iam.amazonaws.com/',
    body: 'Action=ListRoles&Version=2010-05-08&MaxItems=100',
    parseXML: true,
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.iam.support_role', title: 'AWS Support IAM Role', description: 'Access denied.', status: 'skip', severity: 'low' }
  }

  const roleNames = xmlValues(raw as string, 'RoleName')
  const hasSupportRole = roleNames.some((n) =>
    n.toLowerCase().includes('support') || n.toLowerCase().includes('aws-support')
  )

  return {
    checkId: 'aws.iam.support_role',
    title: 'AWS Support IAM Role',
    description: hasSupportRole ? 'IAM role for AWS Support access exists.' : 'No dedicated IAM role for AWS Support found.',
    status: hasSupportRole ? 'pass' : 'warn',
    severity: 'low',
    resource: hasSupportRole ? roleNames.find((n) => n.toLowerCase().includes('support')) : undefined,
    remediation: 'Create an IAM role with AWSSupportAccess policy for authorized users who need to contact AWS Support.',
    evidence: `Found ${roleNames.length} roles. Support role exists: ${hasSupportRole}.`,
    rawData: { hasSupportRole, roleCount: roleNames.length },
  }
}

/**
 * 6. aws.iam.root_access_keys — Root account has no active access keys
 * NIST: AC-6, IA-5
 */
async function checkRootAccessKeys(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await awsFetch<string>({
    service: 'iam',
    region: 'us-east-1',
    config: cfg,
    method: 'POST',
    url: 'https://iam.amazonaws.com/',
    body: 'Action=GetAccountSummary&Version=2010-05-08',
    parseXML: true,
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.iam.root_access_keys', title: 'Root Account Access Keys', description: 'Access denied.', status: 'skip', severity: 'critical' }
  }

  const rootKeys = xmlValue(raw as string, 'AccountAccessKeysPresent') ?? '0'
  const hasKeys = rootKeys !== '0'

  return {
    checkId: 'aws.iam.root_access_keys',
    title: 'Root Account Access Keys',
    description: hasKeys ? 'Root account has active access keys — critical security risk.' : 'Root account has no active access keys.',
    status: hasKeys ? 'fail' : 'pass',
    severity: 'critical',
    resource: 'AWS Root Account',
    remediation: 'Delete all root account access keys immediately. Use IAM users or roles for programmatic access.',
    evidence: `Root access keys present: ${rootKeys}`,
    rawData: { rootKeysPresent: rootKeys },
  }
}

// ── S3 Checks ──────────────────────────────────────────────────────────────────

/**
 * 7. aws.s3.public_access_block — Account-level S3 public access block
 * NIST: SC-7, AC-3
 */
async function checkS3PublicAccessBlock(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const url = `https://s3.amazonaws.com/?publicAccessBlock`
  const { data: raw, status } = await awsFetch<string>({
    service: 's3',
    region: cfg.region,
    config: cfg,
    method: 'GET',
    url,
    parseXML: true,
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.s3.public_access_block', title: 'S3 Account Public Access Block', description: 'Access denied or not configured.', status: 'skip', severity: 'critical' }
  }

  const blockAll = xmlValue(raw as string, 'BlockPublicAcls') === 'true' &&
    xmlValue(raw as string, 'IgnorePublicAcls') === 'true' &&
    xmlValue(raw as string, 'BlockPublicPolicy') === 'true' &&
    xmlValue(raw as string, 'RestrictPublicBuckets') === 'true'

  return {
    checkId: 'aws.s3.public_access_block',
    title: 'S3 Account-Level Public Access Block',
    description: blockAll ? 'Account-level S3 public access block is fully enabled.' : 'Account-level S3 public access block is not fully enabled.',
    status: blockAll ? 'pass' : 'fail',
    severity: 'critical',
    resource: 'S3 Account Settings',
    remediation: 'Enable all four S3 block public access settings at the account level: S3 Console → Block Public Access → Edit.',
    evidence: `BlockPublicAcls: ${xmlValue(raw as string, 'BlockPublicAcls')}, IgnorePublicAcls: ${xmlValue(raw as string, 'IgnorePublicAcls')}, BlockPublicPolicy: ${xmlValue(raw as string, 'BlockPublicPolicy')}, RestrictPublicBuckets: ${xmlValue(raw as string, 'RestrictPublicBuckets')}`,
  }
}

/**
 * 8. aws.s3.bucket_encryption — All buckets have default encryption
 * NIST: SC-28, AU-9
 */
async function checkS3BucketEncryption(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await awsFetch<string>({
    service: 's3',
    region: cfg.region,
    config: cfg,
    method: 'GET',
    url: 'https://s3.amazonaws.com/',
    parseXML: true,
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.s3.bucket_encryption', title: 'S3 Bucket Default Encryption', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const buckets = xmlValues(raw as string, 'Name')
  const unencrypted: string[] = []

  for (const bucket of buckets.slice(0, 20)) {
    const { data: encRaw, status: encStatus } = await awsFetch<string>({
      service: 's3',
      region: cfg.region,
      config: cfg,
      method: 'GET',
      url: `https://${bucket}.s3.${cfg.region}.amazonaws.com/?encryption`,
      parseXML: true,
    })
    if (encStatus === 404 || !encRaw) {
      unencrypted.push(bucket)
    }
  }

  return {
    checkId: 'aws.s3.bucket_encryption',
    title: 'S3 Bucket Default Encryption',
    description: unencrypted.length === 0 ? 'All S3 buckets have default encryption enabled.' : `${unencrypted.length} buckets do not have default encryption.`,
    status: unencrypted.length === 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: unencrypted.slice(0, 5).join(', ') || undefined,
    remediation: 'Enable default encryption (SSE-S3 or SSE-KMS) on all S3 buckets: S3 Console → Bucket → Properties → Default encryption.',
    evidence: `Checked ${buckets.length} buckets. Unencrypted: ${unencrypted.length}.`,
    rawData: { unencrypted, total: buckets.length },
  }
}

/**
 * 9. aws.s3.versioning — Buckets have versioning enabled
 * NIST: CP-9, AU-9
 */
async function checkS3Versioning(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await awsFetch<string>({
    service: 's3',
    region: cfg.region,
    config: cfg,
    method: 'GET',
    url: 'https://s3.amazonaws.com/',
    parseXML: true,
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.s3.versioning', title: 'S3 Bucket Versioning', description: 'Access denied.', status: 'skip', severity: 'medium' }
  }

  const buckets = xmlValues(raw as string, 'Name')
  const noVersioning: string[] = []

  for (const bucket of buckets.slice(0, 20)) {
    const { data: vRaw } = await awsFetch<string>({
      service: 's3',
      region: cfg.region,
      config: cfg,
      method: 'GET',
      url: `https://${bucket}.s3.${cfg.region}.amazonaws.com/?versioning`,
      parseXML: true,
    })
    const vStatus = vRaw ? xmlValue(vRaw as string, 'Status') : null
    if (vStatus !== 'Enabled') {
      noVersioning.push(bucket)
    }
  }

  return {
    checkId: 'aws.s3.versioning',
    title: 'S3 Bucket Versioning',
    description: noVersioning.length === 0 ? 'All S3 buckets have versioning enabled.' : `${noVersioning.length} buckets do not have versioning enabled.`,
    status: noVersioning.length === 0 ? 'pass' : 'warn',
    severity: 'medium',
    resource: noVersioning.slice(0, 5).join(', ') || undefined,
    remediation: 'Enable versioning on S3 buckets, especially those containing critical data: S3 Console → Bucket → Properties → Versioning.',
    evidence: `Checked ${buckets.length} buckets. Without versioning: ${noVersioning.length}.`,
    rawData: { noVersioning, total: buckets.length },
  }
}

/**
 * 10. aws.s3.logging — Server access logging enabled
 * NIST: AU-2, AU-12
 */
async function checkS3Logging(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await awsFetch<string>({
    service: 's3',
    region: cfg.region,
    config: cfg,
    method: 'GET',
    url: 'https://s3.amazonaws.com/',
    parseXML: true,
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.s3.logging', title: 'S3 Server Access Logging', description: 'Access denied.', status: 'skip', severity: 'medium' }
  }

  const buckets = xmlValues(raw as string, 'Name')
  const noLogging: string[] = []

  for (const bucket of buckets.slice(0, 20)) {
    const { data: logRaw, status: logStatus } = await awsFetch<string>({
      service: 's3',
      region: cfg.region,
      config: cfg,
      method: 'GET',
      url: `https://${bucket}.s3.${cfg.region}.amazonaws.com/?logging`,
      parseXML: true,
    })
    const hasLogging = logRaw && xmlValue(logRaw as string, 'TargetBucket') !== null
    if (!hasLogging) {
      noLogging.push(bucket)
    }
  }

  return {
    checkId: 'aws.s3.logging',
    title: 'S3 Server Access Logging',
    description: noLogging.length === 0 ? 'All S3 buckets have server access logging enabled.' : `${noLogging.length} buckets do not have server access logging.`,
    status: noLogging.length === 0 ? 'pass' : 'warn',
    severity: 'medium',
    resource: noLogging.slice(0, 5).join(', ') || undefined,
    remediation: 'Enable server access logging on S3 buckets: S3 Console → Bucket → Properties → Server access logging.',
    evidence: `Checked ${buckets.length} buckets. Without logging: ${noLogging.length}.`,
    rawData: { noLogging, total: buckets.length },
  }
}

// ── CloudTrail Checks ──────────────────────────────────────────────────────────

async function fetchCloudTrailJSON<T>(cfg: AWSConfig, target: string, body: string): Promise<{ data: T | null; status: number }> {
  const url = `https://cloudtrail.${cfg.region}.amazonaws.com/`
  const { data, status } = await awsFetch<T>({
    service: 'cloudtrail',
    region: cfg.region,
    config: cfg,
    method: 'POST',
    url,
    body: JSON.stringify(JSON.parse(body)),
    extraHeaders: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': target,
    },
    parseXML: false,
  })
  return { data, status }
}

/**
 * 11. aws.cloudtrail.enabled — CloudTrail enabled
 * NIST: AU-2, AU-12
 */
async function checkCloudTrailEnabled(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data, status } = await fetchCloudTrailJSON<{ trailList?: Array<{ Name: string; IsMultiRegionTrail: boolean; HasCustomEventSelectors: boolean }> }>(
    cfg,
    'com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.DescribeTrails',
    '{"includeShadowTrails": true}',
  )

  if (status === 403 || !data) {
    return { checkId: 'aws.cloudtrail.enabled', title: 'CloudTrail Enabled', description: 'Access denied.', status: 'skip', severity: 'critical' }
  }

  const trails = data.trailList ?? []
  const multiRegion = trails.filter((t) => t.IsMultiRegionTrail)

  return {
    checkId: 'aws.cloudtrail.enabled',
    title: 'CloudTrail Enabled in All Regions',
    description: multiRegion.length > 0 ? `CloudTrail has ${multiRegion.length} multi-region trail(s) active.` : 'No multi-region CloudTrail trail found — API activity may not be fully logged.',
    status: multiRegion.length > 0 ? 'pass' : 'fail',
    severity: 'critical',
    resource: trails.map((t) => t.Name).join(', ') || undefined,
    remediation: 'Enable a multi-region CloudTrail trail to capture API activity in all regions.',
    evidence: `Total trails: ${trails.length}. Multi-region: ${multiRegion.length}.`,
    rawData: { trails: trails.map((t) => ({ name: t.Name, multiRegion: t.IsMultiRegionTrail })) },
  }
}

/**
 * 12. aws.cloudtrail.log_validation — Log file validation enabled
 * NIST: AU-9, SI-7
 */
async function checkCloudTrailLogValidation(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data, status } = await fetchCloudTrailJSON<{ trailList?: Array<{ Name: string; LogFileValidationEnabled: boolean }> }>(
    cfg,
    'com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.DescribeTrails',
    '{}',
  )

  if (status === 403 || !data) {
    return { checkId: 'aws.cloudtrail.log_validation', title: 'CloudTrail Log Validation', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const trails = data.trailList ?? []
  const noValidation = trails.filter((t) => !t.LogFileValidationEnabled)

  return {
    checkId: 'aws.cloudtrail.log_validation',
    title: 'CloudTrail Log File Validation',
    description: noValidation.length === 0 ? 'All CloudTrail trails have log file validation enabled.' : `${noValidation.length} trails do not have log file validation enabled.`,
    status: noValidation.length === 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: noValidation.map((t) => t.Name).join(', ') || undefined,
    remediation: 'Enable log file validation on all CloudTrail trails to detect tampering.',
    evidence: `Checked ${trails.length} trails. Without validation: ${noValidation.length}.`,
    rawData: { noValidation: noValidation.map((t) => t.Name) },
  }
}

/**
 * 13. aws.cloudtrail.s3_logging — CloudTrail logs to S3
 * NIST: AU-9, AU-11
 */
async function checkCloudTrailS3(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data, status } = await fetchCloudTrailJSON<{ trailList?: Array<{ Name: string; S3BucketName?: string }> }>(
    cfg,
    'com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.DescribeTrails',
    '{}',
  )

  if (status === 403 || !data) {
    return { checkId: 'aws.cloudtrail.s3_logging', title: 'CloudTrail S3 Logging', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const trails = data.trailList ?? []
  const withS3 = trails.filter((t) => !!t.S3BucketName)

  return {
    checkId: 'aws.cloudtrail.s3_logging',
    title: 'CloudTrail Logs to S3',
    description: withS3.length > 0 ? `${withS3.length} CloudTrail trails logging to S3.` : 'No CloudTrail trails configured to log to S3.',
    status: withS3.length > 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: withS3.map((t) => t.S3BucketName).join(', ') || undefined,
    remediation: 'Configure CloudTrail to deliver logs to an S3 bucket with MFA delete and versioning enabled.',
    evidence: `Trails with S3: ${withS3.length}/${trails.length}.`,
    rawData: { trailsWithS3: withS3.map((t) => ({ name: t.Name, bucket: t.S3BucketName })) },
  }
}

// ── Config Checks ──────────────────────────────────────────────────────────────

async function fetchConfigJSON<T>(cfg: AWSConfig, target: string, bodyObj: Record<string, unknown>): Promise<{ data: T | null; status: number }> {
  const url = `https://config.${cfg.region}.amazonaws.com/`
  const { data, status } = await awsFetch<T>({
    service: 'config',
    region: cfg.region,
    config: cfg,
    method: 'POST',
    url,
    body: JSON.stringify(bodyObj),
    extraHeaders: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': target,
    },
    parseXML: false,
  })
  return { data, status }
}

/**
 * 14. aws.config.enabled — AWS Config enabled
 * NIST: CM-6, CM-8
 */
async function checkAWSConfigEnabled(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data, status } = await fetchConfigJSON<{ ConfigurationRecorders?: Array<{ name: string; recordingGroup?: unknown }> }>(
    cfg,
    'StarlingDoveService.DescribeConfigurationRecorders',
    {},
  )

  if (status === 403 || !data) {
    return { checkId: 'aws.config.enabled', title: 'AWS Config Enabled', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const recorders = data.ConfigurationRecorders ?? []

  return {
    checkId: 'aws.config.enabled',
    title: 'AWS Config Enabled',
    description: recorders.length > 0 ? `AWS Config is enabled with ${recorders.length} recorder(s).` : 'AWS Config is not enabled in this region.',
    status: recorders.length > 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: `Region: ${cfg.region}`,
    remediation: 'Enable AWS Config in all active regions to track resource configuration changes.',
    evidence: `Config recorders: ${recorders.length}.`,
    rawData: { recorders: recorders.map((r) => r.name) },
  }
}

/**
 * 15. aws.config.rules — At least 5 Config rules active
 * NIST: CM-6, CM-7
 */
async function checkAWSConfigRules(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data, status } = await fetchConfigJSON<{ ConfigRules?: Array<{ ConfigRuleName: string; ConfigRuleState: string }> }>(
    cfg,
    'StarlingDoveService.DescribeConfigRules',
    {},
  )

  if (status === 403 || !data) {
    return { checkId: 'aws.config.rules', title: 'AWS Config Rules', description: 'Access denied.', status: 'skip', severity: 'medium' }
  }

  const rules = data.ConfigRules ?? []
  const activeRules = rules.filter((r) => r.ConfigRuleState === 'ACTIVE')

  return {
    checkId: 'aws.config.rules',
    title: 'AWS Config Rules (≥5 active)',
    description: activeRules.length >= 5 ? `${activeRules.length} active AWS Config rules configured.` : `Only ${activeRules.length} active Config rules — recommend at least 5.`,
    status: activeRules.length >= 5 ? 'pass' : activeRules.length > 0 ? 'warn' : 'fail',
    severity: 'medium',
    resource: `${activeRules.length} active rules`,
    remediation: 'Add AWS Config managed rules for key security checks: mfa-enabled-for-iam-console-access, encrypted-volumes, etc.',
    evidence: `Total rules: ${rules.length}. Active: ${activeRules.length}.`,
    rawData: { total: rules.length, active: activeRules.length },
  }
}

// ── GuardDuty Checks ───────────────────────────────────────────────────────────

/**
 * 16. aws.guardduty.enabled — GuardDuty enabled
 * NIST: SI-4, RA-5
 */
async function checkGuardDutyEnabled(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const url = `https://guardduty.${cfg.region}.amazonaws.com/detector`
  const { data, status } = await awsFetch<{ detectorIds?: string[] }>({
    service: 'guardduty',
    region: cfg.region,
    config: cfg,
    method: 'GET',
    url,
    parseXML: false,
  })

  if (status === 403 || !data) {
    return { checkId: 'aws.guardduty.enabled', title: 'GuardDuty Enabled', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const detectors = (data as { detectorIds?: string[] }).detectorIds ?? []

  return {
    checkId: 'aws.guardduty.enabled',
    title: 'GuardDuty Enabled',
    description: detectors.length > 0 ? `GuardDuty is enabled with ${detectors.length} detector(s).` : 'GuardDuty is not enabled in this region.',
    status: detectors.length > 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: `Region: ${cfg.region}`,
    remediation: 'Enable Amazon GuardDuty for intelligent threat detection and continuous monitoring.',
    evidence: `GuardDuty detectors: ${detectors.length}.`,
    rawData: { detectors },
  }
}

/**
 * 17. aws.guardduty.findings — No unarchived high/critical GuardDuty findings
 * NIST: SI-4, IR-6
 */
async function checkGuardDutyFindings(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  // First get detector IDs
  const { data: detData } = await awsFetch<{ detectorIds?: string[] }>({
    service: 'guardduty',
    region: cfg.region,
    config: cfg,
    method: 'GET',
    url: `https://guardduty.${cfg.region}.amazonaws.com/detector`,
    parseXML: false,
  })

  const detectors = (detData as { detectorIds?: string[] } | null)?.detectorIds ?? []
  if (detectors.length === 0) {
    return { checkId: 'aws.guardduty.findings', title: 'GuardDuty High/Critical Findings', description: 'GuardDuty not enabled.', status: 'skip', severity: 'high' }
  }

  const detectorId = detectors[0]
  const { data: findingsData, status } = await awsFetch<{ findingIds?: string[] }>({
    service: 'guardduty',
    region: cfg.region,
    config: cfg,
    method: 'POST',
    url: `https://guardduty.${cfg.region}.amazonaws.com/detector/${detectorId}/findings`,
    body: JSON.stringify({ findingCriteria: { criterion: { severity: { gte: 7 } } } }),
    extraHeaders: { 'Content-Type': 'application/json' },
    parseXML: false,
  })

  if (status === 403 || !findingsData) {
    return { checkId: 'aws.guardduty.findings', title: 'GuardDuty High/Critical Findings', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const findingIds = (findingsData as { findingIds?: string[] }).findingIds ?? []

  return {
    checkId: 'aws.guardduty.findings',
    title: 'GuardDuty High/Critical Findings',
    description: findingIds.length === 0 ? 'No unarchived high/critical GuardDuty findings.' : `${findingIds.length} unarchived high/critical GuardDuty findings.`,
    status: findingIds.length === 0 ? 'pass' : 'fail',
    severity: findingIds.length > 0 ? 'critical' : 'info',
    resource: `${findingIds.length} findings (severity ≥ 7)`,
    remediation: 'Investigate and remediate all high/critical GuardDuty findings. Archive false positives.',
    evidence: `High/critical findings (severity ≥ 7): ${findingIds.length}.`,
    rawData: { findingCount: findingIds.length },
  }
}

// ── SecurityHub Checks ─────────────────────────────────────────────────────────

/**
 * 18. aws.securityhub.enabled — Security Hub enabled
 * NIST: SI-4, CA-7
 */
async function checkSecurityHubEnabled(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data, status } = await awsFetch<{ HubArn?: string; AutoEnableControls?: boolean }>({
    service: 'securityhub',
    region: cfg.region,
    config: cfg,
    method: 'GET',
    url: `https://securityhub.${cfg.region}.amazonaws.com/accounts`,
    parseXML: false,
  })

  const enabled = status === 200 && data && !!(data as { HubArn?: string }).HubArn

  return {
    checkId: 'aws.securityhub.enabled',
    title: 'AWS Security Hub Enabled',
    description: enabled ? 'AWS Security Hub is enabled in this region.' : 'AWS Security Hub is not enabled.',
    status: enabled ? 'pass' : 'fail',
    severity: 'high',
    resource: `Region: ${cfg.region}`,
    remediation: 'Enable AWS Security Hub for centralized security findings aggregation and compliance scoring.',
    evidence: `Security Hub status: ${enabled ? 'enabled' : 'not enabled'}.`,
    rawData: { enabled },
  }
}

/**
 * 19. aws.securityhub.score — Security Hub compliance score
 * NIST: CA-7, PM-6
 */
async function checkSecurityHubScore(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data, status } = await awsFetch<{ SecurityStandards?: Array<{ StandardsArn: string; StandardsStatus: string }> }>({
    service: 'securityhub',
    region: cfg.region,
    config: cfg,
    method: 'GET',
    url: `https://securityhub.${cfg.region}.amazonaws.com/standards/subscriptions`,
    parseXML: false,
  })

  if (status === 403 || !data) {
    return { checkId: 'aws.securityhub.score', title: 'Security Hub Compliance Score', description: 'Access denied or Security Hub not enabled.', status: 'skip', severity: 'medium' }
  }

  const standards = (data as { SecurityStandards?: Array<{ StandardsArn: string; StandardsStatus: string }> }).SecurityStandards ?? []
  const enabled = standards.filter((s) => s.StandardsStatus === 'READY')

  return {
    checkId: 'aws.securityhub.score',
    title: 'Security Hub Standards Enabled',
    description: enabled.length > 0 ? `${enabled.length} security standards enabled in Security Hub.` : 'No security standards enabled in Security Hub.',
    status: enabled.length >= 2 ? 'pass' : enabled.length === 1 ? 'warn' : 'fail',
    severity: 'medium',
    resource: `${enabled.length} standards enabled`,
    remediation: 'Enable AWS Foundational Security Best Practices and CIS AWS Foundations Benchmark in Security Hub.',
    evidence: `Standards enabled: ${enabled.length}/${standards.length}.`,
    rawData: { enabled: enabled.map((s) => s.StandardsArn) },
  }
}

// ── VPC Checks ─────────────────────────────────────────────────────────────────

async function fetchEC2JSON<T>(cfg: AWSConfig, action: string, params: Record<string, string> = {}): Promise<{ data: T | null; status: number; raw?: string }> {
  const bodyParams = new URLSearchParams({ Action: action, Version: '2016-11-15', ...params })
  return awsFetch<T>({
    service: 'ec2',
    region: cfg.region,
    config: cfg,
    method: 'POST',
    url: `https://ec2.${cfg.region}.amazonaws.com/`,
    body: bodyParams.toString(),
    parseXML: true,
  })
}

/**
 * 20. aws.vpc.flow_logs — VPC flow logs enabled
 * NIST: AU-2, SI-4
 */
async function checkVPCFlowLogs(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await fetchEC2JSON<string>(cfg, 'DescribeVpcs')

  if (status === 403 || !raw) {
    return { checkId: 'aws.vpc.flow_logs', title: 'VPC Flow Logs', description: 'Access denied.', status: 'skip', severity: 'medium' }
  }

  const vpcIds = xmlValues(raw as string, 'vpcId')
  const { data: flRaw } = await fetchEC2JSON<string>(cfg, 'DescribeFlowLogs')
  const flowLogVpcs = flRaw ? xmlValues(flRaw as string, 'resourceId') : []

  const noFlowLogs = vpcIds.filter((v) => !flowLogVpcs.includes(v))

  return {
    checkId: 'aws.vpc.flow_logs',
    title: 'VPC Flow Logs Enabled',
    description: noFlowLogs.length === 0 ? 'All VPCs have flow logs enabled.' : `${noFlowLogs.length} VPCs do not have flow logs enabled.`,
    status: noFlowLogs.length === 0 ? 'pass' : 'fail',
    severity: 'medium',
    resource: noFlowLogs.slice(0, 5).join(', ') || undefined,
    remediation: 'Enable VPC flow logs for all VPCs to capture network traffic metadata.',
    evidence: `VPCs: ${vpcIds.length}. Without flow logs: ${noFlowLogs.length}.`,
    rawData: { vpcCount: vpcIds.length, noFlowLogs },
  }
}

/**
 * 21. aws.vpc.default_sg — Default security group has no rules
 * NIST: CM-7, SC-7
 */
async function checkDefaultSG(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await fetchEC2JSON<string>(cfg, 'DescribeSecurityGroups', {
    'Filter.1.Name': 'group-name',
    'Filter.1.Value.1': 'default',
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.vpc.default_sg', title: 'Default Security Group Rules', description: 'Access denied.', status: 'skip', severity: 'medium' }
  }

  // Check if default SGs have inbound/outbound rules (simplified check)
  const sgBlocks = xmlBlocks(raw as string, 'item')
  const withRules = sgBlocks.filter((block) =>
    block.includes('<ipPermissions>') && block.includes('<item>')
  )

  return {
    checkId: 'aws.vpc.default_sg',
    title: 'Default Security Group Has No Rules',
    description: withRules.length === 0 ? 'Default security groups have no inbound rules (recommended).' : `${withRules.length} default security groups have inbound rules configured.`,
    status: withRules.length === 0 ? 'pass' : 'fail',
    severity: 'medium',
    resource: `${withRules.length} default SGs with rules`,
    remediation: 'Remove all rules from default security groups and use custom security groups for all resources.',
    evidence: `Default SGs found: ${sgBlocks.length}. With inbound rules: ${withRules.length}.`,
    rawData: { defaultSGCount: sgBlocks.length, withRules: withRules.length },
  }
}

/**
 * 22. aws.vpc.no_open_22 — No security groups with 0.0.0.0/0 on port 22
 * NIST: SC-7, CM-7
 */
async function checkNoOpenSSH(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await fetchEC2JSON<string>(cfg, 'DescribeSecurityGroups', {
    'Filter.1.Name': 'ip-permission.from-port',
    'Filter.1.Value.1': '22',
    'Filter.2.Name': 'ip-permission.cidr',
    'Filter.2.Value.1': '0.0.0.0/0',
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.vpc.no_open_22', title: 'No Open SSH (Port 22)', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const sgIds = xmlValues(raw as string, 'groupId')
  const uniqueSGs = [...new Set(sgIds)]

  return {
    checkId: 'aws.vpc.no_open_22',
    title: 'No Security Groups Open to 0.0.0.0/0 on Port 22',
    description: uniqueSGs.length === 0 ? 'No security groups allow unrestricted SSH access (0.0.0.0/0:22).' : `${uniqueSGs.length} security groups allow unrestricted SSH (port 22) from 0.0.0.0/0.`,
    status: uniqueSGs.length === 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: uniqueSGs.slice(0, 5).join(', ') || undefined,
    remediation: 'Restrict SSH access to known IP ranges. Use AWS Systems Manager Session Manager instead of direct SSH.',
    evidence: `Security groups allowing 0.0.0.0/0:22 = ${uniqueSGs.length}.`,
    rawData: { openSshSGs: uniqueSGs },
  }
}

/**
 * 23. aws.vpc.no_open_3389 — No security groups with 0.0.0.0/0 on port 3389
 * NIST: SC-7, CM-7
 */
async function checkNoOpenRDP(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await fetchEC2JSON<string>(cfg, 'DescribeSecurityGroups', {
    'Filter.1.Name': 'ip-permission.from-port',
    'Filter.1.Value.1': '3389',
    'Filter.2.Name': 'ip-permission.cidr',
    'Filter.2.Value.1': '0.0.0.0/0',
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.vpc.no_open_3389', title: 'No Open RDP (Port 3389)', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const sgIds = xmlValues(raw as string, 'groupId')
  const uniqueSGs = [...new Set(sgIds)]

  return {
    checkId: 'aws.vpc.no_open_3389',
    title: 'No Security Groups Open to 0.0.0.0/0 on Port 3389 (RDP)',
    description: uniqueSGs.length === 0 ? 'No security groups allow unrestricted RDP access (0.0.0.0/0:3389).' : `${uniqueSGs.length} security groups allow unrestricted RDP from 0.0.0.0/0.`,
    status: uniqueSGs.length === 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: uniqueSGs.slice(0, 5).join(', ') || undefined,
    remediation: 'Restrict RDP access to known IP ranges. Use AWS Systems Manager Fleet Manager for Windows management.',
    evidence: `Security groups allowing 0.0.0.0/0:3389 = ${uniqueSGs.length}.`,
    rawData: { openRdpSGs: uniqueSGs },
  }
}

// ── EC2 Checks ─────────────────────────────────────────────────────────────────

/**
 * 24. aws.ec2.imdsv2 — All instances using IMDSv2
 * NIST: AC-3, SC-5
 */
async function checkIMDSv2(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await fetchEC2JSON<string>(cfg, 'DescribeInstances', { MaxResults: '100' })

  if (status === 403 || !raw) {
    return { checkId: 'aws.ec2.imdsv2', title: 'EC2 IMDSv2 Enforcement', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const metadataBlocks = xmlBlocks(raw as string, 'metadataOptions')
  const noIMDSv2 = metadataBlocks.filter((block) => !block.includes('<httpTokens>required</httpTokens>'))
  const instanceIds = xmlValues(raw as string, 'instanceId')

  return {
    checkId: 'aws.ec2.imdsv2',
    title: 'EC2 Instances Using IMDSv2',
    description: noIMDSv2.length === 0 ? `All ${instanceIds.length} EC2 instances require IMDSv2.` : `${noIMDSv2.length} EC2 instances do not require IMDSv2.`,
    status: noIMDSv2.length === 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: `${noIMDSv2.length} instances without IMDSv2`,
    remediation: 'Enforce IMDSv2 on all EC2 instances to prevent SSRF-based metadata attacks: ec2 modify-instance-metadata-options --http-tokens required.',
    evidence: `Total instances: ${instanceIds.length}. Without IMDSv2: ${noIMDSv2.length}.`,
    rawData: { instanceCount: instanceIds.length, noIMDSv2Count: noIMDSv2.length },
  }
}

/**
 * 25. aws.ec2.ebs_encryption — EBS default encryption
 * NIST: SC-28, AU-9
 */
async function checkEBSEncryption(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await fetchEC2JSON<string>(cfg, 'GetEbsDefaultKmsKeyId')
  const { data: encRaw, status: encStatus } = await fetchEC2JSON<string>(cfg, 'GetEbsEncryptionByDefault')

  if ((status === 403 && encStatus === 403) || (!raw && !encRaw)) {
    return { checkId: 'aws.ec2.ebs_encryption', title: 'EBS Default Encryption', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const enabled = encRaw ? xmlValue(encRaw as string, 'ebsEncryptionByDefault') === 'true' : false

  return {
    checkId: 'aws.ec2.ebs_encryption',
    title: 'EBS Default Encryption',
    description: enabled ? 'EBS encryption by default is enabled in this region.' : 'EBS encryption by default is NOT enabled in this region.',
    status: enabled ? 'pass' : 'fail',
    severity: 'high',
    resource: `Region: ${cfg.region}`,
    remediation: 'Enable EBS encryption by default: EC2 Console → Settings → EBS encryption → Enable.',
    evidence: `EBS encryption by default: ${enabled ? 'enabled' : 'disabled'}.`,
    rawData: { encryptionByDefault: enabled },
  }
}

/**
 * 26. aws.ec2.ami_public — No public AMIs owned by account
 * NIST: AC-3, SC-7
 */
async function checkPublicAMIs(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await fetchEC2JSON<string>(cfg, 'DescribeImages', {
    'Owner.1': 'self',
    'Filter.1.Name': 'is-public',
    'Filter.1.Value.1': 'true',
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.ec2.ami_public', title: 'Public AMIs', description: 'Access denied.', status: 'skip', severity: 'medium' }
  }

  const amiIds = xmlValues(raw as string, 'imageId')

  return {
    checkId: 'aws.ec2.ami_public',
    title: 'No Public AMIs Owned by Account',
    description: amiIds.length === 0 ? 'No public AMIs owned by this account.' : `${amiIds.length} public AMIs found owned by this account.`,
    status: amiIds.length === 0 ? 'pass' : 'fail',
    severity: 'medium',
    resource: amiIds.slice(0, 5).join(', ') || undefined,
    remediation: 'Make AMIs private unless intentionally sharing. Review all public AMIs for sensitive software/configuration.',
    evidence: `Public AMIs owned by account: ${amiIds.length}.`,
    rawData: { publicAMIs: amiIds },
  }
}

// ── RDS Checks ─────────────────────────────────────────────────────────────────

async function fetchRDSXML<T>(cfg: AWSConfig, action: string, params: Record<string, string> = {}): Promise<{ data: T | null; status: number; raw?: string }> {
  const bodyParams = new URLSearchParams({ Action: action, Version: '2014-10-31', ...params })
  return awsFetch<T>({
    service: 'rds',
    region: cfg.region,
    config: cfg,
    method: 'POST',
    url: `https://rds.${cfg.region}.amazonaws.com/`,
    body: bodyParams.toString(),
    parseXML: true,
  })
}

/**
 * 27. aws.rds.encryption — All RDS instances encrypted
 * NIST: SC-28
 */
async function checkRDSEncryption(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await fetchRDSXML<string>(cfg, 'DescribeDBInstances')

  if (status === 403 || !raw) {
    return { checkId: 'aws.rds.encryption', title: 'RDS Instance Encryption', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const storageEncrypted = xmlValues(raw as string, 'StorageEncrypted')
  const dbIds = xmlValues(raw as string, 'DBInstanceIdentifier')
  const unencrypted = dbIds.filter((_, i) => storageEncrypted[i] !== 'true')

  return {
    checkId: 'aws.rds.encryption',
    title: 'RDS Instance Encryption',
    description: unencrypted.length === 0 ? 'All RDS instances are encrypted at rest.' : `${unencrypted.length} RDS instances are not encrypted.`,
    status: unencrypted.length === 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: unencrypted.slice(0, 5).join(', ') || undefined,
    remediation: 'Enable encryption at rest for RDS instances. For existing unencrypted instances, create an encrypted snapshot and restore.',
    evidence: `RDS instances: ${dbIds.length}. Unencrypted: ${unencrypted.length}.`,
    rawData: { unencrypted, total: dbIds.length },
  }
}

/**
 * 28. aws.rds.backup_retention — Backup retention ≥ 7 days
 * NIST: CP-9, CP-10
 */
async function checkRDSBackupRetention(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await fetchRDSXML<string>(cfg, 'DescribeDBInstances')

  if (status === 403 || !raw) {
    return { checkId: 'aws.rds.backup_retention', title: 'RDS Backup Retention', description: 'Access denied.', status: 'skip', severity: 'medium' }
  }

  const retentions = xmlValues(raw as string, 'BackupRetentionPeriod')
  const dbIds = xmlValues(raw as string, 'DBInstanceIdentifier')
  const lowRetention = dbIds.filter((_, i) => parseInt(retentions[i] ?? '0', 10) < 7)

  return {
    checkId: 'aws.rds.backup_retention',
    title: 'RDS Backup Retention ≥ 7 Days',
    description: lowRetention.length === 0 ? 'All RDS instances have ≥ 7 day backup retention.' : `${lowRetention.length} RDS instances have backup retention < 7 days.`,
    status: lowRetention.length === 0 ? 'pass' : 'fail',
    severity: 'medium',
    resource: lowRetention.slice(0, 5).join(', ') || undefined,
    remediation: 'Set RDS backup retention to at least 7 days for all production instances.',
    evidence: `RDS instances: ${dbIds.length}. Low retention: ${lowRetention.length}.`,
    rawData: { lowRetention, total: dbIds.length },
  }
}

/**
 * 29. aws.rds.public_access — No publicly accessible RDS instances
 * NIST: SC-7, AC-3
 */
async function checkRDSPublicAccess(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await fetchRDSXML<string>(cfg, 'DescribeDBInstances')

  if (status === 403 || !raw) {
    return { checkId: 'aws.rds.public_access', title: 'RDS Public Accessibility', description: 'Access denied.', status: 'skip', severity: 'critical' }
  }

  const publiclyAccessible = xmlValues(raw as string, 'PubliclyAccessible')
  const dbIds = xmlValues(raw as string, 'DBInstanceIdentifier')
  const publicDBs = dbIds.filter((_, i) => publiclyAccessible[i] === 'true')

  return {
    checkId: 'aws.rds.public_access',
    title: 'No Publicly Accessible RDS Instances',
    description: publicDBs.length === 0 ? 'No RDS instances are publicly accessible.' : `${publicDBs.length} RDS instances are publicly accessible.`,
    status: publicDBs.length === 0 ? 'pass' : 'fail',
    severity: 'critical',
    resource: publicDBs.slice(0, 5).join(', ') || undefined,
    remediation: 'Disable public accessibility on all RDS instances. Use VPC private subnets and security groups for access control.',
    evidence: `RDS instances: ${dbIds.length}. Publicly accessible: ${publicDBs.length}.`,
    rawData: { publicDBs, total: dbIds.length },
  }
}

/**
 * 30. aws.rds.multi_az — Production RDS in Multi-AZ
 * NIST: CP-7, CP-10
 */
async function checkRDSMultiAZ(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await fetchRDSXML<string>(cfg, 'DescribeDBInstances')

  if (status === 403 || !raw) {
    return { checkId: 'aws.rds.multi_az', title: 'RDS Multi-AZ Deployment', description: 'Access denied.', status: 'skip', severity: 'medium' }
  }

  const multiAZ = xmlValues(raw as string, 'MultiAZ')
  const dbIds = xmlValues(raw as string, 'DBInstanceIdentifier')
  const singleAZ = dbIds.filter((_, i) => multiAZ[i] !== 'true')

  return {
    checkId: 'aws.rds.multi_az',
    title: 'RDS Multi-AZ Deployment',
    description: singleAZ.length === 0 ? 'All RDS instances are deployed in Multi-AZ.' : `${singleAZ.length} RDS instances are not in Multi-AZ configuration.`,
    status: singleAZ.length === 0 ? 'pass' : 'warn',
    severity: 'medium',
    resource: singleAZ.slice(0, 5).join(', ') || undefined,
    remediation: 'Enable Multi-AZ for production RDS instances to ensure high availability and automatic failover.',
    evidence: `RDS instances: ${dbIds.length}. Single-AZ: ${singleAZ.length}.`,
    rawData: { singleAZ, total: dbIds.length },
  }
}

// ── KMS Checks ─────────────────────────────────────────────────────────────────

/**
 * 31. aws.kms.key_rotation — Customer KMS keys have rotation enabled
 * NIST: SC-12, IA-5
 */
async function checkKMSKeyRotation(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await awsFetch<string>({
    service: 'kms',
    region: cfg.region,
    config: cfg,
    method: 'POST',
    url: `https://kms.${cfg.region}.amazonaws.com/`,
    body: JSON.stringify({ Limit: 100 }),
    extraHeaders: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'TrentService.ListKeys' },
    parseXML: false,
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.kms.key_rotation', title: 'KMS Key Rotation', description: 'Access denied.', status: 'skip', severity: 'medium' }
  }

  let keys: Array<{ KeyId: string; KeyArn: string }> = []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    keys = (parsed as { Keys?: Array<{ KeyId: string; KeyArn: string }> }).Keys ?? []
  } catch {
    keys = []
  }

  const noRotation: string[] = []

  for (const key of keys.slice(0, 20)) {
    const { data: rotData } = await awsFetch<string>({
      service: 'kms',
      region: cfg.region,
      config: cfg,
      method: 'POST',
      url: `https://kms.${cfg.region}.amazonaws.com/`,
      body: JSON.stringify({ KeyId: key.KeyId }),
      extraHeaders: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'TrentService.GetKeyRotationStatus' },
      parseXML: false,
    })
    if (rotData) {
      try {
        const parsed = typeof rotData === 'string' ? JSON.parse(rotData) : rotData
        if (!(parsed as { KeyRotationEnabled?: boolean }).KeyRotationEnabled) {
          noRotation.push(key.KeyId)
        }
      } catch {
        // skip
      }
    }
  }

  return {
    checkId: 'aws.kms.key_rotation',
    title: 'KMS Customer Key Rotation Enabled',
    description: noRotation.length === 0 ? 'All customer KMS keys have automatic rotation enabled.' : `${noRotation.length} customer KMS keys do not have rotation enabled.`,
    status: noRotation.length === 0 ? 'pass' : 'fail',
    severity: 'medium',
    resource: noRotation.slice(0, 3).join(', ') || undefined,
    remediation: 'Enable automatic key rotation on all customer-managed KMS keys: KMS Console → Customer managed keys → Enable key rotation.',
    evidence: `Checked ${keys.length} keys. Without rotation: ${noRotation.length}.`,
    rawData: { noRotation, total: keys.length },
  }
}

// ── CloudWatch Checks ──────────────────────────────────────────────────────────

async function fetchCWJSON<T>(cfg: AWSConfig, target: string, bodyObj: Record<string, unknown>): Promise<{ data: T | null; status: number }> {
  return awsFetch<T>({
    service: 'monitoring',
    region: cfg.region,
    config: cfg,
    method: 'POST',
    url: `https://monitoring.${cfg.region}.amazonaws.com/`,
    body: JSON.stringify(bodyObj),
    extraHeaders: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': target },
    parseXML: false,
  })
}

async function fetchLogsJSON<T>(cfg: AWSConfig, target: string, bodyObj: Record<string, unknown>): Promise<{ data: T | null; status: number }> {
  return awsFetch<T>({
    service: 'logs',
    region: cfg.region,
    config: cfg,
    method: 'POST',
    url: `https://logs.${cfg.region}.amazonaws.com/`,
    body: JSON.stringify(bodyObj),
    extraHeaders: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': target },
    parseXML: false,
  })
}

/**
 * Helper: Check if a CloudWatch alarm exists for a metric filter pattern
 */
async function checkAlarmExists(
  cfg: AWSConfig,
  checkId: string,
  title: string,
  pattern: string,
  nistControl: string,
): Promise<IntegrationCheckResult> {
  const { data, status } = await fetchLogsJSON<{ metricFilters?: Array<{ filterPattern?: string; metricTransformations?: Array<{ metricName: string; metricNamespace: string }> }> }>(
    cfg,
    'Logs_20140328.DescribeMetricFilters',
    { limit: 50 },
  )

  if (status === 403 || !data) {
    return { checkId, title, description: 'Access denied — CloudWatch Logs permissions required.', status: 'skip', severity: 'medium' }
  }

  const filters = (data as { metricFilters?: Array<{ filterPattern?: string; metricTransformations?: Array<{ metricName: string }> }> }).metricFilters ?? []
  const matchingFilter = filters.find((f) =>
    f.filterPattern && f.filterPattern.toLowerCase().includes(pattern.toLowerCase())
  )

  return {
    checkId,
    title,
    description: matchingFilter ? `CloudWatch metric filter and alarm found for: ${title}.` : `No CloudWatch metric filter found matching "${pattern}". Recommended alarm may be missing.`,
    status: matchingFilter ? 'pass' : 'warn',
    severity: 'medium',
    resource: matchingFilter ? matchingFilter.metricTransformations?.[0]?.metricName : undefined,
    remediation: `Create a CloudWatch metric filter and alarm for: ${pattern}. See CIS AWS Foundations Benchmark for exact filter patterns. NIST: ${nistControl}`,
    evidence: `Metric filters checked: ${filters.length}. Pattern "${pattern}" match: ${!!matchingFilter}.`,
    rawData: { filterCount: filters.length, matched: !!matchingFilter },
  }
}

/**
 * 32. aws.cloudwatch.log_metric_root_usage
 * NIST: AC-2(4), AU-2
 */
async function checkAlarmRootUsage(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  return checkAlarmExists(cfg, 'aws.cloudwatch.log_metric_root_usage', 'Alarm for Root Account Usage', 'Root', 'AC-2(4), AU-2')
}

/**
 * 33. aws.cloudwatch.log_metric_console_without_mfa
 * NIST: IA-2(1), AU-2
 */
async function checkAlarmConsoleNoMFA(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  return checkAlarmExists(cfg, 'aws.cloudwatch.log_metric_console_without_mfa', 'Alarm for Console Sign-in Without MFA', 'ConsoleLogin', 'IA-2(1), AU-2')
}

/**
 * 34. aws.cloudwatch.log_metric_iam_changes
 * NIST: AC-2, CM-3
 */
async function checkAlarmIAMChanges(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  return checkAlarmExists(cfg, 'aws.cloudwatch.log_metric_iam_changes', 'Alarm for IAM Policy Changes', 'PutUserPolicy', 'AC-2, CM-3')
}

// ── ACM Checks ─────────────────────────────────────────────────────────────────

/**
 * 35. aws.acm.expiring_certs — No ACM certs expiring within 30 days
 * NIST: SC-17, IA-3
 */
async function checkACMExpiringCerts(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data, status } = await awsFetch<{ CertificateSummaryList?: Array<{ CertificateArn: string; DomainName: string }> }>({
    service: 'acm',
    region: cfg.region,
    config: cfg,
    method: 'POST',
    url: `https://acm.${cfg.region}.amazonaws.com/`,
    body: JSON.stringify({ CertificateStatuses: ['ISSUED'] }),
    extraHeaders: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'CertificateManager.ListCertificates' },
    parseXML: false,
  })

  if (status === 403 || !data) {
    return { checkId: 'aws.acm.expiring_certs', title: 'ACM Expiring Certificates', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const certs = (data as { CertificateSummaryList?: Array<{ CertificateArn: string; DomainName: string }> }).CertificateSummaryList ?? []
  const thirtyDays = new Date()
  thirtyDays.setDate(thirtyDays.getDate() + 30)
  const expiring: string[] = []

  for (const cert of certs.slice(0, 20)) {
    const { data: detail } = await awsFetch<{ Certificate?: { NotAfter?: string; DomainName?: string } }>({
      service: 'acm',
      region: cfg.region,
      config: cfg,
      method: 'POST',
      url: `https://acm.${cfg.region}.amazonaws.com/`,
      body: JSON.stringify({ CertificateArn: cert.CertificateArn }),
      extraHeaders: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'CertificateManager.DescribeCertificate' },
      parseXML: false,
    })
    if (detail) {
      const d = (detail as { Certificate?: { NotAfter?: string; DomainName?: string } }).Certificate
      if (d?.NotAfter && new Date(d.NotAfter) < thirtyDays) {
        expiring.push(d.DomainName ?? cert.CertificateArn)
      }
    }
  }

  return {
    checkId: 'aws.acm.expiring_certs',
    title: 'ACM Certificates Expiring Within 30 Days',
    description: expiring.length === 0 ? 'No ACM certificates expiring within 30 days.' : `${expiring.length} ACM certificates expire within 30 days.`,
    status: expiring.length === 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: expiring.slice(0, 5).join(', ') || undefined,
    remediation: 'Renew ACM certificates or enable auto-renewal for certificates managed by ACM.',
    evidence: `Total ISSUED certs: ${certs.length}. Expiring within 30 days: ${expiring.length}.`,
    rawData: { expiring, total: certs.length },
  }
}

// ── Route53 Checks ─────────────────────────────────────────────────────────────

/**
 * 36. aws.route53.dnssec — DNSSEC enabled for public hosted zones
 * NIST: SC-20, SC-21
 */
async function checkRoute53DNSSEC(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data: raw, status } = await awsFetch<string>({
    service: 'route53',
    region: 'us-east-1',
    config: cfg,
    method: 'GET',
    url: 'https://route53.amazonaws.com/2013-04-01/hostedzone',
    parseXML: true,
  })

  if (status === 403 || !raw) {
    return { checkId: 'aws.route53.dnssec', title: 'Route53 DNSSEC', description: 'Access denied.', status: 'skip', severity: 'medium' }
  }

  const zoneIds = xmlValues(raw as string, 'Id').map((id) => id.replace('/hostedzone/', ''))
  const privateZone = xmlValues(raw as string, 'PrivateZone')
  const publicZoneIds = zoneIds.filter((_, i) => privateZone[i] !== 'true')

  const noDNSSEC: string[] = []

  for (const zoneId of publicZoneIds.slice(0, 10)) {
    const { data: dsData, status: dsStatus } = await awsFetch<string>({
      service: 'route53',
      region: 'us-east-1',
      config: cfg,
      method: 'GET',
      url: `https://route53.amazonaws.com/2013-04-01/hostedzone/${zoneId}/dnssec`,
      parseXML: true,
    })
    if (dsStatus === 404 || !dsData || xmlValue(dsData as string, 'Status') !== 'SIGNING') {
      noDNSSEC.push(zoneId)
    }
  }

  return {
    checkId: 'aws.route53.dnssec',
    title: 'Route53 DNSSEC Enabled',
    description: noDNSSEC.length === 0 ? 'All public hosted zones have DNSSEC enabled.' : `${noDNSSEC.length} public hosted zones do not have DNSSEC enabled.`,
    status: noDNSSEC.length === 0 ? 'pass' : 'warn',
    severity: 'medium',
    resource: `${noDNSSEC.length} zones without DNSSEC`,
    remediation: 'Enable DNSSEC signing for public hosted zones in Route53 to prevent DNS spoofing attacks.',
    evidence: `Public zones: ${publicZoneIds.length}. Without DNSSEC: ${noDNSSEC.length}.`,
    rawData: { noDNSSEC, publicZones: publicZoneIds.length },
  }
}

// ── EKS Checks ─────────────────────────────────────────────────────────────────

async function fetchEKSJSON<T>(cfg: AWSConfig, path: string): Promise<{ data: T | null; status: number }> {
  return awsFetch<T>({
    service: 'eks',
    region: cfg.region,
    config: cfg,
    method: 'GET',
    url: `https://eks.${cfg.region}.amazonaws.com${path}`,
    parseXML: false,
  })
}

/**
 * 37. aws.eks.cluster_logging — EKS control plane logging
 * NIST: AU-2, AU-12
 */
async function checkEKSLogging(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data, status } = await fetchEKSJSON<{ clusters?: string[] }>(cfg, '/clusters')

  if (status === 403 || !data) {
    return { checkId: 'aws.eks.cluster_logging', title: 'EKS Control Plane Logging', description: 'Access denied or EKS not in use.', status: 'skip', severity: 'medium' }
  }

  const clusters = (data as { clusters?: string[] }).clusters ?? []
  if (clusters.length === 0) {
    return { checkId: 'aws.eks.cluster_logging', title: 'EKS Control Plane Logging', description: 'No EKS clusters found in this region.', status: 'skip', severity: 'medium' }
  }

  const noLogging: string[] = []

  for (const cluster of clusters.slice(0, 10)) {
    const { data: detail } = await fetchEKSJSON<{ cluster?: { logging?: { clusterLogging?: Array<{ types?: string[]; enabled?: boolean }> } } }>(cfg, `/clusters/${cluster}`)
    const logging = (detail as { cluster?: { logging?: { clusterLogging?: Array<{ types?: string[]; enabled?: boolean }> } } } | null)?.cluster?.logging?.clusterLogging ?? []
    const hasLogging = logging.some((l) => l.enabled && l.types && l.types.length > 0)
    if (!hasLogging) noLogging.push(cluster)
  }

  return {
    checkId: 'aws.eks.cluster_logging',
    title: 'EKS Control Plane Logging',
    description: noLogging.length === 0 ? 'All EKS clusters have control plane logging enabled.' : `${noLogging.length} EKS clusters do not have control plane logging enabled.`,
    status: noLogging.length === 0 ? 'pass' : 'fail',
    severity: 'medium',
    resource: noLogging.slice(0, 5).join(', ') || undefined,
    remediation: 'Enable EKS control plane logging (api, audit, authenticator, controllerManager, scheduler) for all clusters.',
    evidence: `EKS clusters: ${clusters.length}. Without logging: ${noLogging.length}.`,
    rawData: { noLogging, total: clusters.length },
  }
}

/**
 * 38. aws.eks.public_endpoint_restricted — Public API endpoint has IP restrictions
 * NIST: SC-7, AC-17
 */
async function checkEKSPublicEndpoint(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data, status } = await fetchEKSJSON<{ clusters?: string[] }>(cfg, '/clusters')

  if (status === 403 || !data) {
    return { checkId: 'aws.eks.public_endpoint_restricted', title: 'EKS Public Endpoint Restrictions', description: 'Access denied or EKS not in use.', status: 'skip', severity: 'high' }
  }

  const clusters = (data as { clusters?: string[] }).clusters ?? []
  if (clusters.length === 0) {
    return { checkId: 'aws.eks.public_endpoint_restricted', title: 'EKS Public Endpoint Restrictions', description: 'No EKS clusters found.', status: 'skip', severity: 'high' }
  }

  const unrestricted: string[] = []

  for (const cluster of clusters.slice(0, 10)) {
    const { data: detail } = await fetchEKSJSON<{ cluster?: { resourcesVpcConfig?: { endpointPublicAccess?: boolean; publicAccessCidrs?: string[] } } }>(cfg, `/clusters/${cluster}`)
    const vpc = (detail as { cluster?: { resourcesVpcConfig?: { endpointPublicAccess?: boolean; publicAccessCidrs?: string[] } } } | null)?.cluster?.resourcesVpcConfig
    if (vpc?.endpointPublicAccess) {
      const cidrs = vpc.publicAccessCidrs ?? []
      const isUnrestricted = cidrs.length === 0 || cidrs.includes('0.0.0.0/0')
      if (isUnrestricted) unrestricted.push(cluster)
    }
  }

  return {
    checkId: 'aws.eks.public_endpoint_restricted',
    title: 'EKS Public API Endpoint Restricted',
    description: unrestricted.length === 0 ? 'All EKS public endpoints have IP restrictions configured.' : `${unrestricted.length} EKS clusters have unrestricted public API endpoints.`,
    status: unrestricted.length === 0 ? 'pass' : 'fail',
    severity: 'high',
    resource: unrestricted.slice(0, 5).join(', ') || undefined,
    remediation: 'Restrict EKS public endpoint to known CIDR blocks or disable public access entirely and use private endpoint.',
    evidence: `Clusters with unrestricted public endpoint: ${unrestricted.length}/${clusters.length}.`,
    rawData: { unrestricted, total: clusters.length },
  }
}

// ── Lambda Checks ──────────────────────────────────────────────────────────────

const SUSPICIOUS_ENV_KEYS = [
  'secret', 'password', 'passwd', 'pwd', 'api_key', 'apikey', 'token',
  'aws_secret', 'private_key', 'auth_key', 'credential',
]

/**
 * 39. aws.lambda.env_var_secrets — Lambda env vars don't contain obvious secrets
 * NIST: IA-5, SC-28
 */
async function checkLambdaEnvSecrets(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data, status } = await awsFetch<{ Functions?: Array<{ FunctionName: string; Environment?: { Variables?: Record<string, string> } }> }>({
    service: 'lambda',
    region: cfg.region,
    config: cfg,
    method: 'GET',
    url: `https://lambda.${cfg.region}.amazonaws.com/2015-03-31/functions?MaxItems=50`,
    parseXML: false,
  })

  if (status === 403 || !data) {
    return { checkId: 'aws.lambda.env_var_secrets', title: 'Lambda Environment Variable Secrets', description: 'Access denied.', status: 'skip', severity: 'high' }
  }

  const functions = (data as { Functions?: Array<{ FunctionName: string; Environment?: { Variables?: Record<string, string> } }> }).Functions ?? []
  const withSuspiciousKeys: string[] = []

  for (const fn of functions) {
    const envVars = fn.Environment?.Variables ?? {}
    const suspiciousKeys = Object.keys(envVars).filter((k) =>
      SUSPICIOUS_ENV_KEYS.some((s) => k.toLowerCase().includes(s))
    )
    if (suspiciousKeys.length > 0) {
      withSuspiciousKeys.push(`${fn.FunctionName} (keys: ${suspiciousKeys.join(', ')})`)
    }
  }

  return {
    checkId: 'aws.lambda.env_var_secrets',
    title: 'Lambda Env Vars Without Plaintext Secrets',
    description: withSuspiciousKeys.length === 0 ? 'No Lambda functions found with suspicious plaintext secret env var names.' : `${withSuspiciousKeys.length} Lambda functions have env vars with secret-like names.`,
    status: withSuspiciousKeys.length === 0 ? 'pass' : 'warn',
    severity: 'high',
    resource: withSuspiciousKeys.slice(0, 3).join('; ') || undefined,
    remediation: 'Move Lambda secrets to AWS Secrets Manager or SSM Parameter Store. Reference via dynamic references instead of plaintext env vars.',
    evidence: `Checked ${functions.length} functions. Suspicious env var names: ${withSuspiciousKeys.length}.`,
    rawData: { withSuspiciousKeys, total: functions.length },
  }
}

/**
 * 40. aws.lambda.reserved_concurrency — Functions have reserved concurrency
 * NIST: SC-5, CP-2
 */
async function checkLambdaReservedConcurrency(cfg: AWSConfig): Promise<IntegrationCheckResult> {
  const { data, status } = await awsFetch<{ Functions?: Array<{ FunctionName: string }> }>({
    service: 'lambda',
    region: cfg.region,
    config: cfg,
    method: 'GET',
    url: `https://lambda.${cfg.region}.amazonaws.com/2015-03-31/functions?MaxItems=50`,
    parseXML: false,
  })

  if (status === 403 || !data) {
    return { checkId: 'aws.lambda.reserved_concurrency', title: 'Lambda Reserved Concurrency', description: 'Access denied.', status: 'skip', severity: 'low' }
  }

  const functions = (data as { Functions?: Array<{ FunctionName: string }> }).Functions ?? []
  const noConcurrency: string[] = []

  for (const fn of functions.slice(0, 20)) {
    const { data: concData, status: concStatus } = await awsFetch<{ ReservedConcurrentExecutions?: number }>({
      service: 'lambda',
      region: cfg.region,
      config: cfg,
      method: 'GET',
      url: `https://lambda.${cfg.region}.amazonaws.com/2015-03-31/functions/${fn.FunctionName}/concurrency`,
      parseXML: false,
    })
    if (concStatus === 404 || !concData || (concData as { ReservedConcurrentExecutions?: number }).ReservedConcurrentExecutions === undefined) {
      noConcurrency.push(fn.FunctionName)
    }
  }

  return {
    checkId: 'aws.lambda.reserved_concurrency',
    title: 'Lambda Reserved Concurrency Set',
    description: noConcurrency.length === 0 ? 'All Lambda functions have reserved concurrency configured.' : `${noConcurrency.length} Lambda functions do not have reserved concurrency set.`,
    status: noConcurrency.length === 0 ? 'pass' : 'warn',
    severity: 'low',
    resource: noConcurrency.slice(0, 5).join(', ') || undefined,
    remediation: 'Set reserved concurrency on Lambda functions to prevent resource exhaustion and ensure throttling behavior is predictable.',
    evidence: `Checked ${functions.length} functions. Without reserved concurrency: ${noConcurrency.length}.`,
    rawData: { noConcurrency, total: functions.length },
  }
}

// ── Main runner ────────────────────────────────────────────────────────────────

/**
 * Run all AWS security checks (40 total).
 * Gracefully handles AccessDenied and service-not-enabled errors.
 */
export async function runAWSChecks(config: AWSConfig): Promise<IntegrationCheckResult[]> {
  const checks = [
    // IAM
    checkIAMMFARoot,
    checkAccessKeyRotation,
    checkUnusedCredentials,
    checkPasswordPolicy,
    checkSupportRole,
    checkRootAccessKeys,
    // S3
    checkS3PublicAccessBlock,
    checkS3BucketEncryption,
    checkS3Versioning,
    checkS3Logging,
    // CloudTrail
    checkCloudTrailEnabled,
    checkCloudTrailLogValidation,
    checkCloudTrailS3,
    // Config
    checkAWSConfigEnabled,
    checkAWSConfigRules,
    // GuardDuty
    checkGuardDutyEnabled,
    checkGuardDutyFindings,
    // SecurityHub
    checkSecurityHubEnabled,
    checkSecurityHubScore,
    // VPC
    checkVPCFlowLogs,
    checkDefaultSG,
    checkNoOpenSSH,
    checkNoOpenRDP,
    // EC2
    checkIMDSv2,
    checkEBSEncryption,
    checkPublicAMIs,
    // RDS
    checkRDSEncryption,
    checkRDSBackupRetention,
    checkRDSPublicAccess,
    checkRDSMultiAZ,
    // KMS
    checkKMSKeyRotation,
    // CloudWatch
    checkAlarmRootUsage,
    checkAlarmConsoleNoMFA,
    checkAlarmIAMChanges,
    // ACM
    checkACMExpiringCerts,
    // Route53
    checkRoute53DNSSEC,
    // EKS
    checkEKSLogging,
    checkEKSPublicEndpoint,
    // Lambda
    checkLambdaEnvSecrets,
    checkLambdaReservedConcurrency,
  ]

  const results = await Promise.allSettled(checks.map((check) => check(config)))

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return {
      checkId: `aws.check_${i}`,
      title: `AWS Check ${i + 1}`,
      description: `Check failed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
      status: 'skip' as const,
      severity: 'info' as const,
    }
  })
}

/**
 * Test AWS credentials using STS GetCallerIdentity.
 * Returns { accountId, userId, arn } on success, throws on failure.
 */
export async function testAWSCredentials(config: AWSConfig): Promise<{ accountId: string; userId: string; arn: string }> {
  const { data: raw, status, error } = await awsFetch<string>({
    service: 'sts',
    region: config.region,
    config,
    method: 'POST',
    url: 'https://sts.amazonaws.com/',
    body: 'Action=GetCallerIdentity&Version=2011-06-15',
    parseXML: true,
  })

  if (status === 403 || !raw) {
    throw new Error(error ?? 'Authentication failed')
  }

  const xml = raw as string
  return {
    accountId: xmlValue(xml, 'Account') ?? 'unknown',
    userId: xmlValue(xml, 'UserId') ?? 'unknown',
    arn: xmlValue(xml, 'Arn') ?? 'unknown',
  }
}
