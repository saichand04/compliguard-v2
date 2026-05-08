import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const COOKIE_NAME = 'cg-session'
export const SETUP_COOKIE_NAME = 'cg-setup'

export interface SessionPayload extends JWTPayload {
  userId: string
  orgId: string | null
  email: string
  role: string
  firstName?: string | null
  lastName?: string | null
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
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
    .setIssuer('compliguard')
    .setExpirationTime(`${expiryDays}d`)
    .sign(getSecret())
}

/**
 * Verify a JWT token and return the decoded payload.
 */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: 'compliguard',
    })
    return payload as SessionPayload
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
 * Set the session cookie after a successful login.
 */
export async function setSessionCookie(payload: Omit<SessionPayload, 'iat' | 'exp' | 'iss'>): Promise<string> {
  const token = await signToken(payload)
  const cookieStore = await cookies()

  // Use NEXTAUTH_URL to determine if we're running over HTTPS.
  // Do NOT use NODE_ENV === 'production' for the secure flag — Docker deployments
  // on a local network are production mode but served over plain HTTP.
  const isHttps = (process.env.NEXTAUTH_URL || '').startsWith('https://')

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  })

  return token
}

/**
 * Clear the session cookie (logout).
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  cookieStore.delete(SETUP_COOKIE_NAME)
}

/**
 * Set the setup completion cookie after wizard finishes.
 */
export async function setSetupCookie(): Promise<void> {
  const cookieStore = await cookies()
  const isHttps = (process.env.NEXTAUTH_URL || '').startsWith('https://')
  cookieStore.set(SETUP_COOKIE_NAME, 'done', {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })
}
