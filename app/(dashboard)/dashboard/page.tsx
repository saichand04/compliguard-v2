import { getSession } from '@/lib/auth/jwt'
import { db } from '@/lib/db'
import { controlAssignments, auditLogs, tasks, organizations, organizationFrameworks, frameworks, controls } from '@/lib/db/schema'
import { eq, and, gte, count, desc } from 'drizzle-orm'
import { StatsCard } from '@/components/dashboard/stats-card'
import { FrameworkProgressCard } from '@/components/dashboard/framework-progress-card'
import { CheckSquare, AlertCircle, Clock, XCircle, ShieldCheck, Activity } from 'lucide-react'
import { redirect } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session || !session.orgId) redirect('/auth/signin')

  const orgId = session.orgId

  // Fetch control status counts
  const statusCounts = await db
    .select({ status: controlAssignments.status, count: count() })
    .from(controlAssignments)
    .where(eq(controlAssignments.organizationId, orgId))
    .groupBy(controlAssignments.status)

  const counts: Record<string, number> = {}
  for (const row of statusCounts) {
    counts[row.status] = row.count
  }

  const totalControls = Object.values(counts).reduce((a, b) => a + b, 0)
  const implemented = counts['implemented'] || 0
  const inProgress = counts['in_progress'] || 0
  const notStarted = counts['not_started'] || 0
  const needsReview = counts['needs_review'] || 0

  // Fetch active frameworks with progress
  const orgFrameworks = await db
    .select({ frameworkId: organizationFrameworks.frameworkId })
    .from(organizationFrameworks)
    .where(and(eq(organizationFrameworks.organizationId, orgId), eq(organizationFrameworks.isActive, true)))
    .limit(6)

  const frameworkProgress = await Promise.all(
    orgFrameworks.map(async (of) => {
      const [fw] = await db.select().from(frameworks).where(eq(frameworks.id, of.frameworkId)).limit(1)
      if (!fw) return null

      const [totalRow] = await db
        .select({ count: count() })
        .from(controlAssignments)
        .innerJoin(controls, eq(controls.id, controlAssignments.controlId))
        .where(and(eq(controlAssignments.organizationId, orgId), eq(controls.frameworkId, fw.id)))

      const [implRow] = await db
        .select({ count: count() })
        .from(controlAssignments)
        .innerJoin(controls, eq(controls.id, controlAssignments.controlId))
        .where(and(
          eq(controlAssignments.organizationId, orgId),
          eq(controls.frameworkId, fw.id),
          eq(controlAssignments.status, 'implemented')
        ))

      return {
        id: fw.id,
        name: fw.name,
        shortName: fw.shortName || fw.name,
        totalControls: totalRow?.count || 0,
        implementedControls: implRow?.count || 0,
      }
    })
  )

  // Recent audit logs
  const recentActivity = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, orgId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(5)

  // My tasks due this week
  const weekFromNow = new Date()
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  const myTasks = await db
    .select()
    .from(tasks)
    .where(and(
      eq(tasks.organizationId, orgId),
      eq(tasks.assignedTo, session.userId),
      gte(tasks.dueDate, new Date())
    ))
    .orderBy(tasks.dueDate)
    .limit(5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Your compliance overview</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard label="Total Controls" value={totalControls} icon={CheckSquare} colorClass="text-slate-600" />
        <StatsCard label="Implemented" value={implemented} icon={ShieldCheck} colorClass="text-green-600" />
        <StatsCard label="In Progress" value={inProgress} icon={Clock} colorClass="text-blue-600" />
        <StatsCard label="Needs Review" value={needsReview} icon={AlertCircle} colorClass="text-amber-600" />
        <StatsCard label="Not Started" value={notStarted} icon={XCircle} colorClass="text-slate-400" />
        <StatsCard
          label="Implementation"
          value={totalControls > 0 ? `${Math.round((implemented / totalControls) * 100)}%` : '0%'}
          icon={Activity}
          colorClass="text-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Framework progress */}
        <div className="lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Framework Progress</h2>
          {frameworkProgress.filter(Boolean).length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
              <p className="text-slate-400 text-sm">No frameworks activated yet.</p>
              <a href="/frameworks" className="text-blue-600 text-sm hover:underline mt-2 inline-block">Browse frameworks →</a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {frameworkProgress.filter(Boolean).map((fw) => fw && (
                <FrameworkProgressCard
                  key={fw.id}
                  name={fw.name}
                  shortName={fw.shortName}
                  totalControls={fw.totalControls}
                  implementedControls={fw.implementedControls}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* My tasks */}
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">My Tasks This Week</h2>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {myTasks.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">No tasks due this week 🎉</div>
              ) : (
                myTasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 p-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                      task.priority === 'urgent' ? 'bg-red-500' :
                      task.priority === 'high' ? 'bg-amber-500' :
                      task.priority === 'medium' ? 'bg-blue-500' : 'bg-slate-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 dark:text-white truncate">{task.title}</p>
                      {task.dueDate && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Due {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Recent Activity</h2>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {recentActivity.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">No activity yet</div>
              ) : (
                recentActivity.map((log) => (
                  <div key={log.id} className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <p className="text-xs text-slate-700 dark:text-slate-300">{log.description || log.action}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
