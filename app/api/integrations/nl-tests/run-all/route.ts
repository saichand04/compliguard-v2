import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { nlTests } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { runAndSaveNLTest } from '@/lib/integrations/nl-test-scheduler'

/**
 * POST /api/integrations/nl-tests/run-all
 * Run all active NL tests for the org in parallel.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (!hasPermission(session.role, PERMISSIONS.MANAGE_INTEGRATIONS)) return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  // Get all active tests for the org
  const activeTests = await db
    .select()
    .from(nlTests)
    .where(and(eq(nlTests.organizationId, session.orgId), eq(nlTests.isActive, true)))

  if (!activeTests.length) {
    return NextResponse.json({ ran: 0, passed: 0, failed: 0, results: [] })
  }

  // Run all in parallel
  const outcomes = await Promise.allSettled(
    activeTests.map((t) => runAndSaveNLTest(t.id, session.orgId!)),
  )

  const results = outcomes.map((outcome, i) => {
    const test = activeTests[i]
    if (outcome.status === 'fulfilled') {
      return {
        testId: test.id,
        name: test.name,
        passed: outcome.value.passed,
        output: outcome.value.output,
        duration: outcome.value.duration,
        error: outcome.value.error,
      }
    }
    return {
      testId: test.id,
      name: test.name,
      passed: false,
      output: 'Test execution error',
      duration: 0,
      error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
    }
  })

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  return NextResponse.json({
    ran: results.length,
    passed,
    failed,
    results,
  })
}
