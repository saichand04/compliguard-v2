'use client'

import { useState } from 'react'
import {
  CheckSquare, Search, ChevronRight, Link2, Shield,
  BookOpen, ExternalLink, Filter, Tag, Zap, GitBranch,
} from 'lucide-react'

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_FRAMEWORKS = [
  { id: 'nist',    name: 'NIST 800-53 Rev 5', shortName: 'NIST',    color: 'var(--violet)',  controls: 1189, mapped: 1189 },
  { id: 'hitrust', name: 'HITRUST CSF v11',   shortName: 'HITRUST', color: 'var(--cyan)',    controls: 833,  mapped: 712 },
  { id: 'iso',     name: 'ISO 27001:2022',    shortName: 'ISO27K',  color: 'var(--emerald)', controls: 93,   mapped: 89 },
  { id: 'soc2',    name: 'SOC 2 Type II',     shortName: 'SOC2',    color: 'var(--amber)',   controls: 64,   mapped: 61 },
  { id: 'pci',     name: 'PCI DSS v4.0',      shortName: 'PCI',     color: 'var(--rose)',    controls: 286,  mapped: 201 },
]

interface DemoControl {
  id: string
  ref: string
  title: string
  category: string
  description: string
  canonicalNist: string
  mappedCount: number
  status: 'implemented' | 'in_progress' | 'not_started' | 'needs_review'
}

const DEMO_CONTROLS: Record<string, DemoControl[]> = {
  nist: [
    { id: '1', ref: 'AC-1',  title: 'Access Control Policy and Procedures', category: 'Access Control', description: 'Develop, document, and disseminate access control policy and procedures.', canonicalNist: 'AC-1',  mappedCount: 8,  status: 'implemented' },
    { id: '2', ref: 'AC-2',  title: 'Account Management',                   category: 'Access Control', description: 'Manage information system accounts, including establishing, activating, modifying, reviewing, disabling, and removing accounts.', canonicalNist: 'AC-2',  mappedCount: 12, status: 'implemented' },
    { id: '3', ref: 'AC-3',  title: 'Access Enforcement',                   category: 'Access Control', description: 'Enforce approved authorizations for logical access to information and system resources.', canonicalNist: 'AC-3',  mappedCount: 9,  status: 'in_progress' },
    { id: '4', ref: 'AC-6',  title: 'Least Privilege',                      category: 'Access Control', description: 'Employ the principle of least privilege, allowing only authorized accesses for users.', canonicalNist: 'AC-6',  mappedCount: 11, status: 'implemented' },
    { id: '5', ref: 'SI-2',  title: 'Flaw Remediation',                     category: 'System Integrity', description: 'Identify, report, and correct information system flaws.', canonicalNist: 'SI-2',  mappedCount: 7,  status: 'needs_review' },
    { id: '6', ref: 'SI-3',  title: 'Malicious Code Protection',            category: 'System Integrity', description: 'Implement malicious code protection mechanisms at system entry and exit points.', canonicalNist: 'SI-3',  mappedCount: 6,  status: 'in_progress' },
    { id: '7', ref: 'IR-4',  title: 'Incident Handling',                    category: 'Incident Response', description: 'Implement an incident handling capability for security incidents.', canonicalNist: 'IR-4',  mappedCount: 8,  status: 'not_started' },
    { id: '8', ref: 'CM-2',  title: 'Baseline Configuration',               category: 'Config Mgmt', description: 'Develop, document, and maintain a current baseline configuration of the system.', canonicalNist: 'CM-2',  mappedCount: 5,  status: 'implemented' },
  ],
  hitrust: [
    { id: 'h1', ref: '09.ab.01', title: 'User Registration and De-Registration', category: 'Access Control', description: 'Implement a formal user registration and de-registration process for granting and revoking access to all information systems and services.', canonicalNist: 'AC-2', mappedCount: 6, status: 'implemented' },
    { id: 'h2', ref: '09.ac.01', title: 'User Password Management',              category: 'Access Control', description: 'Use a formal management process to control passwords in the information system.', canonicalNist: 'IA-5', mappedCount: 4, status: 'in_progress' },
    { id: 'h3', ref: '01.a.01',  title: 'Information Security Policy',           category: 'Policy',         description: 'An information security policy document shall be approved by management, published and communicated.', canonicalNist: 'PM-1', mappedCount: 5, status: 'implemented' },
    { id: 'h4', ref: '08.a.01',  title: 'Reporting Information Security Events', category: 'Incident Mgmt',  description: 'Information security events shall be reported through appropriate management channels as quickly as possible.', canonicalNist: 'IR-6', mappedCount: 7, status: 'needs_review' },
  ],
  iso: [
    { id: 'i1', ref: 'A.5.1',  title: 'Policies for Information Security',     category: 'Org Policies',  description: 'Information security policy and topic-specific policies shall be defined, approved by management.', canonicalNist: 'PM-1', mappedCount: 8,  status: 'implemented' },
    { id: 'i2', ref: 'A.9.1',  title: 'Access Control Policy',                 category: 'Access Control', description: 'Access control rules, rights and restrictions shall be established based on business and information security requirements.', canonicalNist: 'AC-1', mappedCount: 6,  status: 'implemented' },
    { id: 'i3', ref: 'A.12.6', title: 'Management of Technical Vulnerabilities', category: 'Operations',    description: 'Information about technical vulnerabilities of information systems in use shall be obtained in a timely fashion.', canonicalNist: 'SI-2', mappedCount: 4,  status: 'in_progress' },
  ],
  soc2: [
    { id: 's1', ref: 'CC1.1', title: 'COSO Principle 1',  category: 'CC1', description: 'The entity demonstrates a commitment to integrity and ethical values.', canonicalNist: 'PM-1', mappedCount: 3, status: 'implemented' },
    { id: 's2', ref: 'CC6.1', title: 'Logical Access Controls', category: 'CC6', description: 'The entity implements logical access security software, infrastructure, and architectures.', canonicalNist: 'AC-1', mappedCount: 9, status: 'implemented' },
    { id: 's3', ref: 'CC7.2', title: 'Monitoring of System Components', category: 'CC7', description: 'The entity monitors system components and the operation of those controls.', canonicalNist: 'SI-4', mappedCount: 6, status: 'in_progress' },
  ],
  pci: [
    { id: 'p1', ref: '1.1.1', title: 'Firewall Configuration Standards', category: 'Network Security', description: 'A formal process exists for approving and testing all network connections and changes to firewall and router configurations.', canonicalNist: 'SC-7', mappedCount: 5, status: 'implemented' },
    { id: 'p2', ref: '3.4.1', title: 'Encryption of Stored Cardholder Data', category: 'Data Protection', description: 'Primary account number (PAN) is masked when displayed such that only personnel with a legitimate need can see more than the first six/last four digits.', canonicalNist: 'SC-28', mappedCount: 7, status: 'needs_review' },
  ],
}

