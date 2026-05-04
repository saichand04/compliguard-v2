'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Upload, FileText, CheckCircle2, AlertTriangle,
  ChevronRight, X, RefreshCw, Shield, Link2, GitBranch,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedControl {
  rawId: string
  normalizedId: string
  title: string
  category?: string
  canonicalHint?: string
  frameworkSlug?: string
}

interface UploadResult {
  uploadId: string
  filename: string
  format: string
  detectedFramework: string
  validation: {
    valid: boolean
    errors: Array<{ field: string; message: string; row?: number }>
    warnings: Array<{ field: string; message: string; row?: number; controlId?: string }>
    total: number
    validCount: number
  }
  stats: {
    total: number
    mapped: number
    unmapped: number
    mappingRate: number
  }
  preview: ParsedControl[]
}

type UploadStep = 'idle' | 'uploading' | 'preview' | 'done' | 'error'

// ── DEMO: simulate parsing locally ───────────────────────────────────────────

function simulateParse(filename: string): UploadResult {
  const isHitrust = filename.toLowerCase().includes('hitrust')
  const isIso = filename.toLowerCase().includes('iso')

  const preview: ParsedControl[] = isHitrust
    ? [
        { rawId: '09.ab.01', normalizedId: '09.ab.01', title: 'User Registration and De-Registration', category: 'Access Control', canonicalHint: 'AC', frameworkSlug: 'hitrust' },
        { rawId: '09.ab.02', normalizedId: '09.ab.02', title: 'Privilege Management', category: 'Access Control', canonicalHint: 'AC', frameworkSlug: 'hitrust' },
        { rawId: '09.ac.01', normalizedId: '09.ac.01', title: 'User Password Management', category: 'Access Control', canonicalHint: 'IA', frameworkSlug: 'hitrust' },
        { rawId: '09.m.01',  normalizedId: '09.m.01',  title: 'Network Controls', category: 'Communications', canonicalHint: 'SC', frameworkSlug: 'hitrust' },
        { rawId: '10.b.01',  normalizedId: '10.b.01',  title: 'Controls Against Malicious Code', category: 'Operations', canonicalHint: 'SI', frameworkSlug: 'hitrust' },
      ]
    : isIso
    ? [
        { rawId: 'A.5.1', normalizedId: 'A.5.1', title: 'Policies for Information Security', category: 'Organizational Controls', canonicalHint: 'PM', frameworkSlug: 'iso27001' },
        { rawId: 'A.9.1', normalizedId: 'A.9.1', title: 'Access Control Policy', category: 'Access Control', canonicalHint: 'AC', frameworkSlug: 'iso27001' },
        { rawId: 'A.9.2', normalizedId: 'A.9.2', title: 'User Access Management', category: 'Access Control', canonicalHint: 'AC', frameworkSlug: 'iso27001' },
      ]
    : [
        { rawId: 'CTRL-001', normalizedId: 'CTRL-001', title: 'Access Management', category: 'Access Control', canonicalHint: 'AC', frameworkSlug: 'custom' },
        { rawId: 'CTRL-002', normalizedId: 'CTRL-002', title: 'Encryption Standard', category: 'Data Protection', canonicalHint: 'SC', frameworkSlug: 'custom' },
        { rawId: 'CTRL-003', normalizedId: 'CTRL-003', title: 'Incident Response', category: 'Security Operations', canonicalHint: 'IR', frameworkSlug: 'custom' },
      ]

  const total = Math.max(preview.length, Math.floor(Math.random() * 80) + 30)
  const mapped = Math.floor(total * 0.82)

  return {
    uploadId: `demo-${Date.now()}`,
    filename,
    format: filename.endsWith('.json') ? 'json' : 'csv',
    detectedFramework: isHitrust ? 'hitrust' : isIso ? 'iso27001' : 'unknown',
    validation: {
      valid: true,
      errors: [],
      warnings: [
        { field: 'title', message: 'Some controls have no description', row: 4, controlId: preview[0]?.rawId },
      ],
      total,
      validCount: total - 2,
    },
    stats: { total, mapped, unmapped: total - mapped, mappingRate: Math.round((mapped / total) * 100) },
    preview,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FrameworkUploadPage() {
  const [step, setStep] = useState<UploadStep>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'json', 'xlsx'].includes(ext ?? '')) {
      alert('Unsupported file type. Please use CSV, JSON, or XLSX.')
      return
    }
    setSelectedFile(file)
    setStep('uploading')

    // Simulate processing
    setTimeout(() => {
      const result = simulateParse(file.name)
      setUploadResult(result)
      setStep('preview')
    }, 1400)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const reset = () => {
    setStep('idle')
    setUploadResult(null)
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 880, margin: '0 auto' }}>

      {/* ── Page header ──────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
          Upload Framework
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
          Import a custom compliance framework via CSV, JSON, or XLSX. The mapping engine will automatically resolve NIST canonical anchors.
        </p>
      </div>

      {/* ── Upload area ──────────────────────────────────── */}
      {step === 'idle' && (
        <div className="animate-fade-in">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--violet)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 'var(--radius-xl)',
              padding: '56px 40px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'rgba(139,92,246,0.07)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s ease',
              marginBottom: 20,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,.xlsx"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            <div style={{ width: 56, height: 56, background: 'var(--violet-dim)', border: '1px solid rgba(139,92,246,0.30)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Upload size={22} style={{ color: 'var(--violet)' }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              {dragOver ? 'Drop to upload' : 'Drag & drop your framework file'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              CSV, JSON, or XLSX (Excel) — maximum 5MB
            </div>
            <button
              className="btn-primary"
              style={{ fontSize: 13 }}
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
            >
              <FileText size={14} /> Browse Files
            </button>
          </div>

          {/* Supported formats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { format: 'CSV', icon: '📊', desc: 'Spreadsheet export with columns: ID, Title, Description, Category' },
              { format: 'JSON', icon: '{}', desc: 'Array of control objects with id/title/description fields' },
              { format: 'XLSX', icon: '📋', desc: 'Excel format — columns auto-detected: ID, Title, Description, Category' },
            ].map(({ format, icon, desc }) => (
              <div key={format} className="glass-card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{format}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Processing ───────────────────────────────────── */}
      {step === 'uploading' && (
        <div className="glass-card animate-fade-in" style={{ padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, background: 'var(--violet-dim)', border: '1px solid rgba(139,92,246,0.30)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', animation: 'spin-slow 2s linear infinite' }}>
            <RefreshCw size={20} style={{ color: 'var(--violet)' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            Processing {selectedFile?.name}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Parsing controls and resolving NIST canonical anchors…
          </div>
          <div style={{ marginTop: 20 }}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: '65%', animation: 'shimmer 1.5s infinite' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Preview ──────────────────────────────────────── */}
      {step === 'preview' && uploadResult && (
        <div className="animate-fade-in">

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total Controls', value: uploadResult.stats.total, color: 'var(--text-primary)' },
              { label: 'Mapped to NIST', value: uploadResult.stats.mapped, color: 'var(--emerald)' },
              { label: 'Unmapped', value: uploadResult.stats.unmapped, color: 'var(--amber)' },
              { label: 'Mapping Rate', value: `${uploadResult.stats.mappingRate}%`, color: uploadResult.stats.mappingRate >= 80 ? 'var(--emerald)' : 'var(--amber)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass-card" style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Detected framework */}
          <div className="glass-card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, background: 'var(--cyan-dim)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={15} style={{ color: 'var(--cyan)' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 1 }}>Detected Framework</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {uploadResult.detectedFramework === 'hitrust' ? 'HITRUST CSF' :
                 uploadResult.detectedFramework === 'iso27001' ? 'ISO 27001:2022' :
                 uploadResult.detectedFramework === 'unknown' ? 'Custom / Unknown' : uploadResult.detectedFramework.toUpperCase()}
              </div>
            </div>
            {uploadResult.detectedFramework === 'hitrust' && (
              <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--violet)', background: 'var(--violet-dim)', padding: '3px 10px', borderRadius: 99, border: '1px solid rgba(139,92,246,0.25)' }}>
                HITRUST decoder active
              </div>
            )}
          </div>

          {/* Warnings */}
          {uploadResult.validation.warnings.length > 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-md)', marginBottom: 16, display: 'flex', gap: 10 }}>
              <AlertTriangle size={14} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--amber)', marginBottom: 4 }}>
                  {uploadResult.validation.warnings.length} Warning{uploadResult.validation.warnings.length > 1 ? 's' : ''}
                </div>
                {uploadResult.validation.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'rgba(245,158,11,0.8)' }}>
                    {w.row ? `Row ${w.row}: ` : ''}{w.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Control preview table */}
          <div className="glass-card" style={{ marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Preview — First {uploadResult.preview.length} Controls
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {uploadResult.validation.total} total in file
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Control ID', 'Normalized ID', 'Title', 'Category', 'NIST Family'].map((h) => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uploadResult.preview.map((ctrl, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '8px 14px' }}>
                        <code style={{ fontSize: 11.5, color: 'var(--cyan)', background: 'rgba(6,182,212,0.10)', padding: '1px 6px', borderRadius: 3 }}>{ctrl.rawId}</code>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ctrl.normalizedId}</code>
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ctrl.title}
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {ctrl.category ?? '—'}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        {ctrl.canonicalHint ? (
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--violet)', background: 'var(--violet-dim)', padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(139,92,246,0.20)' }}>
                            {ctrl.canonicalHint}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.20)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn-ghost" onClick={reset} style={{ fontSize: 13, padding: '10px 16px' }}>
              <X size={14} /> Cancel
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn-ghost" style={{ fontSize: 13, padding: '10px 16px' }}>
              <Link2 size={14} /> Review Mappings
            </button>
            <button
              className="btn-primary"
              style={{ fontSize: 13, padding: '10px 20px' }}
              onClick={() => setStep('done')}
            >
              <CheckCircle2 size={14} /> Import Framework
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Done ─────────────────────────────────────────── */}
      {step === 'done' && uploadResult && (
        <div className="glass-card animate-fade-in" style={{ padding: '48px 40px', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, background: 'var(--emerald-dim)', border: '1px solid rgba(16,185,129,0.30)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 24px rgba(16,185,129,0.25)' }}>
            <CheckCircle2 size={26} style={{ color: 'var(--emerald)' }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Framework Imported Successfully
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 24 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>{uploadResult.stats.total}</strong> controls imported —{' '}
            <strong style={{ color: 'var(--emerald)' }}>{uploadResult.stats.mapped}</strong> mapped to NIST 800-53 anchors
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <a href="/mappings" className="btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>
              <GitBranch size={14} /> View Mapping Explorer
            </a>
            <button className="btn-ghost" onClick={reset} style={{ fontSize: 13 }}>
              <Upload size={14} /> Upload Another
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
