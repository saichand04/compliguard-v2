'use client'

import { useState } from 'react'
import { GitBranch, ChevronDown, Info, Filter, Download, Zap } from 'lucide-react'

// ── Types & demo data ─────────────────────────────────────────────────────────

interface MappingCell {
  confidence: number | null
  mappingType: 'direct' | 'partial' | 'related' | 'inferred' | null
  targetRef: string | null
}

interface CrosswalkRow {
  sourceRef: string
  sourceTitle: string
  category: string
  cells: Record<string, MappingCell>
}

const TARGET_FRAMEWORKS = [
  { id: 'hitrust',  name: 'HITRUST CSF', shortName: 'HITRUST' },
  { id: 'iso27001', name: 'ISO 27001',   shortName: 'ISO27K'  },
  { id: 'soc2',     name: 'SOC 2',       shortName: 'SOC2'    },
  { id: 'pci',      name: 'PCI DSS',     shortName: 'PCI DSS' },
  { id: 'cmmc',     name: 'CMMC',        shortName: 'CMMC'    },
]

const CROSSWALK_ROWS: CrosswalkRow[] = [
  {
    sourceRef: 'AC-1', sourceTitle: 'Access Control Policy and Procedures', category: 'Access Control',
    cells: {
      hitrust:  { confidence: 85, mappingType: 'direct',  targetRef: '01.a.01' },
      iso27001: { confidence: 92, mappingType: 'direct',  targetRef: 'A.5.1'   },
      soc2:     { confidence: 78, mappingType: 'partial', targetRef: 'CC1.2'   },
      pci:      { confidence: null, mappingType: null, targetRef: null         },
      cmmc:     { confidence: 90, mappingType: 'direct',  targetRef: 'AC.1.001'},
    },
  },
  {
    sourceRef: 'AC-2', sourceTitle: 'Account Management', category: 'Access Control',
    cells: {
      hitrust:  { confidence: 93, mappingType: 'direct',  targetRef: '09.ab.01' },
      iso27001: { confidence: 88, mappingType: 'direct',  targetRef: 'A.9.2.1'  },
      soc2:     { confidence: 82, mappingType: 'direct',  targetRef: 'CC6.2'    },
      pci:      { confidence: 76, mappingType: 'partial', targetRef: '8.1.1'    },
      cmmc:     { confidence: 91, mappingType: 'direct',  targetRef: 'AC.1.001' },
    },
  },
  {
    sourceRef: 'AC-3', sourceTitle: 'Access Enforcement', category: 'Access Control',
    cells: {
      hitrust:  { confidence: 89, mappingType: 'direct',  targetRef: '09.aa.01' },
      iso27001: { confidence: 85, mappingType: 'direct',  targetRef: 'A.9.4.1'  },
      soc2:     { confidence: 79, mappingType: 'partial', targetRef: 'CC6.1'    },
      pci:      { confidence: 72, mappingType: 'partial', targetRef: '7.1.1'    },
      cmmc:     { confidence: 88, mappingType: 'direct',  targetRef: 'AC.1.002' },
    },
  },
  {
    sourceRef: 'AC-6', sourceTitle: 'Least Privilege', category: 'Access Control',
    cells: {
      hitrust:  { confidence: 91, mappingType: 'direct',  targetRef: '09.aa.04' },
      iso27001: { confidence: 87, mappingType: 'direct',  targetRef: 'A.9.2.3'  },
      soc2:     { confidence: 80, mappingType: 'partial', targetRef: 'CC6.3'    },
      pci:      { confidence: 77, mappingType: 'partial', targetRef: '7.1.2'    },
      cmmc:     { confidence: 93, mappingType: 'direct',  targetRef: 'AC.2.006' },
    },
  },
  {
    sourceRef: 'SI-2', sourceTitle: 'Flaw Remediation', category: 'System Integrity',
    cells: {
      hitrust:  { confidence: 84, mappingType: 'direct',  targetRef: '10.m.01' },
      iso27001: { confidence: 90, mappingType: 'direct',  targetRef: 'A.12.6.1'},
      soc2:     { confidence: 73, mappingType: 'partial', targetRef: 'CC7.1'   },
      pci:      { confidence: 88, mappingType: 'direct',  targetRef: '6.3.3'   },
      cmmc:     { confidence: 85, mappingType: 'direct',  targetRef: 'SI.1.210'},
    },
  },
  {
    sourceRef: 'SI-3', sourceTitle: 'Malicious Code Protection', category: 'System Integrity',
    cells: {
      hitrust:  { confidence: 92, mappingType: 'direct',  targetRef: '10.b.01'  },
      iso27001: { confidence: 88, mappingType: 'direct',  targetRef: 'A.12.2.1' },
      soc2:     { confidence: 75, mappingType: 'partial', targetRef: 'CC6.8'    },
      pci:      { confidence: 90, mappingType: 'direct',  targetRef: '5.2.1'    },
      cmmc:     { confidence: 87, mappingType: 'direct',  targetRef: 'SI.1.212' },
    },
  },
  {
    sourceRef: 'IR-4', sourceTitle: 'Incident Handling', category: 'Incident Response',
    cells: {
      hitrust:  { confidence: 87, mappingType: 'direct',  targetRef: '08.a.01' },
      iso27001: { confidence: 91, mappingType: 'direct',  targetRef: 'A.16.1.4'},
      soc2:     { confidence: 81, mappingType: 'direct',  targetRef: 'CC7.3'   },
      pci:      { confidence: 83, mappingType: 'direct',  targetRef: '12.10.1' },
      cmmc:     { confidence: 86, mappingType: 'direct',  targetRef: 'IR.2.092'},
    },
  },
  {
    sourceRef: 'CM-2', sourceTitle: 'Baseline Configuration', category: 'Config Mgmt',
    cells: {
      hitrust:  { confidence: 76, mappingType: 'partial', targetRef: '09.ab.02' },
      iso27001: { confidence: 82, mappingType: 'partial', targetRef: 'A.12.1.1' },
      soc2:     { confidence: 68, mappingType: 'related', targetRef: 'CC7.2'    },
      pci:      { confidence: 80, mappingType: 'direct',  targetRef: '2.2.1'    },
      cmmc:     { confidence: 89, mappingType: 'direct',  targetRef: 'CM.2.061' },
    },
  },
  {
    sourceRef: 'SC-7', sourceTitle: 'Boundary Protection', category: 'Sys & Comms',
    cells: {
      hitrust:  { confidence: 88, mappingType: 'direct',  targetRef: '09.m.01' },
      iso27001: { confidence: 84, mappingType: 'partial', targetRef: 'A.13.1.1'},
      soc2:     { confidence: 74, mappingType: 'partial', targetRef: 'CC6.6'   },
      pci:      { confidence: 93, mappingType: 'direct',  targetRef: '1.2.1'   },
      cmmc:     { confidence: 87, mappingType: 'direct',  targetRef: 'SC.3.177'},
    },
  },
  {
    sourceRef: 'CP-9', sourceTitle: 'System Backup', category: 'Contingency Plan',
    cells: {
      hitrust:  { confidence: 90, mappingType: 'direct',  targetRef: '09.l.01' },
      iso27001: { confidence: 88, mappingType: 'direct',  targetRef: 'A.12.3.1'},
      soc2:     { confidence: 82, mappingType: 'direct',  targetRef: 'A1.2'    },
      pci:      { confidence: 85, mappingType: 'direct',  targetRef: '9.5.1'   },
      cmmc:     { confidence: 83, mappingType: 'direct',  targetRef: 'RE.2.137'},
    },
  },
]

