/**
 * lib/integrations/nl-tests.ts
 * Natural Language test execution engine.
 * Parses plain-English queries, runs the appropriate network/security check,
 * and returns a structured pass/fail result.
 */

import * as net from 'net'
import { db } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { decrypt } from '@/lib/encryption'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NLTestResult {
  passed: boolean
  output: string
  rawData?: unknown
  duration: number // ms
  error?: string
}

export type NLTestType =
  | 'ssl_check'
  | 'port_scan'
  | 'http_check'
  | 'dns_check'
  | 'header_check'
  | 'certificate_expiry'
  | 'redirect_check'
  | 'tls_version'
  | 'cors_check'
  | 'response_code'
  | 'ai_custom'

// ─── Query Parser ─────────────────────────────────────────────────────────────

const DOMAIN_REGEX = /([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/
const URL_REGEX = /https?:\/\/[^\s]+/
const PORT_REGEX = /port\s+(\d+)/i
const IP_REGEX = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/

function extractUrl(query: string): string {
  const urlMatch = query.match(URL_REGEX)
  if (urlMatch) return urlMatch[0]
  const domainMatch = query.match(DOMAIN_REGEX)
  if (domainMatch) return domainMatch[0]
  return ''
}

function extractDomain(target: string): string {
  try {
    if (target.startsWith('http')) return new URL(target).hostname
  } catch { /* ignore */ }
  return target
}

function extractPort(query: string): number {
  const portMatch = query.match(PORT_REGEX)
  if (portMatch) return parseInt(portMatch[1], 10)
  return 0
}

function extractHost(query: string): string {
  const ipMatch = query.match(IP_REGEX)
  if (ipMatch) return ipMatch[1]
  const urlMatch = query.match(URL_REGEX)
  if (urlMatch) {
    try { return new URL(urlMatch[0]).hostname } catch { /* ignore */ }
  }
  const domainMatch = query.match(DOMAIN_REGEX)
  if (domainMatch) return domainMatch[0]
  return ''
}

export async function parseNLTestQuery(query: string): Promise<{
  type: NLTestType
  target: string
  params: Record<string, string>
}> {
  const q = query.toLowerCase()

  // Port scan
  if (PORT_REGEX.test(q) && (q.includes('open') || q.includes('closed') || q.includes('scan') || q.includes('check'))) {
    const port = extractPort(query)
    const host = extractHost(query)
    return { type: 'port_scan', target: host, params: { port: String(port) } }
  }

  // Certificate expiry
  if (
    (q.includes('cert') || q.includes('certificate')) &&
    (q.includes('expir') || q.includes('valid') || q.includes('renew'))
  ) {
    const target = extractUrl(query) || extractHost(query)
    return { type: 'certificate_expiry', target, params: {} }
  }

  // TLS version
  if (q.includes('tls') && (q.includes('version') || q.includes('1.2') || q.includes('1.3'))) {
    const target = extractUrl(query) || extractHost(query)
    return { type: 'tls_version', target, params: {} }
  }

  // Security headers
  if (
    q.includes('header') &&
    (q.includes('security') || q.includes('hsts') || q.includes('csp') || q.includes('verify') || q.includes('check'))
  ) {
    const target = extractUrl(query) || extractHost(query)
    return { type: 'header_check', target, params: {} }
  }

  // DNS checks (DMARC / SPF / DKIM)
  if (q.includes('dmarc') || q.includes('spf') || q.includes('dkim') || (q.includes('dns') && q.includes('check'))) {
    const target = extractDomain(extractUrl(query) || extractHost(query))
    return { type: 'dns_check', target, params: {} }
  }

  // CORS check
  if (q.includes('cors')) {
    const target = extractUrl(query) || extractHost(query)
    return { type: 'cors_check', target, params: {} }
  }

  // Redirect check (http → https)
  if (
    (q.includes('redirect') || q.includes('redirects')) &&
    (q.includes('https') || q.includes('http'))
  ) {
    const target = extractDomain(extractUrl(query) || extractHost(query))
    return { type: 'redirect_check', target, params: {} }
  }

  // SSL check
  if (q.includes('ssl') || (q.includes('https') && q.includes('check'))) {
    const target = extractDomain(extractUrl(query) || extractHost(query))
    return { type: 'ssl_check', target, params: {} }
  }

  // HTTP response code
  if (
    q.includes('return') ||
    q.includes('status') ||
    q.includes('200') ||
    q.includes('response code')
  ) {
    const target = extractUrl(query) || extractHost(query)
    const code = query.match(/\b(2\d{2}|3\d{2}|4\d{2}|5\d{2})\b/)?.[1] ?? '200'
    return { type: 'response_code', target, params: { expectedCode: code } }
  }

  // HTTP check (HTTPS verify)
  if (q.includes('http') || q.includes('verify')) {
    const target = extractDomain(extractUrl(query) || extractHost(query))
    return { type: 'http_check', target, params: {} }
  }

  // Fallback to AI
  const target = extractUrl(query) || extractHost(query)
  return { type: 'ai_custom', target, params: {} }
}

// ─── Individual Test Runners ──────────────────────────────────────────────────

async function runSslCheck(domain: string): Promise<NLTestResult> {
  const start = Date.now()
  try {
    const url = domain.startsWith('http') ? domain : `https://${domain}`
    const res = await fetch(url, { method: 'HEAD' })
    const duration = Date.now() - start
    if (res.ok || res.status < 500) {
      return {
        passed: true,
        output: `SSL certificate is valid for ${domain}. HTTPS request succeeded with status ${res.status}.`,
        rawData: { status: res.status, url },
        duration,
      }
    }
    return {
      passed: false,
      output: `HTTPS request to ${domain} returned status ${res.status}.`,
      rawData: { status: res.status, url },
      duration,
    }
  } catch (err) {
    return {
      passed: false,
      output: `SSL check failed for ${domain}: ${err instanceof Error ? err.message : String(err)}`,
      duration: Date.now() - start,
      error: String(err),
    }
  }
}

async function runPortScan(host: string, port: number): Promise<NLTestResult> {
  const start = Date.now()
  const SENSITIVE_PORTS = [22, 23, 3389, 5900, 1433, 3306, 5432, 6379, 27017]
  const isSensitive = SENSITIVE_PORTS.includes(port)

  const isOpen = await new Promise<boolean>((resolve) => {
    const s = new net.Socket()
    s.setTimeout(3000)
    s.connect(port, host, () => {
      s.destroy()
      resolve(true)
    })
    s.on('error', () => resolve(false))
    s.on('timeout', () => { s.destroy(); resolve(false) })
  })

  const duration = Date.now() - start

  if (isSensitive && isOpen) {
    return {
      passed: false,
      output: `Port ${port} on ${host} is OPEN. This is a sensitive port that should be closed or firewalled.`,
      rawData: { host, port, open: true, sensitive: true },
      duration,
    }
  }

  if (isSensitive && !isOpen) {
    return {
      passed: true,
      output: `Port ${port} on ${host} is CLOSED/filtered. Sensitive port is properly secured.`,
      rawData: { host, port, open: false, sensitive: true },
      duration,
    }
  }

  // Non-sensitive port
  return {
    passed: isOpen,
    output: `Port ${port} on ${host} is ${isOpen ? 'OPEN' : 'CLOSED/filtered'}.`,
    rawData: { host, port, open: isOpen },
    duration,
  }
}

async function runHttpCheck(domain: string): Promise<NLTestResult> {
  const start = Date.now()
  try {
    const url = `http://${domain}`
    const res = await fetch(url, { redirect: 'follow' })
    const duration = Date.now() - start
    const finalUrl = res.url
    const redirectedToHttps = finalUrl.startsWith('https://')
    return {
      passed: redirectedToHttps,
      output: redirectedToHttps
        ? `HTTP to HTTPS redirect is working. Final URL: ${finalUrl}`
        : `No HTTPS redirect detected. Final URL: ${finalUrl}`,
      rawData: { url, finalUrl, redirected: res.redirected, status: res.status },
      duration,
    }
  } catch (err) {
    return {
      passed: false,
      output: `HTTP check failed for ${domain}: ${err instanceof Error ? err.message : String(err)}`,
      duration: Date.now() - start,
      error: String(err),
    }
  }
}

async function runRedirectCheck(domain: string): Promise<NLTestResult> {
  return runHttpCheck(domain)
}

async function runDnsCheck(domain: string): Promise<NLTestResult> {
  const start = Date.now()
  const dnsApi = 'https://cloudflare-dns.com/dns-query'
  const headers = { accept: 'application/dns-json' }

  try {
    // Check DMARC
    const dmarcRes = await fetch(`${dnsApi}?name=_dmarc.${domain}&type=TXT`, { headers })
    const dmarcData = await dmarcRes.json() as { Answer?: Array<{ data: string }> }
    const hasDmarc = dmarcData.Answer?.some(a => a.data.includes('v=DMARC1')) ?? false

    // Check SPF
    const spfRes = await fetch(`${dnsApi}?name=${domain}&type=TXT`, { headers })
    const spfData = await spfRes.json() as { Answer?: Array<{ data: string }> }
    const hasSpf = spfData.Answer?.some(a => a.data.includes('v=spf1')) ?? false

    const duration = Date.now() - start
    const passed = hasDmarc && hasSpf

    const parts: string[] = []
    parts.push(`DMARC: ${hasDmarc ? 'present' : 'MISSING'}`)
    parts.push(`SPF: ${hasSpf ? 'present' : 'MISSING'}`)

    return {
      passed,
      output: passed
        ? `Email authentication records configured for ${domain}. ${parts.join(', ')}.`
        : `Email authentication issue for ${domain}: ${parts.join(', ')}.`,
      rawData: { domain, hasDmarc, hasSpf, dmarcData, spfData },
      duration,
    }
  } catch (err) {
    return {
      passed: false,
      output: `DNS check failed for ${domain}: ${err instanceof Error ? err.message : String(err)}`,
      duration: Date.now() - start,
      error: String(err),
    }
  }
}

async function runHeaderCheck(target: string): Promise<NLTestResult> {
  const start = Date.now()
  const REQUIRED_HEADERS = [
    'strict-transport-security',
    'content-security-policy',
    'x-frame-options',
    'x-content-type-options',
    'referrer-policy',
  ]
  try {
    const url = target.startsWith('http') ? target : `https://${target}`
    const res = await fetch(url, { method: 'HEAD' })
    const duration = Date.now() - start

    const present: string[] = []
    const missing: string[] = []
    for (const header of REQUIRED_HEADERS) {
      if (res.headers.get(header)) present.push(header)
      else missing.push(header)
    }

    const score = present.length
    const passed = score >= 4

    return {
      passed,
      output: passed
        ? `Security headers look good (${score}/5 present). Present: ${present.join(', ')}.`
        : `Missing security headers (${score}/5 present). Missing: ${missing.join(', ')}.`,
      rawData: { url, present, missing, score, totalChecked: REQUIRED_HEADERS.length },
      duration,
    }
  } catch (err) {
    return {
      passed: false,
      output: `Header check failed for ${target}: ${err instanceof Error ? err.message : String(err)}`,
      duration: Date.now() - start,
      error: String(err),
    }
  }
}

async function runCertificateExpiryCheck(domain: string): Promise<NLTestResult> {
  const start = Date.now()
  const cleanDomain = extractDomain(domain)
  try {
    // Primary: CertSpotter API
    const certRes = await fetch(
      `https://api.certspotter.com/v1/issuances?domain=${cleanDomain}&include_subdomains=true&expand=dns_names`,
    )
    const duration = Date.now() - start

    if (!certRes.ok) {
      // Fallback: just check HTTPS reachability
      const fallback = await runSslCheck(cleanDomain)
      return {
        ...fallback,
        output: fallback.passed
          ? `Certificate appears valid for ${cleanDomain} (HTTPS reachable). Exact expiry unavailable.`
          : fallback.output,
        duration: Date.now() - start,
      }
    }

    const certs = await certRes.json() as Array<{ not_after?: string; dns_names?: string[] }>

    if (!certs.length) {
      return {
        passed: false,
        output: `No certificate issuances found for ${cleanDomain}.`,
        rawData: { certs: [] },
        duration,
      }
    }

    // Find the most recent cert
    const sorted = certs
      .filter(c => c.not_after)
      .sort((a, b) => new Date(b.not_after!).getTime() - new Date(a.not_after!).getTime())

    if (!sorted.length) {
      return { passed: true, output: `Certificate found for ${cleanDomain} but no expiry data available.`, duration }
    }

    const latest = sorted[0]
    const expiresAt = new Date(latest.not_after!)
    const daysLeft = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const passed = daysLeft > 30

    return {
      passed,
      output: passed
        ? `Certificate for ${cleanDomain} expires in ${daysLeft} days (${expiresAt.toDateString()}). ✓`
        : `Certificate for ${cleanDomain} expires in ${daysLeft} days (${expiresAt.toDateString()}). Renewal needed soon!`,
      rawData: { domain: cleanDomain, expiresAt: expiresAt.toISOString(), daysLeft, latestCert: latest },
      duration,
    }
  } catch (err) {
    return {
      passed: false,
      output: `Certificate expiry check failed for ${cleanDomain}: ${err instanceof Error ? err.message : String(err)}`,
      duration: Date.now() - start,
      error: String(err),
    }
  }
}

async function runTlsVersionCheck(target: string): Promise<NLTestResult> {
  const start = Date.now()
  try {
    const url = target.startsWith('http') ? target : `https://${target}`
    // Node.js fetch/https uses system TLS which enforces TLS 1.2+ by default
    const res = await fetch(url, { method: 'HEAD' })
    const duration = Date.now() - start
    return {
      passed: true,
      output: `TLS connection established successfully for ${url}. Modern TLS (1.2+) is supported.`,
      rawData: { url, status: res.status },
      duration,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isOldTls = msg.includes('ssl') || msg.includes('tls') || msg.includes('protocol')
    return {
      passed: false,
      output: `TLS check failed for ${target}: ${msg}`,
      duration: Date.now() - start,
      error: msg,
      rawData: { suspectedTlsIssue: isOldTls },
    }
  }
}

async function runCorsCheck(target: string): Promise<NLTestResult> {
  const start = Date.now()
  try {
    const url = target.startsWith('http') ? target : `https://${target}`
    const res = await fetch(url, {
      method: 'OPTIONS',
      headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'GET' },
    })
    const duration = Date.now() - start
    const acao = res.headers.get('access-control-allow-origin')
    const acam = res.headers.get('access-control-allow-methods')

    const isWildcard = acao === '*'
    const passed = !isWildcard && acao !== null

    return {
      passed: acao !== null ? !isWildcard : true, // null = CORS not allowed = OK for most APIs
      output: acao === null
        ? `No CORS headers returned for ${url}. Cross-origin requests are restricted (this may be correct).`
        : isWildcard
        ? `CORS policy uses wildcard (*) for ${url}. Consider restricting allowed origins.`
        : `CORS policy for ${url} restricts to: ${acao}. Allowed methods: ${acam ?? 'not specified'}.`,
      rawData: { url, 'access-control-allow-origin': acao, 'access-control-allow-methods': acam, status: res.status },
      duration,
    }
  } catch (err) {
    return {
      passed: false,
      output: `CORS check failed for ${target}: ${err instanceof Error ? err.message : String(err)}`,
      duration: Date.now() - start,
      error: String(err),
    }
  }
}

async function runResponseCodeCheck(target: string, expectedCode: number): Promise<NLTestResult> {
  const start = Date.now()
  try {
    const url = target.startsWith('http') ? target : `https://${target}`
    const res = await fetch(url, { method: 'GET' })
    const duration = Date.now() - start
    const passed = res.status === expectedCode

    return {
      passed,
      output: passed
        ? `${url} returned HTTP ${res.status} as expected.`
        : `${url} returned HTTP ${res.status}, but expected ${expectedCode}.`,
      rawData: { url, status: res.status, expectedCode },
      duration,
    }
  } catch (err) {
    return {
      passed: false,
      output: `Response code check failed for ${target}: ${err instanceof Error ? err.message : String(err)}`,
      duration: Date.now() - start,
      error: String(err),
    }
  }
}

// ─── AI Custom Check ──────────────────────────────────────────────────────────

async function getAiConfig(): Promise<{ provider: string; model: string; apiKey: string } | null> {
  try {
    const rows = await db.select().from(systemSettings).limit(1)
    const row = rows[0]
    if (!row) return null

    const extra = (row.extraConfig ?? {}) as Record<string, string>
    if (!extra.encryptedApiKey) return null

    const apiKey = decrypt(extra.encryptedApiKey)
    return {
      provider: row.aiProvider ?? 'openai',
      model: row.aiModel ?? 'gpt-4o-mini',
      apiKey,
    }
  } catch {
    return null
  }
}

async function runAiCustomCheck(query: string, target: string): Promise<NLTestResult> {
  const start = Date.now()

  // Try to fetch the target URL for context
  let httpContext = ''
  if (target) {
    try {
      const url = target.startsWith('http') ? target : `https://${target}`
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) })
      const headersObj: Record<string, string> = {}
      res.headers.forEach((v, k) => { headersObj[k] = v })
      httpContext = `\nHTTP response: status=${res.status}, headers=${JSON.stringify(headersObj)}`
    } catch (e) {
      httpContext = `\nHTTP fetch error: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  const aiConfig = await getAiConfig()
  if (!aiConfig) {
    return {
      passed: false,
      output: 'AI check could not run: no AI provider configured. Please configure an AI provider in Settings.',
      duration: Date.now() - start,
      error: 'No AI configuration found',
    }
  }

  try {
    const prompt = `You are a security compliance checker. Evaluate the following security test query and determine if it passes or fails based on the available data.

Query: "${query}"
Target: "${target}"${httpContext}

Respond in JSON format:
{
  "passed": boolean,
  "output": "human-readable explanation of the result (1-2 sentences)",
  "reasoning": "technical explanation"
}`

    let responseText = ''

    if (aiConfig.provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': aiConfig.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: aiConfig.model,
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json() as { content?: Array<{ text?: string }> }
      responseText = data.content?.[0]?.text ?? ''
    } else {
      // OpenAI-compatible
      const baseUrl = aiConfig.provider === 'openai'
        ? 'https://api.openai.com/v1'
        : 'http://localhost:11434/v1'
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${aiConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 512,
        }),
      })
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      responseText = data.choices?.[0]?.message?.content ?? ''
    }

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in AI response')

    const parsed = JSON.parse(jsonMatch[0]) as { passed: boolean; output: string; reasoning?: string }
    return {
      passed: parsed.passed,
      output: parsed.output,
      rawData: { query, target, reasoning: parsed.reasoning, httpContext: httpContext.slice(0, 500) },
      duration: Date.now() - start,
    }
  } catch (err) {
    return {
      passed: false,
      output: `AI evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
      duration: Date.now() - start,
      error: String(err),
    }
  }
}

// ─── Main executeNLTest ───────────────────────────────────────────────────────

export async function executeNLTest(query: string): Promise<NLTestResult> {
  const { type, target, params } = await parseNLTestQuery(query)

  switch (type) {
    case 'ssl_check':
      return runSslCheck(extractDomain(target) || target)

    case 'port_scan': {
      const port = parseInt(params.port ?? '0', 10)
      if (!port) {
        return { passed: false, output: 'Could not determine port number from query.', duration: 0 }
      }
      return runPortScan(target, port)
    }

    case 'http_check':
      return runHttpCheck(target)

    case 'redirect_check':
      return runRedirectCheck(target)

    case 'dns_check':
      return runDnsCheck(target)

    case 'header_check':
      return runHeaderCheck(target)

    case 'certificate_expiry':
      return runCertificateExpiryCheck(target)

    case 'tls_version':
      return runTlsVersionCheck(target)

    case 'cors_check':
      return runCorsCheck(target)

    case 'response_code': {
      const code = parseInt(params.expectedCode ?? '200', 10)
      return runResponseCodeCheck(target, code)
    }

    case 'ai_custom':
    default:
      return runAiCustomCheck(query, target)
  }
}
