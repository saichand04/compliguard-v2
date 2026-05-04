import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { frameworks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { z } from 'zod'

const rollbackSchema = z.object({
  version: z.string().min(1),
})

interface VersionSnapshot {
  version: string
  publishedAt: string
  snapshot: string
}

interface FrameworkMeta {
  versions?: VersionSnapshot[]
  status?: string
  [key: string]: unknown
}

/**
 * POST /api/frameworks/[id]/rollback
 * Rollback framework to a previous version snapshot.
 * Body: { version: "1.0" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.EDIT_FRAMEWORKS)) return ApiErrors.forbidden()

  const { id } = await params

  const [fw] = await db.select().from(frameworks).where(eq(frameworks.id, id))
  if (!fw) return ApiErrors.notFound('Framework')

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = rollbackSchema.safeParse(body)
  if (!result.success) return ApiErrors.badRequest(result.error.issues[0].message)

  const meta = (fw.metadata as FrameworkMeta) || {}
  const versions: VersionSnapshot[] = meta.versions || []

  const targetVersion = versions.find((v) => v.version === result.data.version)
  if (!targetVersion) return ApiErrors.notFound(`Version ${result.data.version}`)

  const [updated] = await db
    .update(frameworks)
    .set({
      version: targetVersion.version,
      metadata: { ...meta, status: 'draft' },
      updatedAt: new Date(),
    })
    .where(eq(frameworks.id, id))
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'framework.rollback',
    resourceType: 'framework',
    resourceId: id,
    resourceTitle: fw.name,
    description: `Rolled back framework ${fw.name} to v${result.data.version}`,
    request: req,
  })

  return NextResponse.json({ framework: updated, rolledBackTo: result.data.version })
}
