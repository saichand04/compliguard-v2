/**
 * app/api/integrations/github/test/route.ts
 * POST — test GitHub connection only (does not save config)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const body = await req.json() as { token?: string; owner?: string }

  if (!body.token) {
    return ApiErrors.badRequest('GitHub token is required')
  }

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${body.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (res.status === 401) {
      return NextResponse.json(
        { success: false, error: 'Invalid token — authentication failed' },
        { status: 401 },
      )
    }

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `GitHub API error: ${res.status}` },
        { status: 400 },
      )
    }

    const user = await res.json() as { login: string; name?: string; type?: string }

    // If owner is provided, verify access
    if (body.owner) {
      const orgRes = await fetch(`https://api.github.com/orgs/${body.owner}`, {
        headers: {
          Authorization: `Bearer ${body.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })

      if (!orgRes.ok && orgRes.status !== 404) {
        return NextResponse.json({
          success: true,
          user: { login: user.login, name: user.name },
          warning: `Could not access organization "${body.owner}" — check token permissions`,
        })
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        login: user.login,
        name: user.name,
        type: user.type,
      },
    })
  } catch (err) {
    return ApiErrors.internal(`Connection test failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}
