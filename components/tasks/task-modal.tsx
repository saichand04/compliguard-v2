'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Trash2, Save, Loader2, Tag, ChevronDown } from 'lucide-react'

type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  assignedTo?: string | null
  dueDate?: string | Date | null
  labels?: string[] | null
  controlAssignmentId?: string | null
  organizationId: string
  createdBy?: string | null
  createdAt: string | Date
  updatedAt: string | Date
}

interface UserOption {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
}

interface ControlOption {
  id: string
  title: string
  controlId?: string | null
}

interface TaskModalProps {
  task?: Task | null
  onClose: () => void
  onSave: (task: Task) => void
  onDelete?: (taskId: string) => void
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#94a3b8' },
  { value: 'medium', label: 'Medium', color: '#eab308' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
]

function getUserLabel(u: UserOption) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ')
  return name || u.email
}

export function TaskModal({ task, onClose, onSave, onDelete }: TaskModalProps) {
  const isEditing = !!task

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium')
  const [assignedTo, setAssignedTo] = useState<string>(task?.assignedTo ?? '')
  const [dueDate, setDueDate] = useState<string>(() => {
    if (!task?.dueDate) return ''
    const d = new Date(task.dueDate)
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]
  })
  const [labels, setLabels] = useState<string[]>(
    Array.isArray(task?.labels) ? task.labels : []
  )
  const [labelInput, setLabelInput] = useState('')
  const [controlAssignmentId, setControlAssignmentId] = useState<string>(
    task?.controlAssignmentId ?? ''
  )

  const [users, setUsers] = useState<UserOption[]>([])
  const [controls, setControls] = useState<ControlOption[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [controlSearch, setControlSearch] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [showControlDropdown, setShowControlDropdown] = useState(false)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const overlayRef = useRef<HTMLDivElement>(null)
  const userSearchRef = useRef<HTMLInputElement>(null)

  // Load users and controls
  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => { if (d.users) setUsers(d.users) })
      .catch(() => {})

    fetch('/api/controls')
      .then((r) => r.json())
      .then((d) => {
        if (d.controls) {
          setControls(
            d.controls.map((c: { id: string; title: string; controlId?: string | null }) => ({
              id: c.id,
              title: c.title,
              controlId: c.controlId ?? null,
            }))
          )
        }
      })
      .catch(() => {})
  }, [])

  // Pre-populate user search field
  useEffect(() => {
    if (assignedTo) {
      const found = users.find((u) => u.id === assignedTo)
      if (found) setUserSearch(getUserLabel(found))
    }
  }, [users, assignedTo])

  // Pre-populate control search field
  useEffect(() => {
    if (controlAssignmentId) {
      const found = controls.find((c) => c.id === controlAssignmentId)
      if (found) setControlSearch(found.title)
    }
  }, [controls, controlAssignmentId])

  const filteredUsers = users.filter((u) => {
    if (!userSearch) return true
    return getUserLabel(u).toLowerCase().includes(userSearch.toLowerCase())
  })

  const filteredControls = controls.filter((c) => {
    if (!controlSearch) return true
    return c.title.toLowerCase().includes(controlSearch.toLowerCase())
  })

  const addLabel = useCallback(() => {
    const trimmed = labelInput.trim()
    if (trimmed && !labels.includes(trimmed)) {
      setLabels((prev) => [...prev, trimmed])
    }
    setLabelInput('')
  }, [labelInput, labels])

  const removeLabel = (label: string) => {
    setLabels((prev) => prev.filter((l) => l !== label))
  }

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addLabel()
    } else if (e.key === 'Backspace' && !labelInput && labels.length > 0) {
      setLabels((prev) => prev.slice(0, -1))
    }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Title is required'
    return errs
  }

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setSaving(true)

    const payload = {
      title: title.trim(),
      description: description || null,
      status,
      priority,
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
      labels: labels.length > 0 ? labels : null,
      controlAssignmentId: controlAssignmentId || null,
    }

    try {
      let res: Response
      if (isEditing && task) {
        res = await fetch(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        setErrors({ general: data.error || 'Failed to save task' })
        return
      }

      const data = await res.json()
      onSave(data.task)
    } catch {
      setErrors({ general: 'Network error — please try again' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!task || !onDelete) return
    if (!confirm('Delete this task? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      if (res.ok) {
        onDelete(task.id)
      } else {
        setErrors({ general: 'Failed to delete task' })
      }
    } catch {
      setErrors({ general: 'Network error' })
    } finally {
      setDeleting(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const priorityColor = PRIORITY_OPTIONS.find((p) => p.value === priority)?.color ?? '#94a3b8'

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#0e1225',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 580,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            {isEditing ? 'Edit Task' : 'New Task'}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
          {errors.general && (
            <div style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#f87171',
              marginBottom: 16,
            }}>
              {errors.general}
            </div>
          )}

          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Title <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              autoFocus
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${errors.title ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.10)'}`,
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 14,
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {errors.title && (
              <p style={{ fontSize: 11.5, color: '#f87171', marginTop: 4 }}>{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={3}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 13.5,
                color: 'var(--text-primary)',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Status + Priority row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Status
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  style={{
                    width: '100%',
                    appearance: 'none',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 8,
                    padding: '9px 32px 9px 12px',
                    fontSize: 13.5,
                    color: 'var(--text-primary)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value} style={{ background: '#0e1225' }}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Priority
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  style={{
                    width: '100%',
                    appearance: 'none',
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${priorityColor}40`,
                    borderRadius: 8,
                    padding: '9px 32px 9px 12px',
                    fontSize: 13.5,
                    color: priorityColor,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value} style={{ background: '#0e1225', color: p.color }}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              </div>
            </div>
          </div>

          {/* Assigned To */}
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Assigned To
            </label>
            <input
              ref={userSearchRef}
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value)
                setAssignedTo('')
                setShowUserDropdown(true)
              }}
              onFocus={() => setShowUserDropdown(true)}
              onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)}
              placeholder="Search users..."
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 13.5,
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {showUserDropdown && filteredUsers.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#0e1225',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                marginTop: 4,
                zIndex: 100,
                maxHeight: 160,
                overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {filteredUsers.slice(0, 8).map((u) => (
                  <button
                    key={u.id}
                    onMouseDown={() => {
                      setAssignedTo(u.id)
                      setUserSearch(getUserLabel(u))
                      setShowUserDropdown(false)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '8px 12px',
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                  >
                    <span style={{ fontWeight: 500 }}>{getUserLabel(u)}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11.5, marginLeft: 6 }}>{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Due Date */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 13.5,
                color: 'var(--text-primary)',
                outline: 'none',
                colorScheme: 'dark',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Labels */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Labels
            </label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 8,
              padding: '7px 10px',
              minHeight: 40,
              alignItems: 'center',
            }}>
              {labels.map((label) => (
                <span
                  key={label}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'rgba(139,92,246,0.18)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    borderRadius: 99,
                    padding: '2px 8px 2px 8px',
                    fontSize: 11.5,
                    color: '#c4b5fd',
                    fontWeight: 500,
                  }}
                >
                  <Tag size={10} />
                  {label}
                  <button
                    onClick={() => removeLabel(label)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4b5fd', padding: 0, lineHeight: 1, marginLeft: 2 }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={handleLabelKeyDown}
                onBlur={() => { if (labelInput) addLabel() }}
                placeholder={labels.length === 0 ? 'Add labels (Enter or comma)' : ''}
                style={{
                  flex: 1,
                  minWidth: 100,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  padding: '2px 0',
                }}
              />
            </div>
          </div>

          {/* Link to Control */}
          <div style={{ marginBottom: 4, position: 'relative' }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Link to Control (optional)
            </label>
            <input
              value={controlSearch}
              onChange={(e) => {
                setControlSearch(e.target.value)
                setControlAssignmentId('')
                setShowControlDropdown(true)
              }}
              onFocus={() => setShowControlDropdown(true)}
              onBlur={() => setTimeout(() => setShowControlDropdown(false), 150)}
              placeholder="Search controls..."
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 13.5,
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {showControlDropdown && filteredControls.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#0e1225',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                marginTop: 4,
                zIndex: 100,
                maxHeight: 160,
                overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {filteredControls.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={() => {
                      setControlAssignmentId(c.id)
                      setControlSearch(c.title)
                      setShowControlDropdown(false)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '8px 12px',
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                  >
                    {c.title}
                    {c.controlId && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>
                        ({c.controlId})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 22px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
          gap: 10,
        }}>
          {isEditing && onDelete ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                color: '#f87171',
                cursor: 'pointer',
                fontWeight: 500,
                opacity: deleting ? 0.6 : 1,
              }}
            >
              {deleting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
              Delete
            </button>
          ) : (
            <span />
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--violet)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 18px',
                fontSize: 13,
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
