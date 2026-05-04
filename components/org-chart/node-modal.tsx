'use client'

import { useState, useEffect } from 'react'
import { X, User } from 'lucide-react'
import type { OrgNodeData } from './org-node'

interface NodeModalProps {
  mode: 'create' | 'edit'
  node?: OrgNodeData | null
  defaultParentId?: string | null
  allNodes: OrgNodeData[]
  onSave: (data: Partial<OrgNodeData>) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

interface UserOption {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
}

export function NodeModal({
  mode,
  node,
  defaultParentId,
  allNodes,
  onSave,
  onDelete,
  onClose,
}: NodeModalProps) {
  const [name, setName] = useState(node?.name ?? '')
  const [title, setTitle] = useState(node?.title ?? '')
  const [department, setDepartment] = useState(node?.department ?? '')
  const [email, setEmail] = useState(node?.email ?? '')
  const [parentId, setParentId] = useState<string>(
    node?.parentId ?? defaultParentId ?? '__root__'
  )
  const [avatarUrl, setAvatarUrl] = useState(node?.avatarUrl ?? '')
  const [linkedUserId, setLinkedUserId] = useState<string>('')
  const [users, setUsers] = useState<UserOption[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(d => setUsers(d.users ?? []))
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        title: title.trim() || null,
        department: department.trim() || null,
        email: email.trim() || null,
        parentId: parentId === '__root__' ? null : parentId,
        userId: linkedUserId || null,
        avatarUrl: avatarUrl.trim() || null,
      })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    if (!confirm('Delete this node? Children will become orphaned root nodes.')) return
    setDeleting(true)
    try {
      await onDelete()
      onClose()
    } catch {
      setError('Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  // Exclude the current node and its descendants from parent dropdown
  const validParents = allNodes.filter(n => n.id !== node?.id)

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 13,
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#0D1225',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '24px',
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={16} color="#8B5CF6" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {mode === 'create' ? 'Add Node' : 'Edit Node'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            fontSize: 12.5, color: '#F87171',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name */}
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>Job Title</label>
            <input
              style={inputStyle}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Chief Executive Officer"
            />
          </div>

          {/* Department */}
          <div>
            <label style={labelStyle}>Department</label>
            <input
              style={inputStyle}
              value={department}
              onChange={e => setDepartment(e.target.value)}
              placeholder="e.g. Engineering"
            />
          </div>

          {/* Email */}
          <div>
            <label style={labelStyle}>Email</label>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="person@company.com"
            />
          </div>

          {/* Parent Node */}
          <div>
            <label style={labelStyle}>Parent Node</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={parentId}
              onChange={e => setParentId(e.target.value)}
            >
              <option value="__root__">— Root (top level) —</option>
              {validParents.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name}{n.title ? ` (${n.title})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Link to User */}
          <div>
            <label style={labelStyle}>Link to User (optional)</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={linkedUserId}
              onChange={e => setLinkedUserId(e.target.value)}
            >
              <option value="">— None —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email}
                </option>
              ))}
            </select>
          </div>

          {/* Avatar URL */}
          <div>
            <label style={labelStyle}>Avatar URL (optional)</label>
            <input
              style={inputStyle}
              value={avatarUrl}
              onChange={e => setAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'space-between' }}>
          {mode === 'edit' && onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#F87171', cursor: deleting ? 'not-allowed' : 'pointer',
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                border: 'none', color: 'white',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : mode === 'create' ? 'Add Node' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