const STATUS_COLORS: Record<string, string> = {
  implemented: 'var(--emerald)',
  in_progress: 'var(--amber)',
  not_started: 'var(--text-muted)',
  needs_review: 'var(--rose)',
}

const STATUS_LABELS: Record<string, string> = {
  implemented: 'Implemented',
  in_progress: 'In Progress',
  not_started: 'Not Started',
  needs_review: 'Needs Review',
}

// ── Page component ────────────────────────────────────────────────────────────

export default function ControlsPage() {
  const [selectedFramework, setSelectedFramework] = useState<string>('nist')
  const [selectedControl, setSelectedControl] = useState<DemoControl | null>(null)
  const [search, setSearch] = useState('')

  const frameworkControls = DEMO_CONTROLS[selectedFramework] ?? []
  const filtered = frameworkControls.filter(
    (c) =>
      !search ||
      c.ref.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  )

  const activeFramework = DEMO_FRAMEWORKS.find((f) => f.id === selectedFramework)

  return (
    <div
      className="animate-fade-in"
      style={{
        height: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Page header ──────────────────────────────────── */}
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 3 }}>
              Controls Library
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Browse, search, and trace cross-framework control mappings
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 12px' }}>
              <Filter size={13} /> Filter
            </button>
            <a href="/frameworks/upload" className="btn-primary" style={{ fontSize: 12, padding: '7px 14px', textDecoration: 'none' }}>
              <Shield size={13} /> Upload Framework
            </a>
          </div>
        </div>
      </div>

      {/* ── 3-column layout ───────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr 380px', gap: 12, overflow: 'hidden', minHeight: 0 }}>

        {/* ── Column 1: Framework list ───────────────────── */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 8px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 8px', marginBottom: 8 }}>
            Frameworks
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {DEMO_FRAMEWORKS.map((fw) => {
              const active = fw.id === selectedFramework
              const pct = Math.round((fw.mapped / fw.controls) * 100)
              return (
                <button
                  key={fw.id}
                  onClick={() => { setSelectedFramework(fw.id); setSelectedControl(null) }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: active ? 'var(--bg-surface-active)' : 'transparent',
                    border: `1px solid ${active ? 'var(--border-active)' : 'transparent'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '9px 10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    marginBottom: 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: fw.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: active ? 600 : 450, color: active ? 'var(--violet)' : 'var(--text-secondary)', flex: 1 }}>
                      {fw.shortName}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{pct}%</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', paddingLeft: 15, marginBottom: 5 }}>
                    {fw.controls.toLocaleString()} controls
                  </div>
                  <div style={{ paddingLeft: 15 }}>
                    <div className="progress-track" style={{ height: 3 }}>
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Column 2: Controls list ────────────────────── */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Search bar */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-glass)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="cg-input"
                  placeholder={`Search ${activeFramework?.name ?? ''} controls…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 32, fontSize: 12.5, padding: '7px 10px 7px 32px' }}
                />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {filtered.length} results
              </span>
            </div>
          </div>

          {/* Control list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No controls match your search
              </div>
            ) : (
              filtered.map((control) => {
                const isSelected = selectedControl?.id === control.id
                return (
                  <button
                    key={control.id}
                    onClick={() => setSelectedControl(control)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: isSelected ? 'var(--bg-surface-active)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--border-active)' : 'transparent'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      marginBottom: 2,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                          <code style={{ fontSize: 11, fontWeight: 600, color: isSelected ? 'var(--violet)' : 'var(--cyan)', background: 'rgba(6,182,212,0.12)', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
                            {control.ref}
                          </code>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {control.title}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{control.category}</span>
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0 }} />
                          <span style={{ fontSize: 10.5, color: STATUS_COLORS[control.status] }}>{STATUS_LABELS[control.status]}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <Link2 size={11} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{control.mappedCount}</span>
                        <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Column 3: Mapping panel ────────────────────── */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedControl ? (
            <>
              {/* Control header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-glass)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <code style={{ fontSize: 11, fontWeight: 600, color: 'var(--cyan)', background: 'rgba(6,182,212,0.12)', padding: '2px 7px', borderRadius: 4 }}>
                    {selectedControl.ref}
                  </code>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[selectedControl.status] }} />
                  <span style={{ fontSize: 10.5, color: STATUS_COLORS[selectedControl.status] }}>
                    {STATUS_LABELS[selectedControl.status]}
                  </span>
                </div>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.35 }}>
                  {selectedControl.title}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {selectedControl.description}
                </p>
              </div>

              {/* Canonical NIST anchor */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-glass)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, background: 'var(--violet-dim)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={11} style={{ color: 'var(--violet)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>NIST Canonical Anchor</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--violet)' }}>{selectedControl.canonicalNist}</div>
                  </div>
                </div>
              </div>

              {/* Cross-framework mappings */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <GitBranch size={12} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Cross-Framework Mappings
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-muted)' }}>
                    {selectedControl.mappedCount} controls
                  </span>
                </div>

                {/* Demo mapped controls */}
                {[
                  { fw: 'HITRUST', ref: '09.ab.01', type: 'direct', conf: 92 },
                  { fw: 'ISO 27001', ref: 'A.9.2.1', type: 'direct', conf: 88 },
                  { fw: 'SOC 2', ref: 'CC6.2', type: 'partial', conf: 74 },
                  { fw: 'PCI DSS', ref: '8.1.1', type: 'partial', conf: 71 },
                  { fw: 'CMMC', ref: 'AC.1.001', type: 'direct', conf: 95 },
                ].map((m, i) => {
                  const confColor = m.conf >= 80 ? 'var(--emerald)' : m.conf >= 50 ? '#FBBF24' : '#F97316'
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 6,
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 3 }}>
                            {m.fw}
                          </span>
                          <code style={{ fontSize: 11, color: 'var(--cyan)' }}>{m.ref}</code>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                          {m.type === 'direct' ? 'Direct mapping' : 'Partial mapping'} via NIST {selectedControl.canonicalNist}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: confColor }}>{m.conf}%</span>
                        <span style={{ fontSize: 9.5, color: confColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.type}</span>
                      </div>
                    </div>
                  )
                })}

                {/* AI suggestions section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 10 }}>
                  <Zap size={11} style={{ color: 'var(--violet)' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    AI Suggestions
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 6px', background: 'var(--violet-dim)', color: 'var(--violet)', borderRadius: 99, border: '1px solid rgba(139,92,246,0.25)' }}>
                    Phase 2
                  </span>
                </div>
                <div style={{ padding: '12px', background: 'var(--violet-dim)', border: '1px solid rgba(139,92,246,0.20)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  AI-powered mapping suggestions will be available in Phase 2. The mapping engine is currently using SCF crosswalk data for automated resolution.
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-glass)', flexShrink: 0, display: 'flex', gap: 8 }}>
                <button className="btn-primary" style={{ flex: 1, fontSize: 12, padding: '8px 12px' }}>
                  <Link2 size={12} /> Add Mapping
                </button>
                <button className="btn-ghost" style={{ fontSize: 12, padding: '8px 12px' }}>
                  <ExternalLink size={12} />
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, background: 'var(--violet-dim)', border: '1px solid rgba(139,92,246,0.20)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <CheckSquare size={20} style={{ color: 'var(--violet)' }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Select a control
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Choose a control from the list to view its cross-framework mappings, canonical NIST anchor, and evidence inheritance chain.
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
