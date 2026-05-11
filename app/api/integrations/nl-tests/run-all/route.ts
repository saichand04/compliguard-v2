import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { hasPermission, PERMISSIONS } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { nlTests, nlTestResults } from '@/lib/db/schema'
import { eq, and, gte, sql } from 'drizzle-orm'
import { runAndSaveNLTest } from '@/lib/integrations/nl-test-scheduler'

// ── Concurrency limiter ──────────────────────────────────────────────────────
// p-limit-style bounded executor. Inlined to avoid adding a dependency.
// Returns a function that schedules `fn` and resolves with its result, never
// running more than `n` at a time.
function makeLimiter<T>(n: number): (fn: () => Promise<T>) => Promise<T> {
  let active = 0
  const queue: Array<() => void> = []
  const next = () => {
    active--
    const r = queue.shift()
    if (r) r()
  }
  return async (fn) => {
    if (active >= n) {
      await new Promise<void>((resolve) => queue.push(resolve))
    }
    active++
    try {
      return await fn()
    } finally {
      next()
    }
  }
}

// ── Per-org daily quota ──────────────────────────────────────────────────────
const DAILY_QUOTA = 200
const DAY_MS = 24 * 60 * 60 * 1000

async function quotaRemaining(orgId: string): Promise<number> {
  const since = new Date(Date.now() - DAY_MS)
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(nlTestResults)
    .where(
      and(
        eq(nlTestResults.organizationId, orgId),
        gte(nlTestResults.ranAt, since),
      )
    )
  const used = Number(rows[0]?.count ?? 0)
  return Math.max(0, DAILY_QUOTA - used)
}

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

  // Per-org daily quota. Refuse if granting all would exceed it.
  const remaining = await quotaRemaining(session.orgId)
  if (remaining <= 0) {
    return NextResponse.json(
      { error: `Daily NL test quota of ${DAILY_QUOTA} runs exhausted. Try again in 24h.` },
      { status: 429 },
    )
  }
  // Truncate to fit the remaining budget (rather than rejecting entirely).
  const orgId = session.orgId
  const testsToRun = activeTests.slice(0, remaining)

  // Run with bounded concurrency (5 parallel).
  const limit = makeLimiter<Awaited<ReturnType<typeof runAndSaveNLTest>>>(5)
  const outcomes = await Promise.allSettled(
    testsToRun.map((t) => limit(() => runAndSaveNLTest(t.id, orgId))),
  )

  const results = outcomes.map((outcome, i) => {
    const test = testsToRun[i]
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
    skipped: activeTests.length - testsToRun.length,
    passed,
    failed,
    quota: { daily: DAILY_QUOTA, remainingBefore: remaining, remainingAfter: Math.max(0, remaining - results.length) },
    results,
  })
}
