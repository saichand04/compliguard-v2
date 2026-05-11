import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { COOKIE_NAME, SETUP_COOKIE_NAME, getSessionFromRequest } from '@/lib/auth/jwt'

/**
 * POST /api/auth/logout
 *
 * Bumps the user's `token_version` so every previously-issued JWT for
 * that account is invalidated (defends against stolen-cookie replay
 * after the user explicitly logs out), then clears the session and
 * setup cookies.
 *
 * The `secure` cookie attribute must match what was used when the
 * cookie was set, otherwise some browsers refuse to apply the deletion.
 * That mirrors lib/auth/jwt.ts#setSessionCookie which uses NEXTAUTH_URL
 * (not NODE_ENV) to decide whether the deployment is HTTPS.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (session?.userId) {
    try {
      await db
        .update(users)
        .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() })
        .where(eq(users.id, session.userId))
    } catch {
      // Best-effort — logout should still clear the cookie even if the
      // DB write fails.
    }
  }

  const isHttps = (process.env.NEXTAUTH_URL || '').startsWith('https://')
  const cookieOpts = {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  }
  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, '', cookieOpts)
  response.cookies.set(SETUP_COOKIE_NAME, '', cookieOpts)
  return response
}
