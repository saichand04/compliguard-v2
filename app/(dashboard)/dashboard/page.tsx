import { getSession } from '@/lib/auth/jwt'
import { redirect } from 'next/navigation'
import { FrameworkProgressCard } from '@/components/dashboard/framework-progress-card'
import { DraggableStatsGrid } from '@/components/dashboard/draggable-stats-grid'
import { MyTasksWidget } from '@/components/dashboard/my-tasks-widget'
import createDynamic from 'next/dynamic'
import {
  Shield, CheckSquare, AlertTriangle, FileText,
  Link2, Activity, ArrowRight,
  Zap, GitBranch, ChevronRight,
} from 'lucide-react'

// Lazy-load XDRTicker — won't fail if XDR API is unavailable
const XDRTicker = createDynamic(
  () => import('@/components/dashboard/xdr-ticker').then((m) => ({ default: m.XDRTicker })),
  { ssr: false, loading: () => null },
)

// Lazy-load TeamsStatusWidget — non-critical, SSR disabled
const TeamsStatusWidget = createDynamic(
  () => import('@/components/dashboard/teams-status-widget').then((m) => ({ default: m.TeamsStatusWidget })),
  { ssr: false, loading: () => null },
)

export const dynamic = 'force-dynamic'

// ── Demo data (replaced by real DB queries once DB is connected) ──
// Use iconName strings (not components) so these are safe to pass to a Client Component
const STATS = [
  { title: 'Compliance Score',  value: '84%',  subtitle: 'Across all frameworks',   trend: { value: 3.2, label: 'vs last month' }, iconName: 'TrendingUp',    accentColor: 'violet'  as const },
  { title: 'Active Controls',   value: '1,247',subtitle: '312 need evidence',        trend: { value: 1.8, label: 'vs last week' },  iconName: 'CheckSquare',   accentColor: 'cyan'    as const },
  { title: 'Open Risks',        value: '23',   subtitle: '5 critical, 18 medium',   trend: { value: -2,  label: 'vs last week' },  iconName: 'AlertTriangle', accentColor: 'amber'   as const },
  { title: 'Evidence Items',    value: '4,891',subtitle: '143 pending review',       trend: { value: 7.1, label: 'this week' },     iconName: 'FileText',      accentColor: 'emerald' as const },
]

const FRAMEWORKS = [
  { name: 'NIST 800-53 Rev 5',  shortName: 'NIST',    progress: 78, totalControls: 1189, completedControls: 928,  dueDate: 'Jun 30, 2026', status: 'on-track' as const },
  { name: 'HITRUST CSF v11',    shortName: 'HITRUST', progress: 62, totalControls: 833,  completedControls: 516,  dueDate: 'Aug 15, 2026', status: 'on-track' as const },
  { name: 'ARC-AMPE v2',        shortName: 'ARC',     progress: 41, totalControls: 540,  completedControls: 221,  dueDate: 'May 31, 2026', status: 'at-risk' as const },
  { name: 'NIST CSF 2.0',       shortName: 'CSF',     progress: 91, totalControls: 106,  completedControls: 97,   dueDate: 'Mar 1, 2026',  status: 'complete' as const },
  { name: 'SOC 2 Type II',      shortName: 'SOC2',    progress: 55, totalControls: 64,   completedControls: 35,   dueDate: 'Apr 30, 2026', status: 'overdue' as const },
  { name: 'ISO 27001:2022',     shortName: 'ISO27K',  progress: 70, totalControls: 93,   completedControls: 65,   dueDate: 'Sep 1, 2026',  status: 'on-track' as const },
]

const RECENT_ACTIVITY = [
  { action: 'Evidence approved',       subject: 'AC-2 Access Management',              user: 'S. Palla',   time: '12m ago',  color: 'var(--emerald)' },
  { action: 'Control mapping created', subject: 'HITRUST 0201.09j → NIST AC-2',        user: 'AI Engine',  time: '1h ago',   color: 'var(--violet)' },
  { action: 'Risk escalated',          subject: 'Data Exposure — High Severity',        user: 'J. Sharma',  time: '2h ago',   color: 'var(--rose)' },
  { action: 'Framework uploaded',      subject: 'ARC-AMPE v2 xlsx ingested',           user: 'S. Palla',   time: '3h ago',   color: 'var(--cyan)' },
  { action: 'Policy published',        subject: 'Information Security Policy v3.1',    user: 'A. Martin',  time: '5h ago',   color: 'var(--amber)' },
  { action: 'Task completed',          subject: 'Annual access review — Q1 2026',      user: 'K. Torres',  time: '1d ago',   color: 'var(--emerald)' },
]

