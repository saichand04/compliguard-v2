'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Plus, Filter, User, Tag, AlertCircle, Clock, ChevronDown } from 'lucide-react'
import { TaskModal, type Task } from '@/components/tasks/task-modal'

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

interface UserOption {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo',        label: 'Todo',        color: '#64748b' },
  { status: 'in_progress', label: 'In Progress',  color: '#06B6D4' },
  { status: 'done',        label: 'Done',         color: '#10b981' },
  { status: 'blocked',     label: 'Blocked',      color: '#ef4444' },
  { status: 'cancelled',   label: 'Cancelled',    color: '#475569' },
]

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgent', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  high:   { label: 'High',   color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  medium: { label: 'Medium', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  low:    { label: 'Low',    color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserLabel(u: UserOption) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ')
  return name || u.email
}

function getInitials(u: UserOption) {
  if (u.firstName && u.lastName) return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase()
  if (u.firstName) return u.firstName.slice(0, 2).toUpperCase()
  return u.email.slice(0, 2).toUpperCase()
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

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task
  users: UserOption[]
  onClick: () => void
  onDragStart: (e: React.DragEvent, taskId: string, fromStatus: TaskStatus) => void
}

function TaskCard({ task, users, onClick, onDragStart }: TaskCardProps) {
  const priority = PRIORITY_CONFIG[task.priority as TaskPriority]
  const assignee = task.assignedTo ? users.find((u) => u.id === task.assignedTo) : null
  const due = formatDueDate(task.dueDate)
  const labels = Array.isArray(task.labels) ? task.labels as string[] : []

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id, task.status as TaskStatus)}
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        borderRadius: 12,
        padding: '12px 14px',
        cursor: 'grab',
        transition: 'border-color 0.15s, transform 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'rgba(139,92,246,0.4)'
        el.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'rgba(255,255,255,0.08)'
        el.style.transform = 'translateY(0)'
      }}
    >
      {/* Priority badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: priority.bg,
          color: priority.color,
          border: `1px solid ${priority.color}35`,
          borderRadius: 99,
          padding: '2px 8px',
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: priority.color, display: 'inline-block' }} />
          {priority.label}
        </span>
        {assignee && (
          <div
            title={getUserLabel(assignee)}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--violet-dim)',
              border: '1px solid rgba(139,92,246,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 700,
              color: '#c4b5fd',
              flexShrink: 0,
            }}
          >
            {getInitials(assignee)}
          </div>
        )}
      </div>

      {/* Title */}
      <p style={{
        fontSize: 13,
        fontWeight: 500,
        color: task.status === 'cancelled' ? 'var(--text-muted)' : 'var(--text-primary)',
        lineHeight: 1.45,
        marginBottom: labels.length > 0 || due ? 8 : 0,
        textDecoration: task.status === 'cancelled' ? 'line-through' : 'none',
      }}>
        {task.title}
      </p>

      {/* Labels */}
      {labels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: due ? 8 : 0 }}>
          {labels.slice(0, 3).map((label) => (
            <span key={label} style={{
              background: 'rgba(6,182,212,0.12)',
              color: '#67e8f9',
              border: '1px solid rgba(6,182,212,0.2)',
              borderRadius: 99,
              padding: '1px 7px',
              fontSize: 10.5,
              fontWeight: 500,
            }}>
              {label}
            </span>
          ))}
          {labels.length > 3 && (
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', alignSelf: 'center' }}>
              +{labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Due date */}
      {due && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: due.overdue ? '#f87171' : 'var(--text-muted)',
          fontWeight: due.overdue ? 600 : 400,
        }}>
          <Clock size={10} />
          {due.label}
          {due.overdue && <AlertCircle size={10} />}
        </div>
      )}
    </div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

interface ColumnProps {
  status: TaskStatus
  label: string
  color: string
  tasks: Task[]
  users: UserOption[]
  onCardClick: (task: Task) => void
  onDragStart: (e: React.DragEvent, taskId: string, fromStatus: TaskStatus) => void
  onDrop: (toStatus: TaskStatus) => void
}

