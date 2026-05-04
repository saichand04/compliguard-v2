import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-helper'
import { db } from '@/lib/db'
import { contextHub } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.orgId
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const [hub] = await db
    .select()
    .from(contextHub)
    .where(eq(contextHub.organizationId, orgId))
    .limit(1)

  return NextResponse.json({ hub: hub || null })
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.orgId
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  let body: {
    techStack?: unknown
    businessProcesses?: string
    riskTolerance?: string
    complianceGoals?: unknown
    keyAssets?: unknown
    threatActors?: unknown
    regulatoryContext?: string
    additionalContext?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const [existing] = await db
    .select({ id: contextHub.id })
    .from(contextHub)
    .where(eq(contextHub.organizationId, orgId))
    .limit(1)

  const data = {
    techStack: body.techStack ?? null,
    businessProcesses: body.businessProcesses ?? null,
    riskTolerance: body.riskTolerance ?? null,
    complianceGoals: body.complianceGoals ?? null,
    keyAssets: body.keyAssets ?? null,
    threatActors: body.threatActors ?? null,
    regulatoryContext: body.regulatoryContext ?? null,
    additionalContext: body.additionalContext ?? null,
    updatedBy: session.userId,
    updatedAt: new Date(),
  }

  if (existing) {
    await db.update(contextHub).set(data).where(eq(contextHub.id, existing.id))
  } else {
    await db.insert(contextHub).values({
      organizationId: orgId,
      ...data,
    })
  }

  const [hub] = await db
    .select()
    .from(contextHub)
    .where(eq(contextHub.organizationId, orgId))
    .limit(1)

  return NextResponse.json({ hub })
}

// Also support PUT as alias
export { POST as PUT }
