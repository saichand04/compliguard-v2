import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { frameworks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:frameworks')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    const all = await db
      .select({
        id: frameworks.id,
        name: frameworks.name,
        shortName: frameworks.shortName,
        version: frameworks.version,
        description: frameworks.description,
        category: frameworks.category,
        regulatoryBody: frameworks.regulatoryBody,
        slug: frameworks.slug,
        isBuiltIn: frameworks.isBuiltIn,
        isActive: frameworks.isActive,
        createdAt: frameworks.createdAt,
        updatedAt: frameworks.updatedAt,
      })
      .from(frameworks)
      .where(eq(frameworks.isActive, true))

    return NextResponse.json({
      success: true,
      data: all,
      meta: { total: all.length },
    })
  } catch (err) {
    logger.error({ err }, 'v1.frameworks.list failed')
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
