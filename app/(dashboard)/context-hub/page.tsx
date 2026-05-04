'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Brain,
  Server,
  GitBranch,
  AlertTriangle,
  Target,
  Shield,
  Users,
  FileText,
  Save,
  Eye,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TechItem {
  name: string
  category: 'cloud' | 'app' | 'database' | 'security' | 'other'
}

interface ProcessItem {
  id: string
  name: string
  description: string
  dataTypes: string
  complianceRelevance: string
}

interface AssetItem {
  id: string
  name: string
  type: 'server' | 'database' | 'application' | 'data' | 'endpoint'
  sensitivity: 'low' | 'medium' | 'high' | 'critical'
  description: string
}

interface GoalItem {
  framework: string
  targetDate: string
  selected: boolean
}

interface ContextData {
  techStack: TechItem[]
  businessProcesses: string
  processItems: ProcessItem[]
  riskTolerance: 'low' | 'medium' | 'high'
  complianceGoals: GoalItem[]
  keyAssets: AssetItem[]
  threatActors: string[]
  customThreatActor: string
  regulatoryContext: string
  additionalContext: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TECH_SUGGESTIONS = [
  { name: 'AWS', category: 'cloud' as const },
  { name: 'Azure', category: 'cloud' as const },
  { name: 'GCP', category: 'cloud' as const },
  { name: 'Docker', category: 'app' as const },
  { name: 'Kubernetes', category: 'app' as const },
  { name: 'PostgreSQL', category: 'database' as const },
  { name: 'MySQL', category: 'database' as const },
  { name: 'MongoDB', category: 'database' as const },
  { name: 'Redis', category: 'database' as const },
  { name: 'Okta', category: 'security' as const },
  { name: 'CrowdStrike', category: 'security' as const },
  { name: 'Splunk', category: 'security' as const },
  { name: 'GitHub', category: 'app' as const },
  { name: 'Terraform', category: 'app' as const },
  { name: 'Cloudflare', category: 'security' as const },
]

const FRAMEWORKS = [
  'SOC 2', 'ISO 27001', 'HIPAA', 'PCI DSS', 'NIST CSF', 'FedRAMP', 'GDPR',
  'CCPA', 'SOX', 'CMMC', 'CIS Controls', 'NIST 800-53',
]

const THREAT_ACTORS = [
  'Nation-state',
  'Criminal organizations',
  'Insiders',
  'Script kiddies',
  'Hacktivists',
]

const CATEGORY_COLORS: Record<string, string> = {
  cloud: 'rgba(6,182,212,0.15)',
  app: 'rgba(139,92,246,0.15)',
  database: 'rgba(251,146,60,0.15)',
  security: 'rgba(34,197,94,0.15)',
  other: 'rgba(255,255,255,0.08)',
}

const RISK_OPTIONS = [
  {
    value: 'low' as const,
    label: 'Low',
    color: '#22C55E',
    dot: '#22C55E',
    desc: 'Prioritize stability over speed. Accept minor inefficiencies for higher assurance.',
  },
  {
    value: 'medium' as const,
    label: 'Medium',
    color: '#F59E0B',
    dot: '#F59E0B',
    desc: 'Balanced approach. Accept moderate risk for business agility.',
  },
  {
    value: 'high' as const,
    label: 'High',
    color: '#EF4444',
    dot: '#EF4444',
    desc: 'Aggressive growth posture. Higher risk accepted for competitive advantage.',
  },
]

const SENSITIVITY_COLORS: Record<string, string> = {
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#8B5CF6',
}

// ─── Section component ─────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 18px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            background: 'rgba(139,92,246,0.15)',
            border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={15} color="#8B5CF6" />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)', flex: 1 }}>
          {title}
        </div>
        {open ? (
          <ChevronUp size={15} color="rgba(255,255,255,0.3)" />
        ) : (
          <ChevronDown size={15} color="rgba(255,255,255,0.3)" />
        )}
      </button>
      {open && <div style={{ padding: '16px 18px' }}>{children}</div>}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const DEFAULT_DATA: ContextData = {
  techStack: [],
  businessProcesses: '',
  processItems: [],
  riskTolerance: 'medium',
  complianceGoals: FRAMEWORKS.map((f) => ({ framework: f, targetDate: '', selected: false })),
  keyAssets: [],
  threatActors: [],
  customThreatActor: '',
  regulatoryContext: '',
  additionalContext: '',
}

