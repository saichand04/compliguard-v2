import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  soaEntries, controls, frameworks, organizationFrameworks,
  users,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

// GET /api/soa?frameworkId=xxx
// Returns all SOA entries (or defaults) for the org + framework
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.badRequest('No organisation associated with session')

  const { searchParams } = req.nextUrl
  const frameworkId = searchParams.get('frameworkId')

  if (!frameworkId) return ApiErrors.badRequest('frameworkId is required')

  try {
    // Verify org has access to this framework
    const [orgFramework] = await db
      .select()
      .from(organizationFrameworks)
      .where(
        and(
          eq(organizationFrameworks.organizationId, session.orgId),
          eq(organizationFrameworks.frameworkId, frameworkId),
          eq(organizationFrameworks.isActive, true)
        )
      )
      .limit(1)

    // We allow read even if org hasn't explicitly activated this framework
    // (so built-in frameworks can be browsed)

    // Get all controls for this framework
    const frameworkControls = await db
      .select({
        id: controls.id,
        controlId: controls.controlId,
        title: controls.title,
        category: controls.category,
      })
      .from(controls)
      .where(eq(controls.frameworkId, frameworkId))
      .orderBy(controls.controlId)

    // Get existing SOA entries for this org
    const existingEntries = await db
      .select({
        id: soaEntries.id,
        controlId: soaEntries.controlId,
        status: soaEntries.status,
        justification: soaEntries.justification,
        implementationStatus: soaEntries.implementationStatus,
        reviewedBy: soaEntries.reviewedBy,
        reviewedAt: soaEntries.reviewedAt,
      })
      .from(soaEntries)
      .where(eq(soaEntries.organizationId, session.orgId))

    // Index existing entries by controlId
    const entryMap = new Map(existingEntries.map((e) => [e.controlId, e]))

    // Resolve reviewer names
    const reviewerIds = [...new Set(existingEntries.map((e) => e.reviewedBy).filter(Boolean))] as string[]
    const reviewerMap: Record<string, string> = {}
    for (const rid of reviewerIds) {
      try {
        const [user] = await db
          .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
          .from(users)
          .where(eq(users.id, rid))
          .limit(1)
        if (user) {
          reviewerMap[rid] = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
        }
      } catch {
        // ignore
      }
    }

    // Build response: merge controls + existing entries (default = included)
    const entries = frameworkControls.map((ctrl) => {
      const existing = entryMap.get(ctrl.id)
      return {
        id: existing?.id ?? null,
        controlId: ctrl.id,
        controlRef: ctrl.controlId ?? '',
        controlTitle: ctrl.title,
        category: ctrl.category,
        status: (existing?.status ?? 'included') as 'included' | 'excluded' | 'partial',
        justification: existing?.justification ?? null,
        implementationStatus: existing?.implementationStatus ?? null,
        reviewedBy: existing?.reviewedBy
          ? (reviewerMap[existing.reviewedBy] ?? existing.reviewedBy)
          : null,
        reviewedAt: existing?.reviewedAt?.toISOString() ?? null,
      }
    })

    return NextResponse.json({ entries, total: entries.length })
  } catch (err) {
    console.error('[soa GET]', err)
    return ApiErrors.internal()
  }
}

// POST /api/soa
// Create or update a SOA entry
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.badRequest('No organisation associated with session')

  let body: {
    controlId?: string
    status?: string
    justification?: string
    implementationStatus?: string
  }

  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON')
  }

  const { controlId, status, justification, implementationStatus } = body

  if (!controlId) return ApiErrors.badRequest('controlId is required')

  const validStatuses = ['included', 'excluded', 'partial']
  if (status && !validStatuses.includes(status)) {
    return ApiErrors.badRequest('Invalid status')
  }

  try {
    // Check if entry already exists
    const [existing] = await db
      .select()
      .from(soaEntries)
      .where(
        and(
          eq(soaEntries.organizationId, session.orgId),
          eq(soaEntries.controlId, controlId)
        )
      )
      .limit(1)

    const now = new Date()

    if (existing) {
      // Update
      const [updated] = await db
        .update(soaEntries)
        .set({
          ...(status ? { status: status as 'included' | 'excluded' | 'partial' } : {}),
          ...(justification !== undefined ? { justification } : {}),
          ...(implementationStatus !== undefined ? { implementationStatus } : {}),
          reviewedBy: session.userId,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(soaEntries.id, existing.id))
        .returning()

      return NextResponse.json({ entry: updated })
    } else {
      // Create
      const [created] = await db
        .insert(soaEntries)
        .values({
          organizationId: session.orgId,
          controlId,
          status: (status ?? 'included') as 'included' | 'excluded' | 'partial',
          justification: justification ?? null,
          implementationStatus: implementationStatus ?? null,
          reviewedBy: session.userId,
          reviewedAt: now,
        })
        .returning()

      return NextResponse.json({ entry: created }, { status: 201 })
    }
  } catch (err) {
    console.error('[soa POST]', err)
    return ApiErrors.internal()
  }
}
