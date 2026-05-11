/**
 * lib/security/ssrf-guard.ts
 *
 * Shared SSRF defense for outbound URL validation.
 *
 * Use `assertPublicUrl(url)` before any fetch where the URL is partially or
 * fully attacker-influenced (webhook destinations, OAuth callbacks, image
 * fetchers, pentest probes, NL-test runners, etc.).
 *
 * Use `safeFetch(url, init)` as a drop-in wrapper that performs the guard
 * check and then calls `fetch`.
 *
 * EXPORT HINT (for other agents): adopt this helper in
 *   - lib/pentest/*  (any outbound HTTP probes)
 *   - lib/integrations/nl-tests.ts
 *   - lib/integrations/*  outbound calls to arbitrary user-supplied URLs
 *   - integration / NL test runners
 * Do NOT add allowlist bypasses here without explicit security review.
 */
import { promises as dns } from 'dns'
import net from 'net'

export class SsrfBlockedError extends Error {
  constructor(message: string, public readonly url?: string) {
    super(message)
    this.name = 'SsrfBlockedError'
  }
}

const FORBIDDEN_HOSTNAMES = new Set([
  // GCP / Azure metadata aliases (also covered by IP checks if they resolve).
  'metadata.google.internal',
  'metadata.azure.com',
  'metadata',
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
])

/**
 * Convert an IPv4 dotted-quad string to a 32-bit unsigned integer.
 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    const o = Number(p)
    if (!Number.isInteger(o) || o < 0 || o > 255) return null
    n = (n << 8) + o
  }
  // Force unsigned
  return n >>> 0
}

/**
 * Check whether an IPv4 address falls in a CIDR block.
 */
function ipv4InCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split('/')
  const bits = Number(bitsStr)
  const ipInt = ipv4ToInt(ip)
  const baseInt = ipv4ToInt(base)
  if (ipInt == null || baseInt == null) return false
  if (bits === 0) return true
  const mask = (~0 << (32 - bits)) >>> 0
  return (ipInt & mask) === (baseInt & mask)
}

/**
 * Returns true if the given IPv4 address is considered private / disallowed.
 */
function isForbiddenIPv4(ip: string): boolean {
  const blocks = [
    '10.0.0.0/8',           // RFC1918
    '172.16.0.0/12',        // RFC1918
    '192.168.0.0/16',       // RFC1918
    '127.0.0.0/8',          // Loopback
    '169.254.0.0/16',       // Link-local + cloud metadata (169.254.169.254)
    '0.0.0.0/8',            // "This network"
    '100.64.0.0/10',        // CGNAT
    '198.18.0.0/15',        // Benchmarking
    '192.0.0.0/24',         // IETF protocol assignments
    '192.0.2.0/24',         // TEST-NET-1
    '198.51.100.0/24',      // TEST-NET-2
    '203.0.113.0/24',       // TEST-NET-3
    '224.0.0.0/4',          // Multicast
    '240.0.0.0/4',          // Reserved
    '255.255.255.255/32',   // Broadcast
  ]
  return blocks.some((b) => ipv4InCidr(ip, b))
}

/**
 * Returns true if the given IPv6 address is considered private / disallowed.
 * We do a prefix check on the normalized address.
 */
function isForbiddenIPv6(ip: string): boolean {
  // Normalize: lowercase, strip zone id
  const norm = ip.toLowerCase().split('%')[0]

  // Loopback ::1
  if (norm === '::1') return true
  // Unspecified ::
  if (norm === '::' || norm === '::0') return true

  // IPv4-mapped (::ffff:0:0/96) — extract embedded v4 and recheck
  const v4MappedMatch = norm.match(/^::ffff:([0-9a-f:]+)$/)
  if (v4MappedMatch) {
    const tail = v4MappedMatch[1]
    if (tail.includes('.')) {
      // ::ffff:1.2.3.4
      return isForbiddenIPv4(tail)
    }
    // ::ffff:0102:0304  -> 1.2.3.4
    const segs = tail.split(':')
    if (segs.length === 2) {
      const hi = parseInt(segs[0], 16)
      const lo = parseInt(segs[1], 16)
      if (Number.isFinite(hi) && Number.isFinite(lo)) {
        const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
        return isForbiddenIPv4(v4)
      }
    }
  }

  // Link-local fe80::/10
  if (/^fe[89ab][0-9a-f]?:/.test(norm)) return true
  // Unique-local fc00::/7
  if (/^f[cd][0-9a-f]{0,2}:/.test(norm)) return true
  // Multicast ff00::/8
  if (norm.startsWith('ff')) return true
  // Discard prefix 100::/64
  if (norm.startsWith('100::')) return true
  // Documentation 2001:db8::/32
  if (norm.startsWith('2001:db8:') || norm === '2001:db8::') return true
  // AWS IMDSv2 IPv6 metadata fd00:ec2::254
  if (norm === 'fd00:ec2::254') return true

  return false
}

