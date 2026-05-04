/**
 * Teams notification trigger hooks.
 * These are fire-and-forget helpers called from API routes.
 * Callers do NOT need to await these functions.
 */
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema/tasks'
import { eq, and, lt, ne } from 'drizzle-orm'
import {
  notifyCriticalFinding,
  notifyEvidenceNeedsReview,
  notifyEvidenceRejected,
  notifyTaskOverdue,
} from '@/lib/teams/notifications'
import { EvidenceData, TaskData } from '@/lib/teams/bot'

// ─────────────────────────────────────────────────────────────────────────────
// Finding hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call after a finding is created (POST /api/findings).
 * Only notifies for critical or high severity findings.
 */
export async function onFindingCreated(finding: {
  id: string
  title: string
  severity: string
  affectedAsset?: string
  source?: string
  orgId: string
}): Promise<void> {
  const severity = (finding.severity ?? '').toLowerCase()
  if (severity !== 'critical' && severity !== 'high') return

  try {
    await notifyCriticalFinding({
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      affectedAsset: finding.affectedAsset,
      source: finding.source ?? 'manual',
      orgId: finding.orgId,
    })
  } catch (err) {
    // Fire-and-forget: log but don't surface errors to caller
    console.error('[Teams Hook] onFindingCreated failed:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call after evidence status changes to 'pending_review' / 'pending'.
 */
export async function onEvidencePendingReview(evidence: EvidenceData): Promise<void> {
  try {
    await notifyEvidenceNeedsReview(evidence)
  } catch (err) {
    console.error('[Teams Hook] onEvidencePendingReview failed:', err)
  }
}

/**
 * Call after evidence is rejected.
 */
export async function onEvidenceRejected(params: {
  evidenceId: string
  evidenceTitle: string
  controlTitle: string
  rejectedBy: string
  reason?: string
  orgId: string
}): Promise<void> {
  try {
    await notifyEvidenceRejected(params)
  } catch (err) {
    console.error('[Teams Hook] onEvidenceRejected failed:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Overdue tasks hook (scheduled)
// ─────────────────────────────────────────────────────────────────────────────

const OVERDUE_NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Called from POST /api/teams/check-overdue.
 * Queries all overdue tasks for the org and sends reminders,
 * rate-limiting to once per 24 h per task (tracked via task.metadata).
 *
 * Returns the number of tasks checked and notifications sent.
 */
export async function checkAndNotifyOverdueTasks(
  orgId: string
): Promise<{ tasksChecked: number; notificationsSent: number }> {
  const now = new Date()

  // Fetch all non-done, non-cancelled tasks with a past due date
  const overdueTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.organizationId, orgId),
        ne(tasks.status, 'done'),
        ne(tasks.status, 'cancelled'),
        lt(tasks.dueDate, now)
      )
    )

  let notificationsSent = 0

  for (const task of overdueTasks) {
    if (!task.dueDate) continue

    // Rate-limit: check last notification timestamp stored in metadata
    const meta = (task.metadata ?? {}) as Record<string, unknown>
    const lastNotifiedAt = meta.teamsLastNotifiedAt as string | undefined
    if (lastNotifiedAt) {
      const elapsed = now.getTime() - new Date(lastNotifiedAt).getTime()
      if (elapsed < OVERDUE_NOTIFY_COOLDOWN_MS) {
        // Already notified within 24 h — skip
        continue
      }
    }

    const daysOverdue = Math.floor(
      (now.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    const taskData: TaskData & { orgId: string } = {
      id: task.id,
      title: task.title,
      description: task.description ?? undefined,
      dueDate: task.dueDate.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      }),
      status: task.status,
      priority: task.priority ?? undefined,
      daysOverdue,
      orgId,
    }

    try {
      await notifyTaskOverdue(taskData)

      // Update metadata with last notification timestamp
      await db
        .update(tasks)
        .set({
          metadata: {
            ...meta,
            teamsLastNotifiedAt: now.toISOString(),
          },
          updatedAt: now,
        })
        .where(eq(tasks.id, task.id))

      notificationsSent++
    } catch (err) {
      console.error(`[Teams Hook] checkAndNotifyOverdueTasks: failed for task ${task.id}:`, err)
    }
  }

  return { tasksChecked: overdueTasks.length, notificationsSent }
}
