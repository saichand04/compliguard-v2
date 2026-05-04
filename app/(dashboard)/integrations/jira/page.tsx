'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, GitBranch, CheckCircle, XCircle, RefreshCw, Eye, EyeOff, ExternalLink, UploadCloud } from 'lucide-react'

interface JiraStatus {
  connected: boolean
  status: string
  lastSyncAt: string | null
  subdomain: string
  projectKey: string
  findingIssuetype: string
  linkedFindings: number
}

interface JiraProject {
  key: string
  name: string
}

interface JiraIssueType {
  id: string
  name: string
}

interface LinkedFinding {
  id: string
  title: string
  severity: string
  status: string
  jiraIssueKey: string
  jiraUrl: string
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#FBBF24',
  low: '#10B981',
  info: '#6B7280',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_remediation: 'In Remediation',
  resolved: 'Resolved',
  accepted: 'Accepted',
  false_positive: 'False Positive',
}

export default function JiraIntegrationPage() {
  const router = useRouter()

  const [jiraStatus, setJiraStatus] = useState<JiraStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pushing, setPushing] = useState(false)

  const [email, setEmail] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [projectKey, setProjectKey] = useState('')
  const [findingIssuetype, setFindingIssuetype] = useState('Bug')
  const [showToken, setShowToken] = useState(false)

  const [projects, setProjects] = useState<JiraProject[]>([])
  const [issueTypes, setIssueTypes] = useState<JiraIssueType[]>([])
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: number; total: number } | null>(null)

  const [linkedFindings, setLinkedFindings] = useState<LinkedFinding[]>([])
  const [allOpenFindings, setAllOpenFindings] = useState<Array<{ id: string; title: string; severity: string; status: string; metadata: Record<string, unknown> }>>([])

  const loadStatus = useCallback(async () => {
    const data = await fetch('/api/integrations/jira').then((r) => r.json()) as JiraStatus
    setJiraStatus(data)
    if (data.subdomain) setSubdomain(data.subdomain)
    if (data.projectKey) setProjectKey(data.projectKey)
    if (data.findingIssuetype) setFindingIssuetype(data.findingIssuetype)
  }, [])

  const loadFindings = useCallback(async () => {
    const data = await fetch('/api/findings').then((r) => r.json()) as Array<{
      id: string; title: string; severity: string; status: string; metadata: unknown
    }>

    const typed = data.map((f) => ({
      ...f,
      metadata: (f.metadata as Record<string, unknown>) || {},
    }))

    setAllOpenFindings(typed.filter((f) => f.status === 'open' || f.status === 'in_remediation'))

    const linked: LinkedFinding[] = typed
      .filter((f) => f.metadata?.jiraIssueKey)
      .map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        status: f.status,
        jiraIssueKey: f.metadata.jiraIssueKey as string,
        jiraUrl: f.metadata.jiraUrl as string,
      }))
    setLinkedFindings(linked)
  }, [])

  useEffect(() => {
    Promise.all([loadStatus(), loadFindings()]).finally(() => setLoading(false))
  }, [loadStatus, loadFindings])

  async function handleTest() {
    if (!email || !apiToken || !subdomain || !projectKey) {
      setTestResult({ ok: false, error: 'Please fill in all required fields before testing' })
      return
    }

    setTesting(true)
    setTestResult(null)
    const res = await fetch('/api/integrations/jira/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, apiToken, subdomain, projectKey, findingIssuetype }),
    })
    const data = await res.json() as { ok: boolean; error?: string; projects?: JiraProject[]; issueTypes?: JiraIssueType[] }
    setTestResult({ ok: data.ok, error: data.error })
    if (data.ok) {
      setProjects(data.projects || [])
      setIssueTypes(data.issueTypes || [])
    }
    setTesting(false)
  }

  async function handleSave() {
    if (!email || !apiToken || !subdomain || !projectKey) {
      setSaveMsg('All fields are required')
      return
    }

    setSaving(true)
    const res = await fetch('/api/integrations/jira', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, apiToken, subdomain, projectKey, findingIssuetype }),
    })
    const data = await res.json() as { ok: boolean }
    setSaveMsg(data.ok ? 'Saved successfully' : 'Save failed')
    if (data.ok) loadStatus()
    setSaving(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/integrations/jira/sync', { method: 'POST' })
    const data = await res.json() as { synced: number; errors: number; total: number }
    setSyncResult(data)
    await loadFindings()
    setSyncing(false)
  }

  async function handlePushAll() {
    setPushing(true)
    const unlinked = allOpenFindings.filter((f) => !f.metadata?.jiraIssueKey)
    for (const finding of unlinked) {
      await fetch(`/api/integrations/jira/push/${finding.id}`, { method: 'POST' })
    }
    await loadFindings()
    setPushing(false)
  }

  async function handlePushOne(findingId: string) {
    await fetch(`/api/integrations/jira/push/${findingId}`, { method: 'POST' })
    await loadFindings()
  }

  async function handleDelete() {
    if (!confirm('Disconnect Jira integration?')) return
    await fetch('/api/integrations/jira', { method: 'DELETE' })
    setJiraStatus({ connected: false, status: 'inactive', lastSyncAt: null, subdomain: '', projectKey: '', findingIssuetype: 'Bug', linkedFindings: 0 })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)' }}>
        Loading...
      </div>
    )
  }

  const card: React.CSSProperties = {
    padding: '20px 24px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    marginBottom: 20,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 6,
    display: 'block',
    letterSpacing: '0.03em',
  }

  const unlinkedCount = allOpenFindings.filter((f) => !f.metadata?.jiraIssueKey).length

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }} className="animate-fade-in">
      {/* Back */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => router.push('/settings/integrations')} className="btn-ghost" style={{ fontSize: 13 }}>
          <ArrowLeft size={14} /> Integrations
        </button>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GitBranch size={20} color="#06B6D4" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
              Jira
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Push findings to Jira and sync remediation status</p>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 100,
          background: jiraStatus?.connected ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)',
          border: `1px solid ${jiraStatus?.connected ? 'rgba(16,185,129,0.3)' : 'rgba(107,114,128,0.3)'}`,
        }}>
          {jiraStatus?.connected
            ? <CheckCircle size={13} color="#10B981" />
            : <XCircle size={13} color="#6B7280" />}
          <span style={{ fontSize: 12, fontWeight: 600, color: jiraStatus?.connected ? '#10B981' : '#6B7280' }}>
            {jiraStatus?.connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
      </div>

      {/* Sync status */}
      {jiraStatus?.connected && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Sync Status</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {jiraStatus.lastSyncAt
                ? `Last synced: ${new Date(jiraStatus.lastSyncAt).toLocaleString()}`
                : 'Never synced'}
              {' · '}{jiraStatus.linkedFindings} linked issues
            </div>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
              fontSize: 12, fontWeight: 600, background: 'rgba(6,182,212,0.1)', color: '#06B6D4',
              border: '1px solid rgba(6,182,212,0.3)', cursor: syncing ? 'not-allowed' : 'pointer',
              opacity: syncing ? 0.7 : 1,
            }}
          >
            <RefreshCw size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      {syncResult && (
        <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', color: '#06B6D4' }}>
          Sync complete: {syncResult.synced} updated, {syncResult.errors} errors, {syncResult.total} total linked
        </div>
      )}

      {/* Credentials */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>Connection Details</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Atlassian Subdomain</label>
            <input
              type="text"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder="mycompany"
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
              For mycompany.atlassian.net, enter <strong>mycompany</strong>
            </p>
          </div>
          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>API Token</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showToken ? 'text' : 'password'}
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={jiraStatus?.connected ? '••••••••••••••••' : 'Your Jira API token'}
              style={{ ...inputStyle, paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
            Generate at id.atlassian.com/manage-profile/security/api-tokens
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
          <div>
            <label style={labelStyle}>Project Key</label>
            {projects.length > 0 ? (
              <select
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                style={{ ...inputStyle, appearance: 'none' }}
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                placeholder="e.g. SEC"
                style={inputStyle}
              />
            )}
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>Run Test Connection to load projects</p>
          </div>
          <div>
            <label style={labelStyle}>Issue Type for Findings</label>
            {issueTypes.length > 0 ? (
              <select
                value={findingIssuetype}
                onChange={(e) => setFindingIssuetype(e.target.value)}
                style={{ ...inputStyle, appearance: 'none' }}
              >
                {issueTypes.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={findingIssuetype}
                onChange={(e) => setFindingIssuetype(e.target.value)}
                placeholder="Bug"
                style={inputStyle}
              />
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'rgba(6,182,212,0.12)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.3)',
            cursor: testing ? 'not-allowed' : 'pointer', opacity: testing ? 0.7 : 1,
          }}
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: '#8B5CF6', color: 'white', border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>

        {jiraStatus?.connected && (
          <button
            onClick={handleDelete}
            style={{
              padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)',
              cursor: 'pointer', marginLeft: 'auto',
            }}
          >
            Disconnect
          </button>
        )}
      </div>

      {testResult && (
        <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: testResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${testResult.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, color: testResult.ok ? '#10B981' : '#EF4444' }}>
          {testResult.ok ? '✅ Connection successful! Projects loaded below.' : `❌ ${testResult.error}`}
        </div>
      )}

      {saveMsg && (
        <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: saveMsg.includes('success') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${saveMsg.includes('success') ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, color: saveMsg.includes('success') ? '#10B981' : '#EF4444' }}>
          {saveMsg}
        </div>
      )}

      {/* Push existing findings */}
      {jiraStatus?.connected && unlinkedCount > 0 && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Push Existing Findings</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {unlinkedCount} open finding{unlinkedCount !== 1 ? 's' : ''} not yet linked to Jira
            </div>
          </div>
          <button
            onClick={handlePushAll}
            disabled={pushing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
              fontSize: 12, fontWeight: 600, background: 'rgba(139,92,246,0.12)', color: '#A78BFA',
              border: '1px solid rgba(139,92,246,0.3)', cursor: pushing ? 'not-allowed' : 'pointer',
              opacity: pushing ? 0.7 : 1,
            }}
          >
            <UploadCloud size={13} />
            {pushing ? 'Pushing...' : `Push ${unlinkedCount} finding${unlinkedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Linked findings table */}
      {linkedFindings.length > 0 && (
        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            Linked Findings ({linkedFindings.length})
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Finding', 'Severity', 'Status', 'Jira Issue', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.07)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linkedFindings.map((f) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)', maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: SEVERITY_COLOR[f.severity] || '#6B7280', background: `${SEVERITY_COLOR[f.severity] || '#6B7280'}15`, padding: '3px 8px', borderRadius: 100, textTransform: 'capitalize' }}>
                        {f.severity}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                      {STATUS_LABEL[f.status] || f.status}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <a href={f.jiraUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#06B6D4', fontSize: 12, textDecoration: 'none' }}>
                        {f.jiraIssueKey} <ExternalLink size={11} />
                      </a>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {/* Already linked — no action needed */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unlinked findings */}
      {jiraStatus?.connected && allOpenFindings.filter((f) => !f.metadata?.jiraIssueKey).length > 0 && (
        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            Unlinked Open Findings
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Finding', 'Severity', 'Status', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.07)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allOpenFindings.filter((f) => !f.metadata?.jiraIssueKey).slice(0, 20).map((f) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)', maxWidth: 300 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: SEVERITY_COLOR[f.severity] || '#6B7280', background: `${SEVERITY_COLOR[f.severity] || '#6B7280'}15`, padding: '3px 8px', borderRadius: 100, textTransform: 'capitalize' }}>
                        {f.severity}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                      {STATUS_LABEL[f.status] || f.status}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        onClick={() => handlePushOne(f.id)}
                        style={{
                          fontSize: 11, fontWeight: 600, color: '#8B5CF6', padding: '4px 10px',
                          borderRadius: 6, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
                          cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <UploadCloud size={11} /> Push to Jira
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
