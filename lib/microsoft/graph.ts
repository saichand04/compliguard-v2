/**
 * Microsoft Graph API Helper
 * Handles OAuth2 token acquisition and paginated Graph API calls.
 */

const TOKEN_ENDPOINT = 'https://login.microsoftonline.com'
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

/**
 * Acquire an OAuth2 client-credentials token for Microsoft Graph.
 */
export async function getMSGraphToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const url = `${TOKEN_ENDPOINT}/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to acquire MS Graph token: ${res.status} ${err}`)
  }

  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

/**
 * Generic Graph API GET — returns the parsed JSON body.
 */
export async function graphGet<T>(token: string, path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Graph API error ${res.status} for ${path}: ${err}`)
  }

  return res.json() as Promise<T>
}

interface ODataResponse<T> {
  value: T[]
  '@odata.nextLink'?: string
}

/**
 * Graph API GET with automatic @odata.nextLink pagination.
 * Accumulates all pages and returns a flat array.
 */
export async function graphGetAll<T>(token: string, path: string): Promise<T[]> {
  const results: T[] = []
  let url: string | undefined = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`

  while (url) {
    // Explicit type annotation avoids implicit-any circular inference
    const page: ODataResponse<T> = await graphGet<ODataResponse<T>>(token, url)
    if (Array.isArray(page.value)) {
      results.push(...page.value)
    }
    url = page['@odata.nextLink']
  }

  return results
}
