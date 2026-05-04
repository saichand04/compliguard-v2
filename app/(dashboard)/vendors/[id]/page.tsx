'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Building2, ArrowLeft, Globe, Mail, User, Calendar,
  AlertTriangle, Shield, FileText, ClipboardList, CheckCircle2,
  Save, RefreshCw, Plus, ChevronRight,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Vendor {
  id: string
  name: string
  website: string | null
  contactName: string | null
  contactEmail: string | null
  category: string | null
  description: string | null
  status: 'active' | 'inactive' | 'under_review' | 'terminated'
  inherentRiskLevel: 'low' | 'medium' | 'high' | 'critical' | null
  residualRiskLevel: 'low' | 'medium' | 'high' | 'critical' | null
  riskScore: number | null
  dpaStatus: string | null
  dpaSignedAt: string | null
  nextReviewDate: string | null
  ownerId: string | null
  createdAt: string
  updatedAt: string
}

interface Assessment {
  id: string
  vendorId: string
  assessmentDate: string
  inherentScore: number | null
  residualScore: number | null
  findings: string | null
  recommendations: string | null
  conductedBy: string | null
  nextAssessmentDate: string | null
  createdAt: string
}

interface Questionnaire {
  id: string
  title: string
  status: string
  dueDate: string | null
  sentAt: string | null
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#22C55E',
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not set</span>
  const c = RISK_COLORS[level] ?? '#94A3B8'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, background: `${c}18`, border: `1px solid ${c}40`, color: c, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
      {level}
    </span>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ vendor, onUpdate }: { vendor: Vendor; onUpdate: (v: Vendor) => void }) {
  const [form, setForm] = useState({
    name: vendor.name,
    website: vendor.website ?? '',
    category: vendor.category ?? '',
    contactName: vendor.contactName ?? '',
    contactEmail: vendor.contactEmail ?? '',
    description: vendor.description ?? '',
    status: vendor.status,
    nextReviewDate: vendor.nextReviewDate ? new Date(vendor.nextReviewDate).toISOString().split('T')[0] : '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          website: form.website || null,
          category: form.category || null,
          contactName: form.contactName || null,
          contactEmail: form.contactEmail || null,
          description: form.description || null,
          nextReviewDate: form.nextReviewDate || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        onUpdate(data.vendor)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof typeof form, type: string = 'text', full?: boolean) => (
    <div style={full ? { gridColumn: '1 / -1' } : {}}>
      <label style={labelStyle}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      ) : type === 'select' ? (
        <select
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="under_review">Under Review</option>
          <option value="terminated">Terminated</option>
        </select>
      ) : (
        <input
          type={type}
          value={form[key] as string}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          style={inputStyle}
        />
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {field('Vendor Name', 'name')}
        {field('Category', 'category')}
        {field('Website', 'website', 'url')}
        {field('Status', 'status', 'select')}
        {field('Contact Name', 'contactName')}
        {field('Contact Email', 'contactEmail', 'email')}
        {field('Next Review Date', 'nextReviewDate', 'date')}
        {field('Description', 'description', 'textarea', true)}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: saved ? '#22C55E' : '#8B5CF6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}
        >
          {saved ? <><CheckCircle2 size={14} /> Saved</> : saving ? 'Saving…' : <><Save size={14} /> Save Changes</>}
        </button>
      </div>
    </div>
  )
}

// ── Tab: Risk Assessment ──────────────────────────────────────────────────────

function RiskAssessmentTab({ vendor, onUpdate }: { vendor: Vendor; onUpdate: (v: Vendor) => void }) {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    inherentLikelihood: '3',
    inherentImpact: '3',
    residualLikelihood: '2',
    residualImpact: '2',
    inherentRiskLevel: vendor.inherentRiskLevel ?? 'medium',
    residualRiskLevel: vendor.residualRiskLevel ?? 'low',
    riskScore: String(vendor.riskScore ?? ''),
    findings: '',
    recommendations: '',
    nextAssessmentDate: '',
    dpaStatus: vendor.dpaStatus ?? '',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/vendors/${vendor.id}/risk-assessment`)
      .then((r) => r.json())
      .then((d) => setAssessments(Array.isArray(d.assessments) ? d.assessments : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [vendor.id])

  useEffect(() => { load() }, [load])

  const inherentScore = parseInt(form.inherentLikelihood) * parseInt(form.inherentImpact)
  const residualScore = parseInt(form.residualLikelihood) * parseInt(form.residualImpact)

  const scoreToLevel = (score: number): 'low' | 'medium' | 'high' | 'critical' => {
    if (score >= 20) return 'critical'
    if (score >= 12) return 'high'
    if (score >= 6) return 'medium'
    return 'low'
  }

  const handleRunAssessment = async () => {
    setSaving(true)
    try {
      const autoInherentLevel = scoreToLevel(inherentScore)
      const autoResidualLevel = scoreToLevel(residualScore)
      const autoRiskScore = Math.round((inherentScore / 25) * 100)
      const res = await fetch(`/api/vendors/${vendor.id}/risk-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inherentScore,
          residualScore,
          inherentRiskLevel: autoInherentLevel,
          residualRiskLevel: autoResidualLevel,
          riskScore: autoRiskScore,
          findings: form.findings || undefined,
          recommendations: form.recommendations || undefined,
          nextAssessmentDate: form.nextAssessmentDate || undefined,
        }),
      })
      if (res.ok) {
        const updated = await fetch(`/api/vendors/${vendor.id}`).then((r) => r.json())
        if (updated.vendor) onUpdate(updated.vendor)
        load()
        setShowForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const matrixCell = (val: string, current: string, setter: (v: string) => void) => (
    <button
      key={val}
      onClick={() => setter(val)}
      style={{
        width: 36, height: 36, borderRadius: 6, border: `1px solid ${current === val ? '#8B5CF6' : 'rgba(255,255,255,0.1)'}`,
        background: current === val ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.03)',
        color: current === val ? '#8B5CF6' : 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}
    >
      {val}
    </button>
  )

  const scoreColor = (s: number) => s >= 20 ? '#EF4444' : s >= 12 ? '#F97316' : s >= 6 ? '#EAB308' : '#22C55E'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Current risk state */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { label: 'Inherent Risk', value: vendor.inherentRiskLevel, type: 'badge' },
          { label: 'Residual Risk', value: vendor.residualRiskLevel, type: 'badge' },
          { label: 'Risk Score', value: vendor.riskScore, type: 'score' },
        ].map((item) => (
          <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{item.label}</div>
            {item.type === 'badge' ? (
              <RiskBadge level={item.value as string | null} />
            ) : (
              <span style={{ fontSize: 24, fontWeight: 700, color: item.value !== null ? '#8B5CF6' : 'var(--text-muted)' }}>
                {item.value ?? '—'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* DPA Section */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Data Processing Agreement</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>DPA Status</label>
            <select
              value={vendor.dpaStatus ?? ''}
              onChange={async (e) => {
                const val = e.target.value
                const res = await fetch(`/api/vendors/${vendor.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ dpaStatus: val || null }),
                })
                if (res.ok) { const d = await res.json(); onUpdate(d.vendor) }
              }}
              style={inputStyle}
            >
              <option value="">Not set</option>
              <option value="signed">Signed</option>
              <option value="pending">Pending</option>
              <option value="not_required">Not Required</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Signed Date</label>
            <input
              type="date"
              value={vendor.dpaSignedAt ? new Date(vendor.dpaSignedAt).toISOString().split('T')[0] : ''}
              onChange={async (e) => {
                const res = await fetch(`/api/vendors/${vendor.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ dpaSignedAt: e.target.value || null }),
                })
                if (res.ok) { const d = await res.json(); onUpdate(d.vendor) }
              }}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Run Assessment */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk Matrix Assessment</div>
          <button
            onClick={() => setShowForm((f) => !f)}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={12} /> Run Assessment
          </button>
        </div>

        {showForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Inherent matrix */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Inherent Risk</div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Likelihood (1–5)</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['1','2','3','4','5'].map((v) => matrixCell(v, form.inherentLikelihood, (val) => setForm((f) => ({ ...f, inherentLikelihood: val }))))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Impact (1–5)</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['1','2','3','4','5'].map((v) => matrixCell(v, form.inherentImpact, (val) => setForm((f) => ({ ...f, inherentImpact: val }))))}
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: scoreColor(inherentScore), fontWeight: 700 }}>
                  Score: {inherentScore} / 25 → {scoreToLevel(inherentScore).toUpperCase()}
                </div>
              </div>
              {/* Residual matrix */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Residual Risk</div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Likelihood (1–5)</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['1','2','3','4','5'].map((v) => matrixCell(v, form.residualLikelihood, (val) => setForm((f) => ({ ...f, residualLikelihood: val }))))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Impact (1–5)</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['1','2','3','4','5'].map((v) => matrixCell(v, form.residualImpact, (val) => setForm((f) => ({ ...f, residualImpact: val }))))}
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: scoreColor(residualScore), fontWeight: 700 }}>
                  Score: {residualScore} / 25 → {scoreToLevel(residualScore).toUpperCase()}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Findings</label>
                <textarea
                  value={form.findings}
                  onChange={(e) => setForm((f) => ({ ...f, findings: e.target.value }))}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="Findings from the assessment…"
                />
              </div>
              <div>
                <label style={labelStyle}>Recommendations</label>
                <textarea
                  value={form.recommendations}
                  onChange={(e) => setForm((f) => ({ ...f, recommendations: e.target.value }))}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="Recommended actions…"
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Next Assessment Date</label>
                <input type="date" value={form.nextAssessmentDate} onChange={(e) => setForm((f) => ({ ...f, nextAssessmentDate: e.target.value }))} style={inputStyle} />
              </div>
              <button
                onClick={handleRunAssessment}
                disabled={saving}
                style={{ marginTop: 18, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Saving…' : 'Save Assessment'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Assessment History</div>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
        ) : assessments.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No assessments yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assessments.map((a) => (
              <div key={a.id} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {new Date(a.assessmentDate ?? a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {a.inherentScore !== null && <span style={{ fontSize: 11, color: scoreColor(a.inherentScore), fontWeight: 600 }}>I: {a.inherentScore}</span>}
                    {a.residualScore !== null && <span style={{ fontSize: 11, color: scoreColor(a.residualScore), fontWeight: 600 }}>R: {a.residualScore}</span>}
                  </div>
                </div>
                {a.findings && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{a.findings}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Questionnaires ───────────────────────────────────────────────────────

function QuestionnairesTab({ vendor }: { vendor: Vendor }) {
  const router = useRouter()
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/questionnaires')
      .then((r) => r.json())
      .then((d) => {
        const all: Questionnaire[] = Array.isArray(d.questionnaires) ? d.questionnaires : []
        setQuestionnaires(all.filter((q) => (q as unknown as { vendorId: string | null }).vendorId === vendor.id))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [vendor.id])

  const STATUS_COLORS: Record<string, string> = {
    draft: '#94A3B8', sent: '#8B5CF6', in_progress: '#F97316', completed: '#22C55E', expired: '#EF4444',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => router.push('/vendors/questionnaires')}
          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} /> New Questionnaire
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
      ) : questionnaires.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
          <ClipboardList size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
          <p style={{ fontSize: 13, margin: 0 }}>No questionnaires sent to this vendor yet.</p>
        </div>
      ) : (
        questionnaires.map((q) => (
          <div
            key={q.id}
            onClick={() => router.push(`/vendors/questionnaires/${q.id}`)}
            style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{q.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Created {new Date(q.createdAt).toLocaleDateString()}
                {q.sentAt && ` · Sent ${new Date(q.sentAt).toLocaleDateString()}`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLORS[q.status] ?? '#94A3B8', background: `${STATUS_COLORS[q.status] ?? '#94A3B8'}18`, border: `1px solid ${STATUS_COLORS[q.status] ?? '#94A3B8'}40`, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
                {q.status.replace('_', ' ')}
              </span>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ── Tab: Documents ────────────────────────────────────────────────────────────

function DocumentsTab() {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
      <FileText size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
      <p style={{ fontSize: 14, margin: '0 0 4px', color: 'var(--text-secondary)', fontWeight: 600 }}>Documents</p>
      <p style={{ fontSize: 13, margin: 0 }}>Evidence and documents for this vendor will appear here once the evidence module is linked.</p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'risk' | 'questionnaires' | 'documents'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: Building2 },
  { key: 'risk', label: 'Risk Assessment', icon: AlertTriangle },
  { key: 'questionnaires', label: 'Questionnaires', icon: ClipboardList },
  { key: 'documents', label: 'Documents', icon: FileText },
]

export default function VendorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  useEffect(() => {
    fetch(`/api/vendors/${id}`)
      .then((r) => r.json())
      .then((d) => setVendor(d.vendor ?? null))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        Loading vendor…
      </div>
    )
  }

  if (!vendor) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <Building2 size={40} style={{ opacity: 0.2 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Vendor not found.</p>
        <button onClick={() => router.push('/vendors')} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
          Back to Vendors
        </button>
      </div>
    )
  }

  const RISK_COLORS_MAP: Record<string, string> = {
    critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#22C55E',
  }
  const riskColor = vendor.inherentRiskLevel ? RISK_COLORS_MAP[vendor.inherentRiskLevel] : '#94A3B8'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <button
          onClick={() => router.push('/vendors')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: '0 0 12px', marginBottom: 4 }}
        >
          <ArrowLeft size={13} /> Back to Vendors
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${riskColor}18`, border: `1px solid ${riskColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={20} style={{ color: riskColor }} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{vendor.name}</h1>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {vendor.category && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{vendor.category}</span>}
                {vendor.website && (
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Globe size={11} /> Website
                  </a>
                )}
                {vendor.contactEmail && (
                  <a href={`mailto:${vendor.contactEmail}`} style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mail size={11} /> {vendor.contactName ?? vendor.contactEmail}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {vendor.inherentRiskLevel && (
              <span style={{ fontSize: 11, fontWeight: 700, color: riskColor, background: `${riskColor}18`, border: `1px solid ${riskColor}40`, padding: '3px 10px', borderRadius: 20, textTransform: 'capitalize' }}>
                {vendor.inherentRiskLevel} Risk
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', display: 'flex', gap: 4, flexShrink: 0 }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
              color: activeTab === key ? '#8B5CF6' : 'var(--text-muted)',
              borderBottom: activeTab === key ? '2px solid #8B5CF6' : '2px solid transparent',
              fontSize: 13, fontWeight: activeTab === key ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'color 0.15s',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {activeTab === 'overview' && <OverviewTab vendor={vendor} onUpdate={setVendor} />}
        {activeTab === 'risk' && <RiskAssessmentTab vendor={vendor} onUpdate={setVendor} />}
        {activeTab === 'questionnaires' && <QuestionnairesTab vendor={vendor} />}
        {activeTab === 'documents' && <DocumentsTab />}
      </div>
    </div>
  )
}
