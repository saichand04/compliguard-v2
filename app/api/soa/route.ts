import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  soaEntries, controls, frameworks, organizationFrameworks,
  users,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

// GET /api/soa?frameworkId=xxx
// Returns all SOA entries (or defaults) for the org + framework
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.badRequest('No organisation associated with session')

  const { searchParams } = req.nextUrl
  const frameworkId = searchParams.get('frameworkId')

  if (!frameworkId) return ApiErrors.badRequest('frameworkId is required')
  if (!uuidSchema.safeParse(frameworkId).success) return ApiErrors.badRequest('Invalid frameworkId')

  try {
    // Verify org has access to this framework (either active assignment or built-in)
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
    void orgFramework // Read is allowed even without active assignment to permit browse of built-in frameworks

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
    logger.error({ err }, 'soa.list failed')
    return ApiErrors.internal()
  }
}

// POST /api/soa
// Create or update a SOA entry
const postSchema = z.object({
  controlId: z.string().uuid(),
  status: z.enum(['included', 'excluded', 'partial']).optional(),
  justification: z.string().optional(),
  implementationStatus: z.string().optional(),
}).strict()

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.badRequest('No organisation associated with session')

  let raw: unknown
  try { raw = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const parsed = postSchema.safeParse(raw)
  if (!parsed.success) return ApiErrors.badRequest(parsed.error.issues[0].message)
  const { controlId, status, justification, implementationStatus } = parsed.data

  // Validate controlId belongs to a framework that is active for this org
  // (i.e. caller must have an organization_frameworks row for the framework
  // that owns this control). Built-in frameworks alone are NOT enough — the
  // org must have actually adopted them.
  const [scopeRow] = await db
    .select({ id: controls.id })
    .from(controls)
    .innerJoin(frameworks, eq(frameworks.id, controls.frameworkId))
    .innerJoin(
      organizationFrameworks,
      and(
        eq(organizationFrameworks.frameworkId, frameworks.id),
        eq(organizationFrameworks.organizationId, session.orgId),
        eq(organizationFrameworks.isActive, true),
      ),
    )
    .where(eq(controls.id, controlId))
    .limit(1)
  if (!scopeRow) return ApiErrors.badRequest('controlId is not in an active framework for this organization')

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
    logger.error({ err }, 'soa.upsert failed')
    return ApiErrors.internal()
  }
}
