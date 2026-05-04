'use client'

import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react'
import { MessageSquare, Send, Edit2, Trash2, CornerDownRight, X, Check } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommentAuthor {
  authorId: string
  authorFirstName: string | null
  authorLastName: string | null
  authorEmail: string
}

interface Reply extends CommentAuthor {
  id: string
  body: string
  parentCommentId: string
  isEdited: boolean
  editedAt: string | null
  createdAt: string
  updatedAt: string
}

interface Comment extends CommentAuthor {
  id: string
  body: string
  parentCommentId: string | null
  isEdited: boolean
  editedAt: string | null
  createdAt: string
  updatedAt: string
  replies: Reply[]
}

interface CommentsPanelProps {
  entityType: string
  entityId: string
  compact?: boolean
  currentUserId?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MENTION_SUGGESTIONS = ['Admin', 'Auditor', 'Contributor']

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitials(author: CommentAuthor): string {
  const first = author.authorFirstName?.charAt(0) ?? ''
  const last = author.authorLastName?.charAt(0) ?? ''
  if (first || last) return (first + last).toUpperCase()
  return author.authorEmail.charAt(0).toUpperCase()
}

function getAuthorName(author: CommentAuthor): string {
  const name = [author.authorFirstName, author.authorLastName].filter(Boolean).join(' ')
  return name || author.authorEmail.split('@')[0]
}

// Gradient based on name character code
function avatarGradient(name: string): string {
  const code = name.charCodeAt(0) % 6
  const gradients = [
    'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
    'linear-gradient(135deg, #059669 0%, #0891B2 100%)',
    'linear-gradient(135deg, #DC2626 0%, #7C3AED 100%)',
    'linear-gradient(135deg, #D97706 0%, #059669 100%)',
    'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
    'linear-gradient(135deg, #DB2777 0%, #D97706 100%)',
  ]
  return gradients[code]
}

// Render body text with @mention highlighting
function renderBody(body: string) {
  const parts = body.split(/(@\w+)/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span
        key={i}
        style={{
          color: 'var(--violet)',
          fontWeight: 600,
          background: 'rgba(139,92,246,0.12)',
          padding: '0 3px',
          borderRadius: 3,
        }}
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

// ── Comment Input ─────────────────────────────────────────────────────────────

interface CommentInputProps {
  onSubmit: (body: string) => Promise<void>
  placeholder?: string
  compact?: boolean
  autoFocus?: boolean
  onCancel?: () => void
  initialValue?: string
}

function CommentInput({
  onSubmit,
  placeholder = 'Add a comment... (@mention a teammate)',
  compact,
  autoFocus,
  onCancel,
  initialValue = '',
}: CommentInputProps) {
  const [value, setValue] = useState(initialValue)
  const [submitting, setSubmitting] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    const pos = e.target.selectionStart ?? 0
    setValue(v)
    setCursorPosition(pos)

    // Detect @ trigger
    const textBeforeCursor = v.slice(0, pos)
    const atMatch = textBeforeCursor.match(/@(\w*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setShowMentions(true)
    } else {
      setShowMentions(false)
      setMentionQuery('')
    }
  }

  const insertMention = (name: string) => {
    const textBeforeCursor = value.slice(0, cursorPosition)
    const textAfterCursor = value.slice(cursorPosition)
    const atIndex = textBeforeCursor.lastIndexOf('@')
    const newText = textBeforeCursor.slice(0, atIndex) + `@${name} ` + textAfterCursor
    setValue(newText)
    setShowMentions(false)
    textareaRef.current?.focus()
  }

  const filteredMentions = MENTION_SUGGESTIONS.filter((s) =>
    s.toLowerCase().startsWith(mentionQuery.toLowerCase())
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setShowMentions(false)
      onCancel?.()
    }
  }

  const handleSubmit = async () => {
    if (!value.trim() || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(value.trim())
      setValue('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={compact ? 2 : 3}
        autoFocus={autoFocus}
        style={{
          width: '100%',
          resize: 'none',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border-glass)',
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 13,
          color: 'var(--text-primary)',
          fontFamily: 'Inter, sans-serif',
          lineHeight: 1.55,
          outline: 'none',
          transition: 'border-color 0.15s',
          boxSizing: 'border-box',
          overflow: 'hidden',
          minHeight: compact ? 60 : 80,
        }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--border-active)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--border-glass)')}
      />

      {/* @mention dropdown */}
      {showMentions && filteredMentions.length > 0 && (
        <div
          className="glass-strong"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: 0,
            zIndex: 100,
            borderRadius: 8,
            overflow: 'hidden',
            minWidth: 160,
          }}
        >
          {filteredMentions.map((name) => (
            <button
              key={name}
              onMouseDown={(e) => { e.preventDefault(); insertMention(name) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontFamily: 'Inter, sans-serif',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: avatarGradient(name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0,
              }}>
                {name.charAt(0)}
              </div>
              @{name}
            </button>
          ))}
        </div>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {compact ? 'Ctrl+Enter to submit' : 'Ctrl+Enter or click Submit · @mention teammates'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {onCancel && (
            <button
              onClick={onCancel}
              className="btn-ghost"
              style={{ fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <X size={11} /> Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || submitting}
            className="btn-primary"
            style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Send size={11} />
            {submitting ? 'Posting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Comment bubble ────────────────────────────────────────────────────────────

interface CommentBubbleProps {
  comment: Comment | Reply
  currentUserId?: string
  onReply?: () => void
  onEdit: (id: string, newBody: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  isReply?: boolean
}

function CommentBubble({ comment, currentUserId, onReply, onEdit, onDelete, isReply }: CommentBubbleProps) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isAuthor = currentUserId === comment.authorId
  const authorName = getAuthorName(comment)
  const initials = getInitials(comment)
  const isDeleted = comment.body === '[deleted]'

  const handleEdit = async (newBody: string) => {
    await onEdit(comment.id, newBody)
    setEditing(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(comment.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="glass-card"
      style={{
        padding: '11px 13px',
        borderRadius: 10,
        marginLeft: isReply ? 24 : 0,
        opacity: isDeleted ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Avatar */}
        <div style={{
          width: isReply ? 24 : 28,
          height: isReply ? 24 : 28,
          borderRadius: '50%',
          background: avatarGradient(authorName),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: isReply ? 9 : 10,
          fontWeight: 700,
          color: 'white',
          flexShrink: 0,
          marginTop: 1,
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
              {authorName}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {timeAgo(comment.createdAt)}
            </span>
            {comment.isEdited && !isDeleted && (
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                (edited)
              </span>
            )}
            {/* Actions */}
            {!isDeleted && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                {onReply && (
                  <button
                    onClick={onReply}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: 11, padding: '2px 6px',
                      borderRadius: 5, display: 'flex', alignItems: 'center', gap: 4,
                      fontFamily: 'Inter, sans-serif', transition: 'all 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)' }}
                  >
                    <CornerDownRight size={10} /> Reply
                  </button>
                )}
                {isAuthor && !editing && (
                  <>
                    <button
                      onClick={() => setEditing(true)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '2px 5px', borderRadius: 5,
                        display: 'flex', alignItems: 'center', transition: 'all 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--cyan)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)' }}
                      title="Edit"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '2px 5px', borderRadius: 5,
                        display: 'flex', alignItems: 'center', transition: 'all 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = 'var(--rose)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)' }}
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Body or edit form */}
          {editing ? (
            <CommentInput
              onSubmit={handleEdit}
              placeholder="Edit your comment…"
              compact
              autoFocus
              initialValue={comment.body}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <p style={{
              fontSize: 13,
              color: isDeleted ? 'var(--text-muted)' : 'var(--text-secondary)',
              lineHeight: 1.55,
              margin: 0,
              fontStyle: isDeleted ? 'italic' : 'normal',
              wordBreak: 'break-word',
            }}>
              {isDeleted ? '[deleted]' : renderBody(comment.body)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main CommentsPanel ────────────────────────────────────────────────────────

export function CommentsPanel({ entityType, entityId, compact }: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>()

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?entityType=${entityType}&entityId=${entityId}`)
      if (!res.ok) return
      const data = await res.json()
      setComments(data.comments || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  // Fetch current user session for author checks
  useEffect(() => {
    fetch('/api/auth/session').then((r) => r.json()).then((d) => {
      if (d?.user?.id) setCurrentUserId(d.user.id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleSubmitComment = async (body: string) => {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId, body }),
    })
    if (res.ok) {
      const data = await res.json()
      const newComment: Comment = { ...data.comment, replies: [] }
      setComments((prev) => [newComment, ...prev])
    }
  }

  const handleSubmitReply = async (parentCommentId: string, body: string) => {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId, body, parentCommentId }),
    })
    if (res.ok) {
      const data = await res.json()
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentCommentId
            ? { ...c, replies: [...c.replies, data.comment] }
            : c
        )
      )
      setReplyingTo(null)
    }
  }

  const handleEdit = async (id: string, newBody: string) => {
    const res = await fetch(`/api/comments?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newBody }),
    })
    if (res.ok) {
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === id) return { ...c, body: newBody, isEdited: true }
          return {
            ...c,
            replies: c.replies.map((r) =>
              r.id === id ? { ...r, body: newBody, isEdited: true } : r
            ),
          }
        })
      )
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/comments?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      // If comment has replies, it'll be soft-deleted (body → [deleted])
      // Re-fetch to get accurate state
      await fetchComments()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={13} style={{ color: 'var(--text-muted)' }} />
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}>
          Comments
        </span>
        {comments.length > 0 && (
          <span style={{
            marginLeft: 4,
            fontSize: 10.5,
            padding: '1px 6px',
            borderRadius: 99,
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-glass)',
          }}>
            {comments.reduce((sum, c) => sum + 1 + c.replies.length, 0)}
          </span>
        )}
      </div>

      {/* Comment input */}
      <CommentInput
        onSubmit={handleSubmitComment}
        compact={compact}
      />

      {/* Comments list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 64,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-glass)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 12.5,
          lineHeight: 1.6,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-glass)',
          borderRadius: 10,
        }}>
          No comments yet. Start the conversation.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {comments.map((comment) => (
            <div key={comment.id}>
              <CommentBubble
                comment={comment}
                currentUserId={currentUserId}
                onReply={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />

              {/* Reply input */}
              {replyingTo === comment.id && (
                <div style={{ marginLeft: 24, marginTop: 6 }}>
                  <CommentInput
                    onSubmit={(body) => handleSubmitReply(comment.id, body)}
                    placeholder={`Replying to ${getAuthorName(comment)}…`}
                    compact
                    autoFocus
                    onCancel={() => setReplyingTo(null)}
                  />
                </div>
              )}

              {/* Replies */}
              {comment.replies.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {comment.replies.map((reply) => (
                    <CommentBubble
                      key={reply.id}
                      comment={reply}
                      currentUserId={currentUserId}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isReply
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CommentsPanel
