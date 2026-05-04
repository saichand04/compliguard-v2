'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Clock, AlertCircle, CheckSquare } from 'lucide-react'

type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

interface Task {
  id: string
  title: string
  priority: TaskPriority
  status: string
  dueDate?: string | Date | null
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgent', color: '#ef4444', bg: 'rgba(239,68,68,0.14)' },
  high:   { label: 'High',   color: '#f97316', bg: 'rgba(249,115,22,0.14)' },
  medium: { label: 'Medium', color: '#eab308', bg: 'rgba(234,179,8,0.14)' },
  low:    { label: 'Low',    color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
}

function formatDueDate(dueDate: string | Date | null | undefined): { label: string; overdue: boolean } | null {
  if (!dueDate) return null
  const d = new Date(dueDate)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  const overdue = d < now
  return {
    label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    overdue,
  }
}

export function MyTasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        // Get current user id from session
        const sessionRes = await fetch('/api/auth/session')
        if (!sessionRes.ok) return

        const sessionData = await sessionRes.json()
        const userId = sessionData.user?.id
        if (!userId) return

        // Fetch tasks assigned to current user
        const tasksRes = await fetch(`/api/tasks?assignee=${userId}`)
        if (!tasksRes.ok) return

        const tasksData = await tasksRes.json()
        const myTasks: Task[] = (tasksData.tasks ?? [])
          .filter((t: Task) => t.status === 'todo' || t.status === 'in_progress')
          .slice(0, 5)

        setTasks(myTasks)
      } catch {
        // Fail silently — widget is non-critical
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div
      className="glass-card animate-fade-up delay-200"
      style={{ padding: '16px 18px', marginTop: 16 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28,
            background: 'var(--violet-dim)',
            border: '1px solid rgba(139,92,246,0.30)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckSquare size={13} style={{ color: 'var(--violet)' }} />
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
            My Tasks
          </span>
        </div>
        <Link
          href="/tasks"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11.5,
            color: 'var(--violet)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          View all <ArrowRight size={11} />
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
          <div style={{ width: 12, height: 12, border: '2px solid var(--violet)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading…
        </div>
      ) : tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
          No open tasks assigned to you
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {tasks.map((task, i) => {
            const priority = PRIORITY_CONFIG[task.priority as TaskPriority] ?? PRIORITY_CONFIG.medium
            const due = formatDueDate(task.dueDate)

            return (
              <Link
                key={task.id}
                href="/tasks"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: i < tasks.length - 1 ? '1px solid var(--border-glass)' : 'none',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                {/* Priority dot */}
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: priority.color,
                  flexShrink: 0,
                  boxShadow: `0 0 5px ${priority.color}`,
                }} />

                {/* Task info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {task.title}
                  </div>
                  {due && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      marginTop: 2,
                      fontSize: 11,
                      color: due.overdue ? '#f87171' : 'var(--text-muted)',
                      fontWeight: due.overdue ? 600 : 400,
                    }}>
                      <Clock size={9} />
                      {due.label}
                      {due.overdue && <AlertCircle size={9} />}
                    </div>
                  )}
                </div>

                {/* Priority badge */}
                <span style={{
                  flexShrink: 0,
                  background: priority.bg,
                  color: priority.color,
                  border: `1px solid ${priority.color}30`,
                  borderRadius: 99,
                  padding: '2px 7px',
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}>
                  {priority.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
