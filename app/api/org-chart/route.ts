import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { orgChartNodes } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { z } from 'zod'

const createNodeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  title: z.string().optional(),
  department: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  parentId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  orderIndex: z.number().int().optional(),
})

/** GET /api/org-chart — return all nodes for the org as a flat list */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  const nodes = await db
    .select()
    .from(orgChartNodes)
    .where(eq(orgChartNodes.organizationId, session.orgId))
    .orderBy(orgChartNodes.orderIndex, desc(orgChartNodes.createdAt))

  return NextResponse.json({ nodes, total: nodes.length })
}

/** POST /api/org-chart — create a new org chart node */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return ApiErrors.badRequest('Invalid JSON body')
  }

  const result = createNodeSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  const data = result.data

  const [node] = await db
    .insert(orgChartNodes)
    .values({
      organizationId: session.orgId,
      name: data.name,
      title: data.title,
      department: data.department,
      email: data.email || undefined,
      parentId: data.parentId ?? null,
      userId: data.userId ?? null,
      avatarUrl: data.avatarUrl ?? null,
      orderIndex: data.orderIndex ?? 0,
    })
    .returning()

  return NextResponse.json({ node }, { status: 201 })
}
