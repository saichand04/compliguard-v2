import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { timelines, timelinePhases } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, ApiErrors } from '@/lib/api/auth-helper'

// Built-in compliance journey templates
const BUILT_IN_TEMPLATES = [
  {
    id: 'builtin-soc2',
    title: 'SOC 2 Type II Journey',
    description: 'Complete SOC 2 Type II readiness program across 12 months',
    frameworkSlug: 'soc2',
    isBuiltIn: true,
    phases: [
      { title: 'Scoping & Gap Assessment', description: 'Define audit scope and perform initial gap analysis', durationMonths: 1, status: 'pending', orderIndex: 0 },
      { title: 'Policy & Procedure Development', description: 'Draft and approve required policies and procedures', durationMonths: 2, status: 'pending', orderIndex: 1 },
      { title: 'Control Implementation', description: 'Implement technical and operational controls', durationMonths: 3, status: 'pending', orderIndex: 2 },
      { title: 'Observation Period', description: '6-month evidence collection window (Type II requirement)', durationMonths: 6, status: 'pending', orderIndex: 3 },
      { title: 'Readiness Assessment', description: 'Internal readiness review and remediation', durationMonths: 1, status: 'pending', orderIndex: 4 },
      { title: 'External Audit', description: 'Formal SOC 2 Type II audit by licensed CPA firm', durationMonths: 1, status: 'pending', orderIndex: 5 },
    ],
  },
  {
    id: 'builtin-iso27001',
    title: 'ISO 27001 Certification',
    description: 'ISO/IEC 27001:2022 certification program across 18 months',
    frameworkSlug: 'iso27001',
    isBuiltIn: true,
    phases: [
      { title: 'Context & Scope Definition', description: 'Define ISMS scope, interested parties, and organizational context', durationMonths: 1, status: 'pending', orderIndex: 0 },
      { title: 'Risk Assessment & Treatment', description: 'Conduct information security risk assessment and produce risk treatment plan', durationMonths: 3, status: 'pending', orderIndex: 1 },
      { title: 'Control Implementation', description: 'Implement Annex A controls and ISMS processes', durationMonths: 6, status: 'pending', orderIndex: 2 },
      { title: 'Internal Audit', description: 'Conduct internal ISMS audit and management review', durationMonths: 2, status: 'pending', orderIndex: 3 },
      { title: 'Certification Audit Stage 1', description: 'Documentation review by certification body', durationMonths: 1, status: 'pending', orderIndex: 4 },
      { title: 'Certification Audit Stage 2', description: 'On-site audit and certification decision', durationMonths: 2, status: 'pending', orderIndex: 5 },
    ],
  },
  {
    id: 'builtin-hipaa',
    title: 'HIPAA Compliance Program',
    description: 'HIPAA Security Rule compliance program across 9 months',
    frameworkSlug: 'hipaa',
    isBuiltIn: true,
    phases: [
      { title: 'Risk Analysis', description: 'Required HIPAA Security Rule risk analysis of ePHI', durationMonths: 2, status: 'pending', orderIndex: 0 },
      { title: 'Policies & Training', description: 'Develop HIPAA policies and complete workforce training', durationMonths: 2, status: 'pending', orderIndex: 1 },
      { title: 'Technical Safeguards', description: 'Implement access controls, audit controls, and encryption', durationMonths: 3, status: 'pending', orderIndex: 2 },
      { title: 'Attestation & Review', description: 'Annual review, BAA review, and compliance attestation', durationMonths: 2, status: 'pending', orderIndex: 3 },
    ],
  },
]

/**
 * GET /api/timelines/templates
 * Returns built-in templates + org-specific custom templates.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req)
  if (!session) return ApiErrors.unauthorized()

  const orgId = session.orgId
  if (!orgId) return ApiErrors.forbidden()

  // Fetch org-specific custom templates
  const customTemplates = await db
    .select()
    .from(timelines)
    .where(and(eq(timelines.organizationId, orgId), eq(timelines.isTemplate, true)))

  // Attach phases to custom templates
  const customWithPhases = await Promise.all(
    customTemplates.map(async (tl) => {
      const phases = await db
        .select()
        .from(timelinePhases)
        .where(eq(timelinePhases.timelineId, tl.id))
        .orderBy(timelinePhases.orderIndex)
      return { ...tl, phases, isBuiltIn: false }
    })
  )

  return NextResponse.json({
    builtIn: BUILT_IN_TEMPLATES,
    custom: customWithPhases,
    all: [...BUILT_IN_TEMPLATES, ...customWithPhases],
  })
}
