import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, verifyToken } from '@/lib/auth/jwt'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/session
 * Returns the current session payload if a valid JWT exists,
 * or 401 if not authenticated. Used by client components to
 * check auth state without a full page reload.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 })
  }

  const session = await verifyToken(token)

  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 })
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.userId,
      email: session.email,
      role: session.role,
      orgId: session.orgId,
      firstName: session.firstName ?? null,
      lastName: session.lastName ?? null,
    },
    expiresAt: session.exp ? new Date(session.exp * 1000).toISOString() : null,
  })
}

/**
 * DELETE /api/auth/session
 * Clears the session cookie (sign out).
 *
 * The `secure` attribute is derived from NEXTAUTH_URL so it matches
 * what was used at set time — using NODE_ENV here would mark the
 * deletion `secure` on plain-HTTP production deployments and the
 * browser would silently ignore it, leaving the cookie in place.
 */
export async function DELETE() {
  const isHttps = (process.env.NEXTAUTH_URL || '').startsWith('https://')
  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  })
  return response
}
