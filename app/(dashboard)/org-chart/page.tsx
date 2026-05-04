'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Users2, Plus, Download, RefreshCw } from 'lucide-react'
import { OrgNode, NODE_W, NODE_H } from '@/components/org-chart/org-node'
import { NodeModal } from '@/components/org-chart/node-modal'
import type { OrgNodeData } from '@/components/org-chart/org-node'

// ─── Tree Layout ─────────────────────────────────────────────────────────────

interface TreeNode extends OrgNodeData {
  children: TreeNode[]
}

const H_GAP = 220  // horizontal gap between nodes
const V_GAP = 140  // vertical spacing between levels

function buildTree(nodes: OrgNodeData[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  nodes.forEach(n => map.set(n.id, { ...n, children: [] }))

  const roots: TreeNode[] = []
  nodes.forEach(n => {
    const node = map.get(n.id)!
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

interface PositionedNode {
  node: TreeNode
  x: number
  y: number
}

function layoutTree(
  roots: TreeNode[],
  collapsedIds: Set<string>
): { positions: PositionedNode[]; width: number; height: number } {
  const positions: PositionedNode[] = []
  let maxX = 0
  let maxY = 0

  function measureSubtree(node: TreeNode, depth: number): number {
    if (collapsedIds.has(node.id) || node.children.length === 0) {
      return NODE_W + 20
    }
    return node.children.reduce((sum, child) => sum + measureSubtree(child, depth + 1), 0)
  }

  function placeNode(node: TreeNode, x: number, y: number, depth: number) {
    positions.push({ node, x, y })
    if (x > maxX) maxX = x
    if (y + NODE_H > maxY) maxY = y + NODE_H

    if (collapsedIds.has(node.id) || node.children.length === 0) return

    const childWidths = node.children.map(c => measureSubtree(c, depth + 1))
    const totalWidth = childWidths.reduce((a, b) => a + b, 0)
    let childX = x - totalWidth / 2 + childWidths[0] / 2
    const childY = y + V_GAP

    node.children.forEach((child, i) => {
      placeNode(child, childX, childY, depth + 1)
      if (i < node.children.length - 1) {
        childX += childWidths[i] / 2 + childWidths[i + 1] / 2
      }
    })
  }

  if (roots.length === 0) return { positions, width: 0, height: 0 }

  const rootWidths = roots.map(r => measureSubtree(r, 0))
  const totalRootWidth = rootWidths.reduce((a, b) => a + b, 0)
  let rootX = totalRootWidth / 2
  const rootY = 40

  roots.forEach((root, i) => {
    placeNode(root, rootX, rootY, 0)
    if (i < roots.length - 1) {
      rootX += rootWidths[i] / 2 + rootWidths[i + 1] / 2 + H_GAP
    }
  })

  return { positions, width: maxX + NODE_W, height: maxY + 40 }
}

function getEdges(positions: PositionedNode[]): { x1: number; y1: number; x2: number; y2: number }[] {
  const posMap = new Map<string, { x: number; y: number }>()
  positions.forEach(p => posMap.set(p.node.id, { x: p.x, y: p.y }))

  const edges: { x1: number; y1: number; x2: number; y2: number }[] = []
  positions.forEach(({ node, x, y }) => {
    if (node.parentId && posMap.has(node.parentId)) {
      const parent = posMap.get(node.parentId)!
      edges.push({
        x1: parent.x,
        y1: parent.y + NODE_H,
        x2: x,
        y2: y,
      })
    }
  })
  return edges
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  const [nodes, setNodes] = useState<OrgNodeData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingNode, setEditingNode] = useState<OrgNodeData | null>(null)
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  const fetchNodes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/org-chart')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setNodes(data.nodes ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load org chart')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNodes() }, [fetchNodes])

  const handleAddNode = () => {
    setEditingNode(null)
    setDefaultParentId(null)
    setModalMode('create')
  }

  const handleEditNode = (node: OrgNodeData) => {
    setEditingNode(node)
    setDefaultParentId(null)
    setModalMode('edit')
  }

  const handleAddChild = (parent: OrgNodeData) => {
    setEditingNode(null)
    setDefaultParentId(parent.id)
    setModalMode('create')
  }

  const handleToggleCollapse = (nodeId: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const handleSave = async (data: Partial<OrgNodeData>) => {
    if (modalMode === 'create') {
      const res = await fetch('/api/org-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to create node')
      }
    } else if (modalMode === 'edit' && editingNode) {
      const res = await fetch(`/api/org-chart/${editingNode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to update node')
      }
    }
    await fetchNodes()
  }

  const handleDelete = async () => {
    if (!editingNode) return
    const res = await fetch(`/api/org-chart/${editingNode.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error || 'Failed to delete node')
    }
    await fetchNodes()
  }

  const handleExport = () => {
    // Print the chart area using CSS print media query
    window.print()
  }

  // Build tree layout
  const tree = buildTree(nodes)
  const { positions, width, height } = layoutTree(tree, collapsedIds)
  const edges = getEdges(positions)

  // All nodes have children set
  const childrenByParent = new Map<string, number>()
  nodes.forEach(n => {
    if (n.parentId) {
      childrenByParent.set(n.parentId, (childrenByParent.get(n.parentId) ?? 0) + 1)
    }
  })

  const canvasWidth = Math.max(width + 100, 800)
  const canvasHeight = Math.max(height + 80, 400)

  return (
    <>
      {/* Print style */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #org-chart-print-area { display: block !important; }
          #org-chart-print-area * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Users2 size={18} color="#8B5CF6" />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Organization Chart
              </h1>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                {nodes.length} {nodes.length === 1 ? 'person' : 'people'} in the hierarchy
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={fetchNodes}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}
              title="Refresh"
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              onClick={handleExport}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
                color: '#06B6D4', cursor: 'pointer',
              }}
            >
              <Download size={13} /> Export PNG
            </button>
            <button
              onClick={handleAddNode}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                border: 'none', color: 'white', cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Add Node
            </button>
          </div>
        </div>

        {/* Chart canvas */}
        <div
          id="org-chart-print-area"
          ref={chartRef}
          style={{
            flex: 1,
            overflow: 'auto',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14,
            position: 'relative',
            minHeight: 400,
          }}
        >
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 14,
            }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
              Loading org chart…
            </div>
          )}

          {!loading && error && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 12, color: '#F87171',
            }}>
              <div style={{ fontSize: 14 }}>{error}</div>
              <button onClick={fetchNodes} style={{ fontSize: 13, color: '#8B5CF6', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Retry
              </button>
            </div>
          )}

          {!loading && !error && nodes.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 16,
            }}>
              <Users2 size={40} color="rgba(139,92,246,0.4)" />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No org chart yet</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Add your first node to start building the hierarchy</p>
                <button
                  onClick={handleAddNode}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                    border: 'none', color: 'white', cursor: 'pointer',
                  }}
                >
                  <Plus size={14} /> Add First Node
                </button>
              </div>
            </div>
          )}

          {!loading && !error && nodes.length > 0 && (
            <div style={{ position: 'relative', width: canvasWidth, height: canvasHeight }}>
              {/* SVG lines */}
              <svg
                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                width={canvasWidth}
                height={canvasHeight}
              >
                {edges.map((edge, i) => {
                  const midY = (edge.y1 + edge.y2) / 2
                  return (
                    <path
                      key={i}
                      d={`M ${edge.x1} ${edge.y1} C ${edge.x1} ${midY}, ${edge.x2} ${midY}, ${edge.x2} ${edge.y2}`}
                      stroke="rgba(139,92,246,0.3)"
                      strokeWidth={1.5}
                      fill="none"
                    />
                  )
                })}
              </svg>

              {/* Nodes */}
              {positions.map(({ node, x, y }) => (
                <OrgNode
                  key={node.id}
                  node={node}
                  x={x}
                  y={y}
                  hasChildren={(childrenByParent.get(node.id) ?? 0) > 0}
                  isCollapsed={collapsedIds.has(node.id)}
                  onEdit={handleEditNode}
                  onAddChild={handleAddChild}
                  onToggleCollapse={handleToggleCollapse}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalMode && (
        <NodeModal
          mode={modalMode}
          node={editingNode}
          defaultParentId={defaultParentId}
          allNodes={nodes}
          onSave={handleSave}
          onDelete={modalMode === 'edit' ? handleDelete : undefined}
          onClose={() => { setModalMode(null); setEditingNode(null) }}
        />
      )}
    </>
  )
}
