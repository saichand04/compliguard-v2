import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mcpApiKeys } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

/**
 * DELETE /api/settings/mcp-keys/[id]
 * Revoke an MCP API key.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const { id } = await params

  const [existing] = await db
    .select({ id: mcpApiKeys.id })
    .from(mcpApiKeys)
    .where(and(eq(mcpApiKeys.id, id), eq(mcpApiKeys.organizationId, session.orgId)))
    .limit(1)

  if (!existing) return ApiErrors.notFound('MCP API key')

  await db
    .update(mcpApiKeys)
    .set({ status: 'revoked' })
    .where(eq(mcpApiKeys.id, id))

  return NextResponse.json({ success: true, message: 'MCP API key revoked' })
}
