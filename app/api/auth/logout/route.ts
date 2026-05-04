import { NextResponse } from 'next/server'
import { COOKIE_NAME, SETUP_COOKIE_NAME } from '@/lib/auth/jwt'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  // Explicitly expire both cookies on the response object
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  }
  response.cookies.set(COOKIE_NAME, '', cookieOpts)
  response.cookies.set(SETUP_COOKIE_NAME, '', cookieOpts)
  return response
}