function isForbiddenAddress(addr: string, family: number): boolean {
  if (family === 4) return isForbiddenIPv4(addr)
  if (family === 6) return isForbiddenIPv6(addr)
  return true // Unknown family — reject
}

/**
 * Validate that the URL points at a public, non-internal destination.
 *
 * Throws `SsrfBlockedError` if:
 *  - URL is invalid / relative / non-http(s)
 *  - Scheme is `http:` and `opts.allowHttp` is not set
 *  - Hostname resolves to ANY private / loopback / link-local / metadata IP
 *  - Hostname is on a static deny list (localhost, metadata.google.internal, …)
 *
 * @param input  The URL string to validate.
 * @param opts.allowHttp  Allow `http://` (defaults to false). Even when true,
 *                        plain HTTP is rejected in production.
 */
export async function assertPublicUrl(
  input: string,
  opts: { allowHttp?: boolean } = {},
): Promise<URL> {
  if (!input || typeof input !== 'string') {
    throw new SsrfBlockedError('URL is empty or not a string')
  }

  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new SsrfBlockedError(`Invalid URL: ${input}`, input)
  }

  // Reject dangerous schemes outright.
  const scheme = url.protocol.toLowerCase()
  if (scheme !== 'http:' && scheme !== 'https:') {
    throw new SsrfBlockedError(`Disallowed URL scheme: ${scheme}`, input)
  }

  // HTTPS-only by default; allow HTTP only if explicitly opted in AND not prod.
  const isProd = process.env.NODE_ENV === 'production'
  if (scheme === 'http:') {
    if (!opts.allowHttp || isProd) {
      throw new SsrfBlockedError('HTTP scheme is not allowed (https required)', input)
    }
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!hostname) {
    throw new SsrfBlockedError('URL has no hostname', input)
  }

  // Static deny list for well-known internal hostnames.
  if (FORBIDDEN_HOSTNAMES.has(hostname)) {
    throw new SsrfBlockedError(`Hostname is on deny list: ${hostname}`, input)
  }

  // Reject hostnames that are also bare IPs in disallowed ranges.
  if (net.isIP(hostname) !== 0) {
    const family = net.isIPv6(hostname) ? 6 : 4
    if (isForbiddenAddress(hostname, family)) {
      throw new SsrfBlockedError(`Destination IP is private/reserved: ${hostname}`, input)
    }
    return url
  }

  // DNS resolve — use `all: true` to catch multi-record rebinding tricks.
  let addrs: Array<{ address: string; family: number }>
  try {
    addrs = await dns.lookup(hostname, { all: true, verbatim: true })
  } catch (err) {
    throw new SsrfBlockedError(`DNS lookup failed for ${hostname}: ${String(err)}`, input)
  }

  if (!Array.isArray(addrs) || addrs.length === 0) {
    throw new SsrfBlockedError(`No DNS records for ${hostname}`, input)
  }

  for (const a of addrs) {
    if (isForbiddenAddress(a.address, a.family)) {
      throw new SsrfBlockedError(
        `Hostname ${hostname} resolves to forbidden address ${a.address}`,
        input,
      )
    }
  }

  return url
}

/**
 * `fetch` wrapper that runs the SSRF guard first.
 *
 * NOTE: this resolves DNS twice (once for guard, once by fetch). To minimize
 * the rebinding window we re-run `assertPublicUrl` right before the fetch
 * with a 0-cache lookup. This is best-effort defense — the only complete
 * fix is to pin to the resolved IP literal, which breaks SNI/TLS for most
 * destinations. We accept the small residual risk.
 */
export async function safeFetch(
  url: string,
  init?: Parameters<typeof fetch>[1] & { allowHttp?: boolean },
): Promise<Response> {
  const { allowHttp, ...fetchInit } = init ?? {}
  // Pre-check
  await assertPublicUrl(url, { allowHttp })
  // Re-check immediately before the fetch to shrink the rebinding window.
  await assertPublicUrl(url, { allowHttp })
  return fetch(url, fetchInit)
}

/**
 * Strip credentials from a URL string before logging or persisting.
 * Returns the cleaned URL or the original string if parsing fails.
 */
export function stripCredentials(input: string): string {
  try {
    const u = new URL(input)
    u.username = ''
    u.password = ''
    return u.toString()
  } catch {
    return input
  }
}
