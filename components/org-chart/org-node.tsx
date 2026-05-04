'use client'

import { Pencil, Plus } from 'lucide-react'

export interface OrgNodeData {
  id: string
  name: string
  title?: string | null
  department?: string | null
  email?: string | null
  avatarUrl?: string | null
  parentId?: string | null
  userId?: string | null
}

interface OrgNodeProps {
  node: OrgNodeData
  x: number
  y: number
  isCollapsed?: boolean
  hasChildren?: boolean
  onEdit: (node: OrgNodeData) => void
  onAddChild: (node: OrgNodeData) => void
  onToggleCollapse?: (nodeId: string) => void
}

// Stable color palette for departments
const DEPT_COLORS: Record<string, string> = {
  engineering: '#8B5CF6',
  product: '#06B6D4',
  design: '#EC4899',
  marketing: '#F59E0B',
  sales: '#10B981',
  finance: '#3B82F6',
  hr: '#EF4444',
  legal: '#A78BFA',
  operations: '#14B8A6',
  leadership: '#F97316',
}

function getDeptColor(dept?: string | null): string {
  if (!dept) return '#6B7280'
  const key = dept.toLowerCase().replace(/[^a-z]/g, '')
  if (DEPT_COLORS[key]) return DEPT_COLORS[key]
  // Hash the department name for consistent color
  let hash = 0
  for (let i = 0; i < dept.length; i++) {
    hash = dept.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = Object.values(DEPT_COLORS)
  return colors[Math.abs(hash) % colors.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const NODE_W = 180
const NODE_H = 90

export { NODE_W, NODE_H }

export function OrgNode({
  node,
  x,
  y,
  isCollapsed,
  hasChildren,
  onEdit,
  onAddChild,
  onToggleCollapse,
}: OrgNodeProps) {
  const color = getDeptColor(node.department)
  const initials = getInitials(node.name)

  return (
    <div
      style={{
        position: 'absolute',
        left: x - NODE_W / 2,
        top: y,
        width: NODE_W,
        height: NODE_H,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        borderRadius: 12,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        cursor: 'default',
        transition: 'border-color 0.15s, background 0.15s',
        boxSizing: 'border-box',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
        e.currentTarget.style.borderColor = `${color}55`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
      }}
      title={node.email ?? undefined}
    >
      {/* Avatar + Name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Avatar */}
        {node.avatarUrl ? (
          <img
            src={node.avatarUrl}
            alt={node.name}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
              border: `2px solid ${color}55`,
            }}
          />
        ) : (
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: `${color}25`,
              border: `2px solid ${color}55`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: color,
              flexShrink: 0,
              letterSpacing: '0.02em',
            }}
          >
            {initials}
          </div>
        )}

        {/* Name */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            lineHeight: 1.2,
          }}
        >
          {node.name}
        </span>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); onEdit(node) }}
            style={{
              width: 20,
              height: 20,
              borderRadius: 5,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
            title="Edit node"
          >
            <Pencil size={9} color="var(--text-muted)" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onAddChild(node) }}
            style={{
              width: 20,
              height: 20,
              borderRadius: 5,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
            title="Add child node"
          >
            <Plus size={9} color="var(--text-muted)" />
          </button>
        </div>
      </div>

      {/* Title */}
      {node.title && (
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}
        >
          {node.title}
        </div>
      )}

      {/* Department badge */}
      {node.department && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: color,
              background: `${color}18`,
              border: `1px solid ${color}35`,
              padding: '1px 6px',
              borderRadius: 100,
            }}
          >
            {node.department}
          </span>

          {/* Collapse toggle */}
          {hasChildren && onToggleCollapse && (
            <button
              onClick={e => { e.stopPropagation(); onToggleCollapse(node.id) }}
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4,
                padding: '1px 5px',
                cursor: 'pointer',
                lineHeight: 1.4,
              }}
              title={isCollapsed ? 'Expand subtree' : 'Collapse subtree'}
            >
              {isCollapsed ? '▶' : '▼'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
