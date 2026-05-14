import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { sql } from 'drizzle-orm'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const executeSchema = z.object({
  confirmPhrase: z.literal('RESET PLATFORM'),
  password: z.string().min(1),
})

/**
 * POST /api/admin/reset/execute
 * Wipes all org data. Requires:
 *   1. super_admin role
 *   2. confirmPhrase === 'RESET PLATFORM'
 *   3. valid password re-entry
 *
 * Preserved: the super_admin user account, system_settings, organizations row.
 * Everything else for the org is deleted via cascading DELETEs on org tables.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'super_admin') return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  let body: unknown
  try { body = await req.json() } catch { return ApiErrors.badRequest('Invalid JSON') }

  const result = executeSchema.safeParse(body)
  if (!result.success) {
    return ApiErrors.badRequest(result.error.issues[0].message)
  }

  // Step 3 — verify password against the calling user's stored hash
  const [userRecord] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)

  if (!userRecord?.passwordHash) return ApiErrors.unauthorized()

  const passwordValid = await bcrypt.compare(result.data.password, userRecord.passwordHash)
  if (!passwordValid) {
    return NextResponse.json({ error: 'Incorrect password. Reset aborted.' }, { status: 403 })
  }

  const orgId = session.orgId

  // ── Execute deletion in dependency order ───────────────────────────────────
  // Child tables first, then parents. Using raw SQL for speed and to avoid
  // Drizzle ORM type-casting overhead on bulk deletes.
  // All scoped to organization_id so only this org's data is touched.
  // The super_admin user row, organizations row, and system_settings are preserved.
  try {
    await db.transaction(async (tx) => {
      // Pentest
      await tx.execute(sql`DELETE FROM pentest_comments   WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM pentest_evidence   WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM pentest_issues     WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM pentest_engagements WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM pentest_sessions   WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM pentest_credits    WHERE organization_id = ${orgId}`)

      // Firewall
      await tx.execute(sql`DELETE FROM firewall_comments  WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM firewall_evidence  WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM firewall_findings  WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM firewall_audits    WHERE organization_id = ${orgId}`)

      // DNS
      await tx.execute(sql`DELETE FROM dns_comments       WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM dns_evidence       WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM dns_issues         WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM dns_audits         WHERE organization_id = ${orgId}`)

      // Evidence
      await tx.execute(sql`DELETE FROM evidence_upload_tokens WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM evidence_requests  WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM evidence_forms     WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM evidence           WHERE organization_id = ${orgId}`)

      // Findings & comments
      await tx.execute(sql`DELETE FROM comment_mentions   WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM comments           WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM findings           WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM finding_templates  WHERE organization_id = ${orgId}`)

      // Risks
      await tx.execute(sql`DELETE FROM risk_assessments   WHERE organization_id = ${orgId}`)

      // Tasks
      await tx.execute(sql`DELETE FROM task_automation    WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM tasks              WHERE organization_id = ${orgId}`)

      // Vendors
      await tx.execute(sql`DELETE FROM vendor_risk_assessments WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM vendors            WHERE organization_id = ${orgId}`)

      // Policies
      await tx.execute(sql`DELETE FROM policies           WHERE organization_id = ${orgId}`)

      // Training & Knowledge Base
      await tx.execute(sql`DELETE FROM training_completions WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM background_checks   WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM training_modules   WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM knowledge_base_entries WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM teams_conversation_refs WHERE organization_id = ${orgId}`)

      // Frameworks & controls
      await tx.execute(sql`DELETE FROM soa_entries        WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM control_assignments WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM control_mappings   WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM mapping_suggestions WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM mapping_rules      WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM controls           WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM evidence_inheritance WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM organization_frameworks WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM framework_uploads  WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM frameworks         WHERE organization_id = ${orgId}`)

      // Integrations & scan results
      await tx.execute(sql`DELETE FROM integration_scan_results WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM nl_test_results    WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM nl_tests           WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM integrations       WHERE organization_id = ${orgId}`)

      // Webhooks
      await tx.execute(sql`DELETE FROM webhook_deliveries WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM webhooks           WHERE organization_id = ${orgId}`)

      // Org chart
      await tx.execute(sql`DELETE FROM org_chart_nodes    WHERE organization_id = ${orgId}`)

      // Context hub
      await tx.execute(sql`DELETE FROM context_hub        WHERE organization_id = ${orgId}`)

      // Notifications
      await tx.execute(sql`DELETE FROM notifications      WHERE organization_id = ${orgId}`)

      // Questionnaires
      await tx.execute(sql`DELETE FROM questionnaire_responses WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM questionnaire_questions WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM questionnaires      WHERE organization_id = ${orgId}`)

      // Timelines
      await tx.execute(sql`DELETE FROM timeline_phases    WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM timelines          WHERE organization_id = ${orgId}`)

      // API & MCP keys
      await tx.execute(sql`DELETE FROM mcp_api_keys       WHERE organization_id = ${orgId}`)
      await tx.execute(sql`DELETE FROM api_keys           WHERE organization_id = ${orgId}`)

      // Non-admin users — preserve the calling super_admin
      await tx.execute(sql`
        DELETE FROM users
        WHERE organization_id = ${orgId}
          AND id != ${session.userId}
          AND role != 'super_admin'
      `)

      // Module config — reset to defaults (delete so it re-reads defaults)
      await tx.execute(sql`DELETE FROM module_config WHERE organization_id = ${orgId}`)

      // Audit logs — clear org history (last so the reset itself can be logged after)
      await tx.execute(sql`DELETE FROM audit_logs WHERE organization_id = ${orgId}`)
    })
  } catch (err) {
    console.error('[master-reset] transaction failed:', err)
    return NextResponse.json(
      { error: 'Reset transaction failed. No data was deleted. Check server logs.' },
      { status: 500 }
    )
  }

  // Write a single fresh audit log entry documenting the reset
  try {
    await db.execute(sql`
      INSERT INTO audit_logs (id, organization_id, user_id, action, resource_type, description, created_at)
      VALUES (
        gen_random_uuid(),
        ${orgId},
        ${session.userId},
        'platform.master_reset',
        'platform',
        'Master reset executed — all org data cleared by super admin',
        NOW()
      )
    `)
  } catch { /* non-fatal — reset already completed */ }

  return NextResponse.json({ success: true, message: 'Platform data cleared successfully.' })
}
