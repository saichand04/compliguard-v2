import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'
import { sql } from 'drizzle-orm'

/**
 * GET /api/admin/reset/preview
 * Returns live row counts for all data categories that will be wiped
 * on a master reset. Super admin only.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()
  if (session.role !== 'super_admin') return ApiErrors.forbidden()
  if (!session.orgId) return ApiErrors.forbidden()

  const orgId = session.orgId

  // Run all counts in parallel
  const [
    frameworks, controls, evidence, findings, risks,
    tasks, vendors, policies, pentest, firewall,
    dns, users, integrations, auditLogs,
    trainingModules, knowledgeBase,
  ] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) FROM frameworks WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM controls WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM evidence WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM findings WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM risk_assessments WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM tasks WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM vendors WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM policies WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM pentest_engagements WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM firewall_audits WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM dns_audits WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM users WHERE organization_id = ${orgId} AND role != 'super_admin'`),
    db.execute(sql`SELECT COUNT(*) FROM integrations WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM audit_logs WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM training_modules WHERE organization_id = ${orgId}`),
    db.execute(sql`SELECT COUNT(*) FROM knowledge_base_entries WHERE organization_id = ${orgId}`),
  ])

  const count = (r: { rows: unknown[] }) => Number((r.rows[0] as Record<string, unknown>)?.count ?? 0)

  const categories = [
    { key: 'frameworks',      label: 'Frameworks & Controls',    count: count(frameworks) + count(controls),  icon: 'shield' },
    { key: 'evidence',        label: 'Evidence & Uploads',        count: count(evidence),                      icon: 'file' },
    { key: 'findings',        label: 'Findings',                  count: count(findings),                      icon: 'alert' },
    { key: 'risks',           label: 'Risk Assessments',          count: count(risks),                         icon: 'alert-triangle' },
    { key: 'tasks',           label: 'Tasks',                     count: count(tasks),                         icon: 'check-square' },
    { key: 'vendors',         label: 'Vendors',                   count: count(vendors),                       icon: 'building' },
    { key: 'policies',        label: 'Policies',                  count: count(policies),                      icon: 'book' },
    { key: 'pentest',         label: 'Pentest Engagements',       count: count(pentest),                       icon: 'target' },
    { key: 'firewall',        label: 'Firewall Audits',           count: count(firewall),                      icon: 'server' },
    { key: 'dns',             label: 'DNS Audits',                count: count(dns),                           icon: 'globe' },
    { key: 'users',           label: 'Non-admin Users',           count: count(users),                         icon: 'users' },
    { key: 'integrations',    label: 'Integrations',              count: count(integrations),                  icon: 'plug' },
    { key: 'training',        label: 'Training Modules',          count: count(trainingModules),               icon: 'graduation-cap' },
    { key: 'knowledge',       label: 'Knowledge Base',            count: count(knowledgeBase),                 icon: 'database' },
    { key: 'auditLogs',       label: 'Audit Logs',                count: count(auditLogs),                     icon: 'activity' },
  ]

  const totalRows = categories.reduce((sum, c) => sum + c.count, 0)

  return NextResponse.json({ categories, totalRows })
}