const MAPPING_STATS = {
  totalMappings: 3412,
  autoMapped: 2918,
  pendingReview: 312,
  conflicts: 18,
}

export default async function DashboardPage() {
  let session
  try { session = await getSession() } catch { redirect('/signin') }
  if (!session) redirect('/signin')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Page header ──────────────────────────────────── */}
      <div className="animate-fade-up" style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: 4,
        }}>
          {greeting}, <span className="text-gradient-violet">{session.firstName || 'there'}</span>
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
          Here's your compliance posture as of today, {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── KPI Stats row — draggable ───────────────────── */}
      <DraggableStatsGrid stats={STATS} />

      {/* ── Main content grid ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 20 }}>

        {/* Framework progress */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
              Framework Progress
            </h2>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {FRAMEWORKS.map((fw, i) => (
              <FrameworkProgressCard key={i} {...fw} delay={i * 50 + 100} />
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* AI Mapping Engine panel */}
          <div className="glass-card animate-fade-up delay-100" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{
                width: 28, height: 28,
                background: 'var(--violet-dim)',
                border: '1px solid rgba(139,92,246,0.30)',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap size={13} style={{ color: 'var(--violet)' }} />
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                Mapping Engine
              </span>
              <span style={{
                marginLeft: 'auto',
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 99,
                background: 'var(--emerald-dim)',
                color: 'var(--emerald)',
                border: '1px solid rgba(16,185,129,0.25)',
              }}>
                ACTIVE
              </span>
            </div>

            {[
              { label: 'Total Mappings',    value: MAPPING_STATS.totalMappings.toLocaleString(), color: 'var(--text-primary)' },
              { label: 'Auto-mapped',       value: MAPPING_STATS.autoMapped.toLocaleString(),    color: 'var(--emerald)' },
              { label: 'Pending Review',    value: MAPPING_STATS.pendingReview,                  color: 'var(--amber)' },
              { label: 'Conflicts',         value: MAPPING_STATS.conflicts,                      color: 'var(--rose)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center',
                padding: '7px 0',
                borderBottom: '1px solid var(--border-glass)',
              }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color }}>{value}</span>
              </div>
            ))}

            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: 14, fontSize: 12.5, padding: '8px 14px' }}
            >
              <Link2 size={13} />
              Review Pending Mappings
            </button>
          </div>

          {/* Recent activity */}
          <div className="glass-card animate-fade-up delay-150" style={{ padding: '16px 18px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Activity size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Activity
                </span>
              </div>
              <button style={{ fontSize: 11.5, color: 'var(--violet)', background: 'none', border: 'none', cursor: 'pointer' }}>
                View all
              </button>
            </div>

            {RECENT_ACTIVITY.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: i < RECENT_ACTIVITY.length - 1 ? '1px solid var(--border-glass)' : 'none',
                  cursor: 'pointer',
                  transition: 'opacity 0.12s',
                }}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: item.color,
                  boxShadow: `0 0 5px ${item.color}`,
                  marginTop: 5, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 1 }}>
                    {item.action}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.subject}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{item.time}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{item.user}</div>
                </div>
              </div>
            ))}
          </div>

          {/* My Tasks widget */}
          <MyTasksWidget />

          {/* XDR Live Alert Ticker — lazy loaded, fails silently if not configured */}
          <XDRTicker />

          {/* Teams Bot Status Widget — lazy loaded */}
          <TeamsStatusWidget />

        </div>
      </div>

      {/* ── Bottom: Quick actions row ──────────────────────── */}
      <div className="animate-fade-up delay-200" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 10,
      }}>
        {[
          { icon: Shield,      label: 'Add Framework',    desc: 'Upload or select',   color: 'var(--violet)',  href: '/frameworks' },
          { icon: FileText,    label: 'Submit Evidence',  desc: 'Attach & classify',  color: 'var(--cyan)',    href: '/evidence' },
          { icon: AlertTriangle, label: 'Log Risk',       desc: 'Record & assess',    color: 'var(--amber)',   href: '/risks' },
          { icon: Link2,       label: 'Map Controls',     desc: 'Cross-framework',    color: 'var(--emerald)', href: '/control-mapping' },
          { icon: GitBranch,   label: 'Integrations',     desc: 'Connect data sources',color: 'var(--rose)',   href: '/integrations' },
        ].map(({ icon: Icon, label, desc, color, href }) => (
          <a
            key={href}
            href={href}
            className="glass-card"
            style={{
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
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
  )
}