// ── Cell color logic ─────────────────────────────────────────────────────────
function cellColor(cell: MappingCell): string {
  if (!cell.confidence) return 'transparent'
  if (cell.confidence >= 80) return 'rgba(16,185,129,0.18)'   // green — direct
  if (cell.confidence >= 50) return 'rgba(251,191,36,0.18)'   // yellow — partial
  return 'rgba(249,115,22,0.18)'                               // orange — related/inferred
}

function cellTextColor(cell: MappingCell): string {
  if (!cell.confidence) return 'var(--text-muted)'
  if (cell.confidence >= 80) return '#6EE7B7'
  if (cell.confidence >= 50) return '#FCD34D'
  return '#FDBA74'
}

function cellBorderColor(cell: MappingCell): string {
  if (!cell.confidence) return 'var(--border-glass)'
  if (cell.confidence >= 80) return 'rgba(16,185,129,0.30)'
  if (cell.confidence >= 50) return 'rgba(251,191,36,0.30)'
  return 'rgba(249,115,22,0.30)'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MappingsPage() {
  const [sourceFramework, setSourceFramework] = useState('nist')
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: string } | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const categories = ['all', ...Array.from(new Set(CROSSWALK_ROWS.map((r) => r.category)))]
  const filteredRows = filterCategory === 'all'
    ? CROSSWALK_ROWS
    : CROSSWALK_ROWS.filter((r) => r.category === filterCategory)

  // Stats
  const totalCells = filteredRows.length * TARGET_FRAMEWORKS.length
  const mappedCells = filteredRows.flatMap((r) => Object.values(r.cells)).filter((c) => c.confidence !== null).length
  const directCells = filteredRows.flatMap((r) => Object.values(r.cells)).filter((c) => c.mappingType === 'direct').length

  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ flexShrink: 0, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 3 }}>
              Mapping Explorer
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Visual crosswalk — confidence-coded mappings across all frameworks
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 12px' }}>
              <Download size={13} /> Export
            </button>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 12px' }}>
              <Filter size={13} /> Filter
            </button>
          </div>
        </div>

        {/* ── Stats row ──────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Total Mappings', value: mappedCells, color: 'var(--text-primary)' },
            { label: 'Direct Match',   value: directCells,   color: 'var(--emerald)' },
            { label: 'Partial Match',  value: filteredRows.flatMap((r) => Object.values(r.cells)).filter((c) => c.mappingType === 'partial').length, color: '#FBBF24' },
            { label: 'No Mapping',     value: totalCells - mappedCells, color: 'var(--text-muted)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card" style={{ padding: '10px 14px', flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── Legend + Category filter ──────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Legend:</span>
            {[
              { color: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.3)', text: '#6EE7B7', label: '≥80% Direct' },
              { color: 'rgba(251,191,36,0.18)', border: 'rgba(251,191,36,0.3)',  text: '#FCD34D', label: '50–79% Partial' },
              { color: 'rgba(249,115,22,0.18)', border: 'rgba(249,115,22,0.3)',  text: '#FDBA74', label: '20–49% Related' },
              { color: 'transparent', border: 'var(--border-glass)', text: 'var(--text-muted)', label: 'No mapping' },
            ].map(({ color, border, text, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 14, height: 14, background: color, border: `1px solid ${border}`, borderRadius: 3 }} />
                <span style={{ fontSize: 11, color: text }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                style={{
                  background: filterCategory === cat ? 'var(--bg-surface-active)' : 'transparent',
                  border: `1px solid ${filterCategory === cat ? 'var(--border-active)' : 'var(--border-glass)'}`,
                  color: filterCategory === cat ? 'var(--violet)' : 'var(--text-muted)',
                  padding: '4px 10px',
                  borderRadius: 99,
                  fontSize: 11.5,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'Inter, sans-serif',
                  textTransform: cat === 'all' ? 'capitalize' : undefined,
                }}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Crosswalk table ────────────────────────────── */}
      <div className="glass-card" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              {/* Source framework header */}
              <th style={{
                padding: '10px 14px',
                textAlign: 'left',
                background: 'rgba(8,11,24,0.95)',
                borderBottom: '1px solid var(--border-glass)',
                backdropFilter: 'blur(12px)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                minWidth: 280,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GitBranch size={12} />
                  NIST 800-53 Rev 5 (Source)
                </div>
              </th>
              {TARGET_FRAMEWORKS.map((fw) => (
                <th key={fw.id} style={{
                  padding: '10px 12px',
                  textAlign: 'center',
                  background: 'rgba(8,11,24,0.95)',
                  borderBottom: '1px solid var(--border-glass)',
                  backdropFilter: 'blur(12px)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  minWidth: 120,
                }}>
                  {fw.shortName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rowIdx) => (
              <tr
                key={row.sourceRef}
                style={{
                  background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  transition: 'background 0.12s ease',
                }}
              >
                {/* Source control */}
                <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ fontSize: 11, fontWeight: 600, color: 'var(--cyan)', background: 'rgba(6,182,212,0.12)', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
                      {row.sourceRef}
                    </code>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                      {row.sourceTitle}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 3, flexShrink: 0 }}>
                      {row.category}
                    </span>
                  </div>
                </td>

                {/* Target framework cells */}
                {TARGET_FRAMEWORKS.map((fw) => {
                  const cell = row.cells[fw.id]
                  const isHovered = hoveredCell?.row === rowIdx && hoveredCell?.col === fw.id
                  return (
                    <td
                      key={fw.id}
                      style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-glass)', textAlign: 'center', position: 'relative' }}
                      onMouseEnter={() => setHoveredCell({ row: rowIdx, col: fw.id })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {cell.confidence !== null ? (
                        <div style={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 1,
                          padding: '5px 8px',
                          background: cellColor(cell),
                          border: `1px solid ${cellBorderColor(cell)}`,
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          minWidth: 72,
                          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                          boxShadow: isHovered ? `0 4px 12px ${cellBorderColor(cell)}` : 'none',
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: cellTextColor(cell) }}>
                            {cell.confidence}%
                          </span>
                          <code style={{ fontSize: 9, color: cellTextColor(cell), opacity: 0.8 }}>
                            {cell.targetRef}
                          </code>
                        </div>
                      ) : (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 72,
                          height: 36,
                          background: 'transparent',
                          border: '1px dashed rgba(255,255,255,0.08)',
                          borderRadius: 'var(--radius-sm)',
                        }}>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>—</span>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Footer hint ────────────────────────────────── */}
      <div style={{ flexShrink: 0, paddingTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Info size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          Mappings resolved via NIST 800-53 canonical anchor. All cross-framework equivalences route through the canonical store — direct string comparison is never used.
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Zap size={11} style={{ color: 'var(--violet)' }} />
          <span style={{ fontSize: 11, color: 'var(--violet)' }}>SCF Crosswalk Active</span>
        </div>
      </div>
    </div>
  )
}