function genId() {
  return Math.random().toString(36).slice(2)
}

export default function ContextHubPage() {
  const [data, setData] = useState<ContextData>(DEFAULT_DATA)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [newTech, setNewTech] = useState('')
  const [newTechCat, setNewTechCat] = useState<TechItem['category']>('other')

  // Load existing context
  const loadContext = useCallback(async () => {
    try {
      const res = await fetch('/api/context-hub')
      if (res.ok) {
        const { hub } = await res.json()
        if (hub) {
          const ts = (hub.techStack as TechItem[] | null) || []
          const kg = (hub.complianceGoals as GoalItem[] | null) || []
          const ka = (hub.keyAssets as AssetItem[] | null) || []
          const ta = (hub.threatActors as string[] | null) || []

          // Merge saved goals with full framework list
          const mergedGoals = FRAMEWORKS.map((f) => {
            const saved = kg.find((g) => g.framework === f)
            return saved || { framework: f, targetDate: '', selected: false }
          })

          setData({
            techStack: ts,
            businessProcesses: hub.businessProcesses || '',
            processItems: [],
            riskTolerance: (hub.riskTolerance as ContextData['riskTolerance']) || 'medium',
            complianceGoals: mergedGoals,
            keyAssets: ka,
            threatActors: ta,
            customThreatActor: '',
            regulatoryContext: hub.regulatoryContext || '',
            additionalContext: hub.additionalContext || '',
          })
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadContext()
  }, [loadContext])

  const saveAll = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await fetch('/api/context-hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          techStack: data.techStack,
          businessProcesses: data.businessProcesses,
          riskTolerance: data.riskTolerance,
          complianceGoals: data.complianceGoals.filter((g) => g.selected),
          keyAssets: data.keyAssets,
          threatActors: data.threatActors,
          regulatoryContext: data.regulatoryContext,
          additionalContext: data.additionalContext,
        }),
      })
      if (res.ok) {
        setSaveMsg('Saved successfully')
        setTimeout(() => setSaveMsg(''), 3000)
      } else {
        setSaveMsg('Failed to save')
      }
    } catch {
      setSaveMsg('Network error')
    } finally {
      setSaving(false)
    }
  }

  const addTech = (tech: TechItem) => {
    if (data.techStack.some((t) => t.name.toLowerCase() === tech.name.toLowerCase())) return
    setData((d) => ({ ...d, techStack: [...d.techStack, tech] }))
  }

  const removeTech = (name: string) => {
    setData((d) => ({ ...d, techStack: d.techStack.filter((t) => t.name !== name) }))
  }

  const addCustomTech = () => {
    if (!newTech.trim()) return
    addTech({ name: newTech.trim(), category: newTechCat })
    setNewTech('')
  }

  const addAsset = () => {
    setData((d) => ({
      ...d,
      keyAssets: [
        ...d.keyAssets,
        { id: genId(), name: '', type: 'server', sensitivity: 'medium', description: '' },
      ],
    }))
  }

  const updateAsset = (id: string, field: keyof AssetItem, value: string) => {
    setData((d) => ({
      ...d,
      keyAssets: d.keyAssets.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    }))
  }

  const removeAsset = (id: string) => {
    setData((d) => ({ ...d, keyAssets: d.keyAssets.filter((a) => a.id !== id) }))
  }

  const toggleThreatActor = (actor: string) => {
    setData((d) => ({
      ...d,
      threatActors: d.threatActors.includes(actor)
        ? d.threatActors.filter((a) => a !== actor)
        : [...d.threatActors, actor],
    }))
  }

  const addCustomThreatActor = () => {
    if (!data.customThreatActor.trim()) return
    if (data.threatActors.includes(data.customThreatActor.trim())) return
    setData((d) => ({
      ...d,
      threatActors: [...d.threatActors, d.customThreatActor.trim()],
      customThreatActor: '',
    }))
  }

  const buildPreviewPrompt = () => {
    const ts = data.techStack.map((t) => t.name).join(', ') || 'Not configured'
    const rt = data.riskTolerance || 'Not configured'
    const goals =
      data.complianceGoals
        .filter((g) => g.selected)
        .map((g) => g.framework)
        .join(', ') || 'Not configured'
    const bp = data.businessProcesses || 'Not configured'
    const ta = data.threatActors.join(', ') || 'Not configured'

    return `You are CompliGuard AI, a compliance and GRC expert assistant for [Your Organization].

Organization Context:
- Tech Stack: ${ts}
- Risk Tolerance: ${rt}
- Compliance Goals: ${goals}
- Business Context: ${bp}
- Threat Actors: ${ta}
- Regulatory Context: ${data.regulatoryContext || 'Not configured'}
- Additional Context: ${data.additionalContext || 'Not configured'}

Key Assets:
${data.keyAssets.map((a) => `- ${a.name} (${a.type}, sensitivity: ${a.sensitivity})`).join('\n') || 'None configured'}

[Live org data: controls, evidence, findings, tasks will be injected at runtime]`
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading context...</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 4px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 38,
              height: 38,
              background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
              borderRadius: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Brain size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.95)', margin: 0 }}>
              Context Hub
            </h1>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              Configure your organization&apos;s context to power AI-driven compliance insights.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* ── 1. Technology Stack ── */}
        <Section icon={Server} title="Technology Stack">
          {/* Tag cloud */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {data.techStack.map((t) => (
              <div
                key={t.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  background: CATEGORY_COLORS[t.category] || CATEGORY_COLORS.other,
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20,
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                <span>{t.name}</span>
                <span
                  style={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '1px 5px',
                    borderRadius: 10,
                  }}
                >
                  {t.category}
                </span>
                <button
                  onClick={() => removeTech(t.name)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                >
                  <X size={11} color="rgba(255,255,255,0.4)" />
                </button>
              </div>
            ))}
            {data.techStack.length === 0 && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                No technologies added yet.
              </div>
            )}
          </div>

          {/* Suggestions */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Quick Add
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TECH_SUGGESTIONS.filter(
                (s) => !data.techStack.some((t) => t.name === s.name)
              ).map((s) => (
                <button
                  key={s.name}
                  onClick={() => addTech(s)}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.55)',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(139,92,246,0.12)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                  }}
                >
                  + {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Custom add */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newTech}
              onChange={(e) => setNewTech(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomTech()}
              placeholder="Add custom technology..."
              style={inputStyle}
            />
            <select
              value={newTechCat}
              onChange={(e) => setNewTechCat(e.target.value as TechItem['category'])}
              style={{ ...inputStyle, maxWidth: 120 }}
            >
              <option value="cloud">Cloud</option>
              <option value="app">App</option>
              <option value="database">Database</option>
              <option value="security">Security</option>
              <option value="other">Other</option>
            </select>
            <button onClick={addCustomTech} style={addBtnStyle}>
              <Plus size={14} />
            </button>
          </div>
        </Section>

        {/* ── 2. Business Processes ── */}
        <Section icon={GitBranch} title="Business Processes">
          <textarea
            value={data.businessProcesses}
            onChange={(e) => setData((d) => ({ ...d, businessProcesses: e.target.value }))}
            placeholder="Describe your core business processes, workflows, and operations relevant to compliance..."
            rows={5}
            style={{
              ...inputStyle,
              width: '100%',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.6,
            }}
          />
          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            Examples: payment processing, customer data handling, employee onboarding, software
            development lifecycle, incident response.
          </div>
        </Section>

        {/* ── 3. Risk Tolerance ── */}
        <Section icon={AlertTriangle} title="Risk Tolerance">
          <div style={{ display: 'flex', gap: 12 }}>
            {RISK_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setData((d) => ({ ...d, riskTolerance: opt.value }))}
                style={{
                  flex: 1,
                  padding: '14px 12px',
                  background:
                    data.riskTolerance === opt.value
                      ? `rgba(${hexToRgb(opt.color)},0.12)`
                      : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${data.riskTolerance === opt.value ? opt.color : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: opt.dot,
                    margin: '0 auto 8px',
                    boxShadow: data.riskTolerance === opt.value ? `0 0 10px ${opt.dot}` : 'none',
                  }}
                />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* ── 4. Compliance Goals ── */}
        <Section icon={Target} title="Compliance Goals">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 10,
            }}
          >
            {data.complianceGoals.map((goal) => (
              <div
                key={goal.framework}
                style={{
                  padding: '10px 12px',
                  background: goal.selected ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${goal.selected ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 9,
                  transition: 'all 0.15s',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={goal.selected}
                    onChange={() =>
                      setData((d) => ({
                        ...d,
                        complianceGoals: d.complianceGoals.map((g) =>
                          g.framework === goal.framework ? { ...g, selected: !g.selected } : g
                        ),
                      }))
                    }
                    style={{ accentColor: '#8B5CF6', width: 14, height: 14, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                    {goal.framework}
                  </span>
                </label>
                {goal.selected && (
                  <input
                    type="date"
                    value={goal.targetDate}
                    onChange={(e) =>
                      setData((d) => ({
                        ...d,
                        complianceGoals: d.complianceGoals.map((g) =>
                          g.framework === goal.framework
                            ? { ...g, targetDate: e.target.value }
                            : g
                        ),
                      }))
                    }
                    style={{ ...inputStyle, marginTop: 8, fontSize: 11 }}
                  />
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* ── 5. Key Assets ── */}
        <Section icon={Shield} title="Key Assets">
          {data.keyAssets.length === 0 ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
              No assets added. Add your key infrastructure and data assets.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {data.keyAssets.map((asset) => (
                <div
                  key={asset.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 130px 130px 1fr 32px',
                    gap: 8,
                    alignItems: 'center',
                    padding: '10px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 8,
                  }}
                >
                  <input
                    value={asset.name}
                    onChange={(e) => updateAsset(asset.id, 'name', e.target.value)}
                    placeholder="Asset name"
                    style={inputStyle}
                  />
                  <select
                    value={asset.type}
                    onChange={(e) => updateAsset(asset.id, 'type', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="server">Server</option>
                    <option value="database">Database</option>
                    <option value="application">Application</option>
                    <option value="data">Data</option>
                    <option value="endpoint">Endpoint</option>
                  </select>
                  <select
                    value={asset.sensitivity}
                    onChange={(e) => updateAsset(asset.id, 'sensitivity', e.target.value)}
                    style={{
                      ...inputStyle,
                      color: SENSITIVITY_COLORS[asset.sensitivity],
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <input
                    value={asset.description}
                    onChange={(e) => updateAsset(asset.id, 'description', e.target.value)}
                    placeholder="Description"
                    style={inputStyle}
                  />
                  <button
                    onClick={() => removeAsset(asset.id)}
                    style={{
                      padding: 6,
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 7,
                      cursor: 'pointer',
                      color: '#EF4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button onClick={addAsset} style={addBtnStyle}>
            <Plus size={14} />
            Add Asset
          </button>
        </Section>

        {/* ── 6. Threat Actors ── */}
        <Section icon={Users} title="Threat Actors">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {THREAT_ACTORS.map((actor) => (
              <button
                key={actor}
                onClick={() => toggleThreatActor(actor)}
                style={{
                  padding: '7px 14px',
                  background: data.threatActors.includes(actor)
                    ? 'rgba(239,68,68,0.12)'
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${
                    data.threatActors.includes(actor)
                      ? 'rgba(239,68,68,0.35)'
                      : 'rgba(255,255,255,0.08)'
                  }`,
                  borderRadius: 20,
                  cursor: 'pointer',
                  fontSize: 12.5,
                  color: data.threatActors.includes(actor)
                    ? '#FCA5A5'
                    : 'rgba(255,255,255,0.55)',
                  transition: 'all 0.12s',
                }}
              >
                {actor}
              </button>
            ))}
            {/* Custom threat actors */}
            {data.threatActors
              .filter((a) => !THREAT_ACTORS.includes(a))
              .map((actor) => (
                <button
                  key={actor}
                  onClick={() => toggleThreatActor(actor)}
                  style={{
                    padding: '7px 14px',
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.35)',
                    borderRadius: 20,
                    cursor: 'pointer',
                    fontSize: 12.5,
                    color: '#FCA5A5',
                    transition: 'all 0.12s',
                  }}
                >
                  {actor} &times;
                </button>
              ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={data.customThreatActor}
              onChange={(e) => setData((d) => ({ ...d, customThreatActor: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && addCustomThreatActor()}
              placeholder="Add custom threat actor..."
              style={inputStyle}
            />
            <button onClick={addCustomThreatActor} style={addBtnStyle}>
              <Plus size={14} />
            </button>
          </div>
        </Section>

        {/* ── 7. Regulatory Context ── */}
        <Section icon={FileText} title="Regulatory Context">
          <textarea
            value={data.regulatoryContext}
            onChange={(e) => setData((d) => ({ ...d, regulatoryContext: e.target.value }))}
            placeholder="Describe your regulatory environment — industry, jurisdictions, special requirements (e.g. 'Healthcare company operating in EU and US, subject to HIPAA and GDPR')..."
            rows={4}
            style={{
              ...inputStyle,
              width: '100%',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.6,
            }}
          />
        </Section>

        {/* ── 8. Additional Context ── */}
        <Section icon={Brain} title="Additional Context">
          <textarea
            value={data.additionalContext}
            onChange={(e) => setData((d) => ({ ...d, additionalContext: e.target.value }))}
            placeholder="Any additional context you want the AI to know about your organization, compliance history, ongoing projects, or special considerations..."
            rows={4}
            style={{
              ...inputStyle,
              width: '100%',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.6,
            }}
          />
        </Section>
      </div>

      {/* Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          marginTop: 20,
          padding: '16px 18px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
        }}
      >
        {saveMsg && (
          <span
            style={{
              fontSize: 12,
              color: saveMsg.includes('success') ? '#22C55E' : '#EF4444',
              marginRight: 8,
            }}
          >
            {saveMsg}
          </span>
        )}
        <button
          onClick={() => setShowPreview(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '9px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 9,
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.75)',
            fontSize: 13,
            fontWeight: 500,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          <Eye size={14} />
          Preview AI Prompt
        </button>

        <button
          onClick={saveAll}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '9px 20px',
            background: saving
              ? 'rgba(139,92,246,0.3)'
              : 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
            border: 'none',
            borderRadius: 9,
            cursor: saving ? 'not-allowed' : 'pointer',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            transition: 'opacity 0.15s',
          }}
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowPreview(false)}
        >
          <div
            style={{
              background: '#0F1220',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              padding: '20px 24px',
              maxWidth: 680,
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                AI System Prompt Preview
              </div>
              <button
                onClick={() => setShowPreview(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.4)',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <pre
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                padding: '14px 16px',
                fontSize: 12,
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                overflow: 'auto',
              }}
            >
              {buildPreviewPrompt()}
            </pre>
            <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              This prompt is sent to the AI before each conversation. Save your context to update
              it.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '255,255,255'
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: 'rgba(255,255,255,0.85)',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
}

const addBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  background: 'rgba(139,92,246,0.15)',
  border: '1px solid rgba(139,92,246,0.3)',
  borderRadius: 8,
  cursor: 'pointer',
  color: '#a78bfa',
  fontSize: 13,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  flexShrink: 0,
}
