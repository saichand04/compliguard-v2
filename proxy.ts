import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { COOKIE_NAME, SETUP_COOKIE_NAME } from '@/lib/auth/jwt'
import { jwtVerify } from 'jose'

/** Paths that are always accessible without auth or setup check */
const PUBLIC_PATHS = [
  '/',         // Landing page — always public
  '/setup',
  '/api/setup',
  '/signin',
  '/signup',
  '/forgot-password',
  '/trust',
  '/api/inbound-email',
  '/api/teams-bot',
  '/api/auth',
  '/api/health',
  '/_next',
  '/favicon.ico',
  '/mcp-manifest.json',
]

function isPublicPath(pathname: string): boolean {
  // Exact match for root landing page
  if (pathname === '/') return true
  // Prefix match for all other public paths
  return PUBLIC_PATHS.filter(p => p !== '/').some((p) => pathname.startsWith(p))
}

async function verifyJwt(token: string): Promise<boolean> {
  const secret = process.env.JWT_SECRET
  if (!secret) return false
  try {
    await jwtVerify(token, new TextEncoder().encode(secret))
    return true
  } catch {
    return false
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Check JWT session cookie
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value

  if (!sessionToken) {
    // Not authenticated — redirect to sign in
    const signinUrl = new URL('/signin', request.url)
    signinUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signinUrl)
  }

  const isValid = await verifyJwt(sessionToken)
  if (!isValid) {
    // Expired or invalid token
    const signinUrl = new URL('/signin', request.url)
    signinUrl.searchParams.set('callbackUrl', pathname)
    const response = NextResponse.redirect(signinUrl)
    response.cookies.delete(COOKIE_NAME)
    response.cookies.delete(SETUP_COOKIE_NAME)
    return response
  }

  // Check setup completion via lightweight cookie (set by /api/setup/complete)
  const setupCookie = request.cookies.get(SETUP_COOKIE_NAME)?.value
  const isSetupComplete = setupCookie === 'done'

  // If setup is not complete and user is not on a setup/* route
  if (!isSetupComplete && !pathname.startsWith('/setup') && !pathname.startsWith('/api/setup')) {
    return NextResponse.redirect(new URL('/setup', request.url))
  }

  // If setup is complete and user is trying to access /setup directly, redirect to dashboard
  if (isSetupComplete && pathname === '/setup') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Pass through — inject minimal user context via headers
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-middleware-validated', '1')

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - Static files (_next/static, _next/image, favicon, public files)
     * - API routes that are specifically public (handled in isPublicPath above)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot)).*)',
  ],
}
