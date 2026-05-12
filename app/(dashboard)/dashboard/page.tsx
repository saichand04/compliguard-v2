import { getSession } from '@/lib/auth/jwt'
import { redirect } from 'next/navigation'
import { FrameworkProgressCard } from '@/components/dashboard/framework-progress-card'
import { DraggableStatsGrid } from '@/components/dashboard/draggable-stats-grid'
import { ControlsOverlapCards } from '@/components/dashboard/controls-overlap-cards'
import { RightPanelManager } from '@/components/dashboard/right-panel-manager'
import { db } from '@/lib/db'
import { pentestIssues } from '@/lib/db/schema'
import { eq, sql, count } from 'drizzle-orm'
import {
  Shield, FileText, AlertTriangle, Link2, ArrowRight, ChevronRight,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getPentestStats(orgId: string) {
  try {
    const [stats] = await db
      .select({
        total: count(),
        open: sql<number>`count(*) filter (where ${pentestIssues.status} = 'open')`,
        critical: sql<number>`count(*) filter (where ${pentestIssues.severity} = 'critical')`,
      })
      .from(pentestIssues)
      .where(eq(pentestIssues.organizationId, orgId))
    return { total: Number(stats?.total ?? 0), open: Number(stats?.open ?? 0), critical: Number(stats?.critical ?? 0) }
  } catch { return { total: 0, open: 0, critical: 0 } }
}

// ── Demo data — replace with real DB queries ──────────────────────────────────

const BASE_STATS = [
  { title: 'Compliance Score',  value: '84%',   subtitle: 'Across all frameworks',  trend: { value: 3.2,  label: 'vs last month' }, iconName: 'TrendingUp',    accentColor: 'violet'  as const },
  { title: 'Active Controls',   value: '1,247', subtitle: '312 need evidence',       trend: { value: 1.8,  label: 'vs last week'  }, iconName: 'CheckSquare',   accentColor: 'cyan'    as const },
  { title: 'Open Risks',        value: '23',    subtitle: '5 critical, 18 medium',  trend: { value: -2,   label: 'vs last week'  }, iconName: 'AlertTriangle', accentColor: 'amber'   as const },
  { title: 'Evidence Items',    value: '4,891', subtitle: '143 pending review',      trend: { value: 7.1,  label: 'this week'     }, iconName: 'FileText',      accentColor: 'emerald' as const },
]

const FRAMEWORKS = [
  { name: 'NIST 800-53 Rev 5', shortName: 'NIST',    progress: 78, totalControls: 1189, completedControls: 928,  dueDate: 'Jun 30, 2026', status: 'on-track'  as const },
  { name: 'HITRUST CSF v11',   shortName: 'HITRUST', progress: 62, totalControls: 833,  completedControls: 516,  dueDate: 'Aug 15, 2026', status: 'on-track'  as const },
  { name: 'ARC-AMPE v2',       shortName: 'ARC',     progress: 41, totalControls: 540,  completedControls: 221,  dueDate: 'May 31, 2026', status: 'at-risk'   as const },
  { name: 'NIST CSF 2.0',      shortName: 'CSF',     progress: 91, totalControls: 106,  completedControls: 97,   dueDate: 'Mar 1, 2026',  status: 'complete'  as const },
  { name: 'SOC 2 Type II',     shortName: 'SOC2',    progress: 55, totalControls: 64,   completedControls: 35,   dueDate: 'Apr 30, 2026', status: 'overdue'   as const },
  { name: 'ISO 27001:2022',    shortName: 'ISO27K',  progress: 70, totalControls: 93,   completedControls: 65,   dueDate: 'Sep 1, 2026',  status: 'on-track'  as const },
]

const RECENT_ACTIVITY = [
  { action: 'Evidence approved',       subject: 'AC-2 Access Management',           user: 'S. Palla',  time: '12m ago', color: 'var(--emerald)' },
  { action: 'Control mapping created', subject: 'HITRUST 0201.09j → NIST AC-2',     user: 'AI Engine', time: '1h ago',  color: 'var(--violet)'  },
  { action: 'Risk escalated',          subject: 'Data Exposure — High Severity',     user: 'J. Sharma', time: '2h ago',  color: 'var(--rose)'    },
  { action: 'Framework uploaded',      subject: 'ARC-AMPE v2 xlsx ingested',        user: 'S. Palla',  time: '3h ago',  color: 'var(--cyan)'    },
  { action: 'Policy published',        subject: 'Information Security Policy v3.1', user: 'A. Martin', time: '5h ago',  color: 'var(--amber)'   },
  { action: 'Task completed',          subject: 'Annual access review — Q1 2026',   user: 'K. Torres', time: '1d ago',  color: 'var(--emerald)' },
]

const MAPPING_STATS = { totalMappings: 3412, autoMapped: 2918, pendingReview: 312, conflicts: 18 }

// Quick actions — Integrations removed from bottom bar per spec
const QUICK_ACTIONS = [
  { icon: Shield,        label: 'Add Framework',   desc: 'Upload or select',   color: 'var(--violet)',  href: '/frameworks'      },
  { icon: FileText,      label: 'Submit Evidence', desc: 'Attach & classify',  color: 'var(--cyan)',    href: '/evidence'        },
  { icon: AlertTriangle, label: 'Log Risk',         desc: 'Record & assess',   color: 'var(--amber)',   href: '/risks'           },
  { icon: Link2,         label: 'Map Controls',    desc: 'Cross-framework',    color: 'var(--emerald)', href: '/control-mapping' },
]

export default async function DashboardPage() {
  let session
  try { session = await getSession() } catch { redirect('/signin') }
  if (!session) redirect('/signin')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  // Live pentest stats
  const pt = await getPentestStats(session.orgId ?? '')
  const STATS = [
    ...BASE_STATS,
    {
      title: 'Pentest Issues',
      value: String(pt.total),
      subtitle: `${pt.open} open · ${pt.critical} critical`,
      trend: { value: pt.open, label: pt.open > 0 ? 'need attention' : 'all clear' },
      iconName: 'Target',
      accentColor: 'rose' as const,
    },
  ]

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Page header ─────────────────────────────────── */}
      <div className="animate-fade-up" style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
          {greeting}, <span className="text-gradient-violet">{session.firstName || 'there'}</span>
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
          Here&apos;s your compliance posture as of today,{' '}
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── KPI Stats row (draggable, 4 cards) ─────────── */}
      <DraggableStatsGrid stats={STATS} storageKey="cg_stats_order" />

      {/* ── Common + Unique Controls row ────────────────── */}
      <ControlsOverlapCards frameworks={FRAMEWORKS} />

      {/* ── Spacer ──────────────────────────────────────── */}
      <div style={{ height: 24 }} />

      {/* ── Main content grid ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 20 }}>

        {/* ── Left: Framework Progress + movable widget area */}
        <div>
          {/* Framework Progress */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
              Framework Progress
            </h2>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginBottom: 24 }}>
            {FRAMEWORKS.map((fw, i) => (
              <FrameworkProgressCard key={i} {...fw} delay={i * 50 + 100} />
            ))}
          </div>

          {/* ── Quick Actions (moved here from bottom, no Integrations) ── */}
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em', marginBottom: 12 }}>
            Quick Actions
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 10,
          }}>
            {QUICK_ACTIONS.map(({ icon: Icon, label, desc, color, href }) => (
              <a
                key={href}
                href={href}
                className="glass-card"
                style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', cursor: 'pointer' }}
              >
                <div style={{
                  width: 34, height: 34,
                  background: `${color}18`,
                  border: `1px solid ${color}30`,
                  borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{desc}</div>
                </div>
                <ChevronRight size={13} style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }} />
              </a>
            ))}
          </div>
        </div>

        {/* ── Right: chicklet-managed widget panel ─────── */}
        <RightPanelManager
          mappingStats={MAPPING_STATS}
          activityItems={RECENT_ACTIVITY}
        />
      </div>

    </div>
  )
}
