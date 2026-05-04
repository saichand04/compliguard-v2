import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { vendors } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { validateApiKey, hasScope } from '@/lib/api/api-key-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKeyData = await validateApiKey(request)
  if (!apiKeyData) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!hasScope(apiKeyData.scopes, 'read:vendors')) {
    return NextResponse.json({ success: false, error: 'Insufficient scope', code: 'FORBIDDEN' }, { status: 403 })
  }
  const { orgId } = apiKeyData
  const { id } = await params

  try {
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.organizationId, orgId)))
      .limit(1)

    if (!vendor) {
      return NextResponse.json({ success: false, error: 'Vendor not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: vendor })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
