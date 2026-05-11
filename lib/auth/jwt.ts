import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const COOKIE_NAME = 'cg-session'
export const SETUP_COOKIE_NAME = 'cg-setup'

export const JWT_ISSUER = 'compliguard'

/** Known-insecure placeholder injected at Docker build time; never valid at runtime. */
const BUILD_TIME_PLACEHOLDER_SECRET = 'build-time-placeholder-secret-32-chars'

export interface SessionPayload extends JWTPayload {
  userId: string
  orgId: string | null
  email: string
  role: string
  firstName?: string | null
  lastName?: string | null
  /** Bumped on logout / password change / deactivation to revoke prior tokens. */
  tokenVersion: number
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  if (secret === BUILD_TIME_PLACEHOLDER_SECRET) {
    throw new Error(
      'JWT_SECRET is the build-time placeholder. Configure a real secret in your runtime environment.',
    )
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long')
  }
  return new TextEncoder().encode(secret)
}

/**
 * Sign a JWT token and return it as a string.
 */
export async function signToken(payload: Omit<SessionPayload, 'iat' | 'exp' | 'iss'>): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
  const expiryDays = parseInt(expiresIn.replace('d', ''), 10) || 7

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setExpirationTime(`${expiryDays}d`)
    .sign(getSecret())
}

/**
 * Verify a JWT token and return the decoded payload.
 *
 * In addition to the cryptographic verification, this checks that the
 * `tokenVersion` claim still matches the user's current `token_version`
 * column. Tokens issued before logout / password change / deactivation
 * will fail this check and be rejected even though they are otherwise
 * still in their validity window.
 */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: JWT_ISSUER,
    })
    const session = payload as SessionPayload

    if (typeof session.userId !== 'string' || typeof session.tokenVersion !== 'number') {
      return null
    }

    // Validate tokenVersion against the database to enforce revocation.
    // Done inline (not via a separate require) to keep verifyToken usable
    // from both edge and node runtimes; the DB module short-circuits if
    // it cannot be loaded (e.g. middleware/edge), in which case we fall
    // back to the cryptographic check only.
    try {
      const { db } = await import('@/lib/db')
      const { users } = await import('@/lib/db/schema')
      const { eq } = await import('drizzle-orm')
      const [user] = await db
        .select({ tokenVersion: users.tokenVersion, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1)
      if (!user) return null
      if (!user.isActive) return null
      if (user.tokenVersion !== session.tokenVersion) return null
    } catch {
      // DB unavailable (e.g. edge runtime in middleware/proxy) — fall through.
    }

    return session
  } catch {
    return null
  }
}

/**
 * Get the current session from the request cookies (for Server Components/Actions).
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

/**
 * Get the session from a NextRequest object (for middleware/route handlers).
 */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

/**
 * Use NEXTAUTH_URL to determine if we're running over HTTPS. Do NOT use
 * NODE_ENV === 'production' for the secure flag — Docker deployments on
 * a local network are production mode but served over plain HTTP, and
 * the browser silently drops cookies marked secure on http:// origins.
 */
function isHttpsDeployment(): boolean {
  return (process.env.NEXTAUTH_URL || '').startsWith('https://')
}

/**
 * Set the session cookie after a successful login.
 */
export async function setSessionCookie(payload: Omit<SessionPayload, 'iat' | 'exp' | 'iss'>): Promise<string> {
  const token = await signToken(payload)
  const cookieStore = await cookies()

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttpsDeployment(),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  })

  return token
}

/**
 * Clear the session cookie (logout).
 *
 * Sets the cookie with maxAge=0 and an expired Expires header in addition
 * to calling `delete()`, because some clients only honour one of the two
 * forms. The `secure` attribute MUST match what was used when the cookie
 * was set, otherwise some browsers refuse to apply the deletion.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  const cookieOpts = {
    httpOnly: true,
    secure: isHttpsDeployment(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  }
  cookieStore.set(COOKIE_NAME, '', cookieOpts)
  cookieStore.set(SETUP_COOKIE_NAME, '', cookieOpts)
  cookieStore.delete(COOKIE_NAME)
  cookieStore.delete(SETUP_COOKIE_NAME)
}

/**
 * Set the setup completion cookie after wizard finishes.
 */
export async function setSetupCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SETUP_COOKIE_NAME, 'done', {
    httpOnly: true,
    secure: isHttpsDeployment(),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })
}
