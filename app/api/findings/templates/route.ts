import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findingTemplates } from '@/lib/db/schema'
import { eq, or, isNull } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

const BUILT_IN_TEMPLATES = [
  {
    id: 'builtin-1',
    title: 'SQL Injection',
    description: 'User-supplied input is incorporated into database queries without proper sanitization, allowing attackers to manipulate query logic and access, modify, or delete arbitrary data.',
    severity: 'critical' as const,
    source: 'pentest' as const,
    remediationGuidance: 'Use parameterized queries or prepared statements. Implement input validation and output encoding. Apply the principle of least privilege to database accounts. Consider using an ORM. Deploy a Web Application Firewall (WAF).',
    isBuiltIn: true,
    organizationId: null,
  },
  {
    id: 'builtin-2',
    title: 'Cross-Site Scripting (XSS)',
    description: 'The application includes unvalidated user-controlled data in web pages rendered by browsers, enabling attackers to inject and execute arbitrary JavaScript in victim browsers.',
    severity: 'high' as const,
    source: 'pentest' as const,
    remediationGuidance: 'Encode all user-controlled output using context-appropriate encoding. Implement Content Security Policy (CSP) headers. Use frameworks that auto-escape by default. Validate and sanitize all inputs on the server side.',
    isBuiltIn: true,
    organizationId: null,
  },
  {
    id: 'builtin-3',
    title: 'Insecure Direct Object Reference',
    description: 'The application exposes internal object references (IDs, filenames) without proper authorization checks, allowing attackers to access or modify resources belonging to other users.',
    severity: 'high' as const,
    source: 'pentest' as const,
    remediationGuidance: 'Implement proper authorization checks for every object access. Use indirect reference maps or session-specific tokens. Ensure server-side authorization is enforced on all requests regardless of client-side controls.',
    isBuiltIn: true,
    organizationId: null,
  },
  {
    id: 'builtin-4',
    title: 'Missing Multi-Factor Authentication',
    description: 'Privileged accounts or sensitive systems do not require multi-factor authentication, increasing the risk of unauthorized access through credential compromise.',
    severity: 'high' as const,
    source: 'manual' as const,
    remediationGuidance: 'Enforce MFA on all privileged accounts and externally accessible systems. Use TOTP, hardware tokens, or push-based authentication. Implement adaptive MFA policies based on risk signals.',
    isBuiltIn: true,
    organizationId: null,
  },
  {
    id: 'builtin-5',
    title: 'Weak TLS/SSL Configuration',
    description: 'The server supports outdated or weak cipher suites, deprecated protocol versions (SSLv3, TLS 1.0/1.1), or insecure key exchange algorithms that expose encrypted communications to attack.',
    severity: 'medium' as const,
    source: 'pentest' as const,
    remediationGuidance: 'Disable SSLv2, SSLv3, TLS 1.0, and TLS 1.1. Configure only strong cipher suites (TLS_AES_256_GCM_SHA384, ECDHE variants). Enable HSTS with long max-age. Use certificates with at least 2048-bit RSA or P-256 ECC keys.',
    isBuiltIn: true,
    organizationId: null,
  },
  {
    id: 'builtin-6',
    title: 'Unnecessary Open Ports',
    description: 'Network-accessible services are running on ports not required for business operations, unnecessarily expanding the attack surface.',
    severity: 'medium' as const,
    source: 'pentest' as const,
    remediationGuidance: 'Conduct a port audit and disable or restrict all services not required for business purposes. Implement host-based and network-based firewalls with deny-by-default rules. Regularly scan for open ports and review any changes.',
    isBuiltIn: true,
    organizationId: null,
  },
  {
    id: 'builtin-7',
    title: 'Missing Security Patches',
    description: 'Operating systems, frameworks, or third-party dependencies are running outdated versions with known security vulnerabilities that have available patches.',
    severity: 'high' as const,
    source: 'manual' as const,
    remediationGuidance: 'Establish a patch management program with defined SLAs by severity. Subscribe to security advisories for all software in use. Automate patch deployment where possible. Track vulnerability exposure windows and prioritize critical/high patches.',
    isBuiltIn: true,
    organizationId: null,
  },
  {
    id: 'builtin-8',
    title: 'Default Credentials in Use',
    description: 'Systems, devices, or applications are accessible using default manufacturer or vendor credentials that have not been changed, allowing trivial unauthorized access.',
    severity: 'critical' as const,
    source: 'pentest' as const,
    remediationGuidance: 'Immediately change all default credentials on all systems. Implement a credential inventory and rotation policy. Use a password manager or secrets management solution. Enforce strong, unique passwords and MFA on all accounts.',
    isBuiltIn: true,
    organizationId: null,
  },
]

/**
 * GET /api/findings/templates
 * Returns built-in templates merged with org custom templates.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.VIEW_FINDINGS)) return ApiErrors.forbidden()

  // Get custom templates for this org
  let customTemplates: typeof findingTemplates.$inferSelect[] = []
  if (session.orgId) {
    customTemplates = await db
      .select()
      .from(findingTemplates)
      .where(eq(findingTemplates.organizationId, session.orgId))
      .limit(100)
  }

  const allTemplates = [
    ...BUILT_IN_TEMPLATES,
    ...customTemplates.map((t) => ({ ...t, isBuiltIn: false })),
  ]

  return NextResponse.json({ templates: allTemplates, total: allTemplates.length })
}

const createTemplateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).default('medium'),
  source: z.enum(['aws', 'azure', 'gcp', 'github', 'pentest', 'manual', 'nl_test', 'integration']).default('manual'),
  remediationGuidance: z.string().optional(),
})

/**
 * POST /api/findings/templates
 * Create a custom finding template.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.CREATE_FINDINGS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON body') }

  const result = createTemplateSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const data = result.data

  const [template] = await db.insert(findingTemplates).values({
    organizationId: session.orgId,
    title: data.title,
    description: data.description,
    severity: data.severity,
    source: data.source,
    remediationGuidance: data.remediationGuidance,
    isBuiltIn: false,
  }).returning()

  return NextResponse.json({ template }, { status: 201 })
}
