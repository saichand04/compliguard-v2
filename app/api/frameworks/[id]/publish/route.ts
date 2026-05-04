import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { frameworks, controls } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, ApiErrors, writeAuditLog } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'

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
 * POST /api/frameworks/[id]/publish
 * Publish a framework — saves a version snapshot in metadata.versions
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

  // Get all controls for snapshot
  const fwControls = await db.select().from(controls).where(eq(controls.frameworkId, id))

  const meta = (fw.metadata as FrameworkMeta) || {}
  const versions: VersionSnapshot[] = meta.versions || []

  const newVersion: VersionSnapshot = {
    version: fw.version || '1.0',
    publishedAt: new Date().toISOString(),
    snapshot: JSON.stringify(fwControls.slice(0, 50)), // truncated for storage
  }

  versions.push(newVersion)

  const [updated] = await db
    .update(frameworks)
    .set({
      metadata: { ...meta, versions, status: 'published' },
      updatedAt: new Date(),
    })
    .where(eq(frameworks.id, id))
    .returning()

  await writeAuditLog({
    organizationId: session.orgId,
    userId: session.userId,
    action: 'framework.publish',
    resourceType: 'framework',
    resourceId: id,
    resourceTitle: fw.name,
    description: `Published framework: ${fw.name} v${fw.version}`,
    request: req,
  })

  return NextResponse.json({ framework: updated, version: newVersion })
}
