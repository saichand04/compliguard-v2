/**
 * Teams approval action handlers for evidence review.
 * Called by the bot route when it receives an invoke/submit activity
 * with action = 'approve_evidence' | 'reject_evidence'.
 *
 * SECURITY (C7): `orgId` is supplied by the bot route and MUST be the orgId
 * resolved from the stored conversation reference — NEVER from the inbound
 * Adaptive Card `value.orgId`. The lookup below enforces tenant isolation by
 * requiring `evidence.organizationId === orgId` before any mutation.
 */
import { db } from '@/lib/db'
import { evidence } from '@/lib/db/schema/evidence'
import { eq, and } from 'drizzle-orm'
import { AdaptiveCard } from '@/lib/teams/bot'
import { createEvidenceResultCard } from '@/lib/teams/bot'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function lookupEvidence(evidenceId: string, orgId: string) {
  // The eq(evidence.organizationId, orgId) clause is load-bearing for C7.
  // Removing it would let a Teams user in tenant A approve evidence in tenant B.
  const rows = await db
    .select()
    .from(evidence)
    .where(and(eq(evidence.id, evidenceId), eq(evidence.organizationId, orgId)))
    .limit(1)
  return rows[0] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Approve
// ─────────────────────────────────────────────────────────────────────────────

export async function handleApproveEvidence(
  evidenceId: string,
  orgId: string,
  _approvedByTeams: boolean = true
): Promise<{
  ok: boolean
  message: string
  updatedCard?: AdaptiveCard
}> {
  const record = await lookupEvidence(evidenceId, orgId)
  if (!record) {
    return { ok: false, message: 'Evidence not found or does not belong to this organization.' }
  }

  if (record.status === 'approved') {
    return {
      ok: false,
      message: 'Evidence is already approved.',
      updatedCard: createEvidenceResultCard(
        { id: record.id, title: record.title, controlTitle: 'Control' },
        'approved'
      ),
    }
  }

  const now = new Date()
  await db
    .update(evidence)
    .set({
      status: 'approved',
      reviewedAt: now,
      reviewedBy: null, // no user UUID — approved via Teams bot
      reviewNotes: 'Approved via Microsoft Teams bot',
      updatedAt: now,
    })
    .where(eq(evidence.id, evidenceId))

  const updatedCard = createEvidenceResultCard(
    { id: record.id, title: record.title, controlTitle: record.description ?? 'Control' },
    'approved'
  )

  return { ok: true, message: 'Evidence approved successfully.', updatedCard }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reject
// ─────────────────────────────────────────────────────────────────────────────

export async function handleRejectEvidence(
  evidenceId: string,
  orgId: string
): Promise<{
  ok: boolean
  message: string
  updatedCard?: AdaptiveCard
}> {
  const record = await lookupEvidence(evidenceId, orgId)
  if (!record) {
    return { ok: false, message: 'Evidence not found or does not belong to this organization.' }
  }

  if (record.status === 'rejected') {
    return {
      ok: false,
      message: 'Evidence is already rejected.',
      updatedCard: createEvidenceResultCard(
        { id: record.id, title: record.title, controlTitle: 'Control' },
        'rejected'
      ),
    }
  }

  const now = new Date()
  await db
    .update(evidence)
    .set({
      status: 'rejected',
      reviewedAt: now,
      reviewedBy: null,
      reviewNotes: 'Rejected via Microsoft Teams bot',
      updatedAt: now,
    })
    .where(eq(evidence.id, evidenceId))

  const updatedCard = createEvidenceResultCard(
    { id: record.id, title: record.title, controlTitle: record.description ?? 'Control' },
    'rejected'
  )

  return { ok: true, message: 'Evidence rejected.', updatedCard }
}