function KanbanColumn({ status, label, color, tasks, users, onCardClick, onDragStart, onDrop }: ColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  return (
    <div
      style={{
        minWidth: 230,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${isDragOver ? color + '50' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 14,
        transition: 'border-color 0.15s',
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); onDrop(status) }}
    >
      {/* Column header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', flex: 1, letterSpacing: '-0.01em' }}>
          {label}
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 99,
          padding: '1px 7px',
          minWidth: 20,
          textAlign: 'center',
        }}>
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{
        flex: 1,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 80,
        overflowY: 'auto',
      }}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            users={users}
            onClick={() => onCardClick(task)}
            onDragStart={onDragStart}
          />
        ))}
        {tasks.length === 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 0',
            color: 'var(--text-muted)',
            fontSize: 12,
            opacity: 0.5,
          }}>
            No tasks
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all')

  // Filters
  const [filterPriority, setFilterPriority] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterLabel, setFilterLabel] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Drag state
  const dragTaskId = useRef<string | null>(null)
  const dragFromStatus = useRef<TaskStatus | null>(null)

  // Current user id from session (fetched once)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks ?? [])
      }
    } catch {}
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users ?? [])
      }
    } catch {}
  }, [])

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session')
      if (res.ok) {
        const data = await res.json()
        setCurrentUserId(data.user?.id ?? null)
      }
    } catch {}
  }, [])

  useEffect(() => {
    Promise.all([fetchTasks(), fetchUsers(), fetchSession()]).finally(() => setLoading(false))
  }, [fetchTasks, fetchUsers, fetchSession])

  // Filtered tasks
  const displayTasks = tasks.filter((t) => {
    if (activeTab === 'mine' && t.assignedTo !== currentUserId) return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (filterAssignee && t.assignedTo !== filterAssignee) return false
    if (filterLabel) {
      const taskLabels = Array.isArray(t.labels) ? t.labels as string[] : []
      if (!taskLabels.some((l) => l.toLowerCase().includes(filterLabel.toLowerCase()))) return false
    }
    return true
  })

  const getColumnTasks = (status: TaskStatus) =>
    displayTasks.filter((t) => t.status === status)

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, taskId: string, fromStatus: TaskStatus) => {
    dragTaskId.current = taskId
    dragFromStatus.current = fromStatus
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = async (toStatus: TaskStatus) => {
    const taskId = dragTaskId.current
    if (!taskId || dragFromStatus.current === toStatus) return
    dragTaskId.current = null
    dragFromStatus.current = null

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: toStatus as Task['status'] } : t))
    )

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStatus }),
      })
    } catch {
      // Revert on failure
      fetchTasks()
    }
  }

  // Modal handlers
  const openNewTask = () => {
    setEditingTask(null)
    setModalOpen(true)
  }

  const openEditTask = (task: Task) => {
    setEditingTask(task)
    setModalOpen(true)
  }

  const handleModalSave = (savedTask: Task) => {
    setTasks((prev) => {
      const existing = prev.find((t) => t.id === savedTask.id)
      if (existing) return prev.map((t) => (t.id === savedTask.id ? savedTask : t))
      return [savedTask, ...prev]
    })
    setModalOpen(false)
    setEditingTask(null)
  }

  const handleModalDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setModalOpen(false)
    setEditingTask(null)
  }

  const allLabels = Array.from(
    new Set(tasks.flatMap((t) => (Array.isArray(t.labels) ? t.labels as string[] : [])))
  )

  const activeFiltersCount = [filterPriority, filterAssignee, filterLabel].filter(Boolean).length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Page header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 2 }}>
            Tasks
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {tasks.length} total · {displayTasks.filter((t) => t.status === 'in_progress').length} in progress
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowFilters((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: showFilters ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showFilters ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.10)'}`,
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: 13,
              color: showFilters ? '#c4b5fd' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            <Filter size={13} />
            Filters
            {activeFiltersCount > 0 && (
              <span style={{
                background: 'var(--violet)',
                color: '#fff',
                borderRadius: 99,
                padding: '0px 6px',
                fontSize: 10,
                fontWeight: 700,
              }}>
                {activeFiltersCount}
              </span>
            )}
          </button>
          <button
            onClick={openNewTask}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--violet)',
              border: 'none',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 13,
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <Plus size={14} />
            New Task
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
        {(['all', 'mine'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              background: activeTab === tab ? 'rgba(139,92,246,0.18)' : 'transparent',
              color: activeTab === tab ? '#c4b5fd' : 'var(--text-muted)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {tab === 'all' ? 'All Tasks' : 'My Tasks'}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 16,
          alignItems: 'center',
        }}>
          {/* Priority filter */}
          <div style={{ position: 'relative' }}>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              style={{
                appearance: 'none',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 7,
                padding: '6px 28px 6px 10px',
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="" style={{ background: '#0e1225' }}>All Priorities</option>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                <option key={k} value={k} style={{ background: '#0e1225' }}>{v.label}</option>
              ))}
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          </div>

          {/* Assignee filter */}
          <div style={{ position: 'relative' }}>
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              style={{
                appearance: 'none',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 7,
                padding: '6px 28px 6px 10px',
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="" style={{ background: '#0e1225' }}>All Assignees</option>
              {users.map((u) => (
                <option key={u.id} value={u.id} style={{ background: '#0e1225' }}>{getUserLabel(u)}</option>
              ))}
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          </div>

          {/* Label filter */}
          <div style={{ position: 'relative' }}>
            <select
              value={filterLabel}
              onChange={(e) => setFilterLabel(e.target.value)}
              style={{
                appearance: 'none',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 7,
                padding: '6px 28px 6px 10px',
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="" style={{ background: '#0e1225' }}>All Labels</option>
              {allLabels.map((l) => (
                <option key={l} value={l} style={{ background: '#0e1225' }}>{l}</option>
              ))}
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={() => { setFilterPriority(''); setFilterAssignee(''); setFilterLabel('') }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 12,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6,
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Kanban board */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', gap: 10 }}>
          <div style={{ width: 16, height: 16, border: '2px solid var(--violet)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading tasks…
        </div>
      ) : (
        <div style={{
          display: 'flex',
          gap: 12,
          flex: 1,
          overflowX: 'auto',
          paddingBottom: 16,
          minHeight: 0,
        }}>
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              {...col}
              tasks={getColumnTasks(col.status)}
              users={users}
              onCardClick={openEditTask}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}

      {/* Task modal */}
      {modalOpen && (
        <TaskModal
          task={editingTask}
          onClose={() => { setModalOpen(false); setEditingTask(null) }}
          onSave={handleModalSave}
          onDelete={editingTask ? handleModalDelete : undefined}
        />
      )}
    </div>
  )
}
