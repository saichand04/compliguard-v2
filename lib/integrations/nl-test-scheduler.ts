/**
 * lib/integrations/nl-test-scheduler.ts
 * Scheduler for running NL tests on a schedule and saving results.
 */

import { db } from '@/lib/db'
import { nlTests, nlTestResults, findings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { executeNLTest, NLTestResult } from './nl-tests'

/**
 * Run a single NL test, persist the result, and create a finding if it failed.
 */
export async function runAndSaveNLTest(testId: string, orgId: string): Promise<NLTestResult> {
  // Load the test
  const [test] = await db
    .select()
    .from(nlTests)
    .where(and(eq(nlTests.id, testId), eq(nlTests.organizationId, orgId)))
    .limit(1)

  if (!test) throw new Error(`NL test ${testId} not found`)

  // Execute
  const result = await executeNLTest(test.query)

  // Persist result
  await db.insert(nlTestResults).values({
    testId,
    organizationId: orgId,
    passed: result.passed,
    output: result.output,
    rawData: result.rawData as Record<string, unknown> | undefined,
    duration: String(result.duration),
  })

  // Update test lastRunAt
  await db
    .update(nlTests)
    .set({ lastRunAt: new Date(), updatedAt: new Date() })
    .where(eq(nlTests.id, testId))

  // Create a finding if the test failed
  if (!result.passed) {
    await db.insert(findings).values({
      organizationId: orgId,
      title: `NL Test Failed: ${test.name}`,
      description: result.output,
      severity: 'medium',
      status: 'open',
      source: 'nl_test',
      affectedAsset: test.query.slice(0, 500),
      remediationGuidance: result.error
        ? `Error encountered: ${result.error}`
        : 'Review the test query and target configuration.',
      rawData: result.rawData as Record<string, unknown> | undefined,
    })
  }

  return result
}

/**
 * Run all active scheduled NL tests for an organization.
 * Called by a cron job or manual trigger.
 */
export async function runScheduledTests(orgId: string): Promise<void> {
  const activeTests = await db
    .select()
    .from(nlTests)
    .where(and(eq(nlTests.organizationId, orgId), eq(nlTests.isActive, true)))

  const now = new Date()

  await Promise.allSettled(
    activeTests
      .filter((t) => {
        // Only run tests that have a schedule set
        if (!t.schedule || t.schedule === 'manual') return false
        // Check if it's time to run based on schedule
        if (!t.lastRunAt) return true
        const last = new Date(t.lastRunAt)
        const msAgo = now.getTime() - last.getTime()

        if (t.schedule === 'daily' || t.schedule === '0 9 * * *') {
          return msAgo >= 23 * 60 * 60 * 1000
        }
        if (t.schedule === 'weekly' || t.schedule === '0 9 * * 1') {
          return msAgo >= 6 * 24 * 60 * 60 * 1000
        }
        if (t.schedule === 'monthly' || t.schedule === '0 9 1 * *') {
          return msAgo >= 28 * 24 * 60 * 60 * 1000
        }
        // For custom cron, run if not run in last 60 minutes
        return msAgo >= 60 * 60 * 1000
      })
      .map((t) => runAndSaveNLTest(t.id, orgId)),
  )
}
