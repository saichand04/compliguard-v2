'use client'

import { useState, useEffect, useRef } from 'react'
import {
  AlertTriangle, Shield, Trash2, Eye, EyeOff,
  CheckCircle, Loader2, X, ChevronRight,
  ShieldAlert, Database, FileText, Target, Server,
  Globe, Users, Plug, BookOpen, Activity, GraduationCap,
  CheckSquare, Building, BarChart3,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface DataCategory {
  key: string
  label: string
  count: number
  icon: string
}

// ─── Icon resolver ────────────────────────────────────────────────────────────
function CategoryIcon({ icon, size = 13 }: { icon: string; size?: number }) {
  const props = { size, color: '#EF4444' }
  switch (icon) {
    case 'shield':          return <Shield {...props} />
    case 'file':            return <FileText {...props} />
    case 'alert':           return <AlertTriangle {...props} />
    case 'alert-triangle':  return <AlertTriangle {...props} />
    case 'check-square':    return <CheckSquare {...props} />
    case 'building':        return <Building {...props} />
    case 'book':            return <BookOpen {...props} />
    case 'target':          return <Target {...props} />
    case 'server':          return <Server {...props} />
    case 'globe':           return <Globe {...props} />
    case 'users':           return <Users {...props} />
    case 'plug':            return <Plug {...props} />
    case 'graduation-cap':  return <GraduationCap {...props} />
    case 'database':        return <Database {...props} />
    case 'activity':        return <Activity {...props} />
    default:                return <Database {...props} />
  }
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDot({ step, current, done }: { step: number; current: number; done: boolean }) {
  const active = current === step
  const bg = done ? '#22C55E' : active ? '#EF4444' : 'rgba(255,255,255,0.08)'
  const border = done ? '#22C55E' : active ? '#EF4444' : 'rgba(255,255,255,0.15)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: bg, border: `2px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
        color: done || active ? '#fff' : 'rgba(255,255,255,0.3)',
        transition: 'all 0.25s',
        flexShrink: 0,
      }}>
        {done ? <CheckCircle size={13} /> : step}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MasterResetSection() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)           // 1=preview, 2=phrase, 3=password
  const [categories, setCategories] = useState<DataCategory[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const phraseRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const CONFIRM_PHRASE = 'RESET PLATFORM'

  // Load preview when modal opens
  useEffect(() => {
    if (!open) return
    setStep(1); setPhrase(''); setPassword(''); setError(''); setDone(false)
    setLoadingPreview(true)
    fetch('/api/admin/reset/preview')
      .then(r => r.json())
      .then(d => { setCategories(d.categories ?? []); setTotalRows(d.totalRows ?? 0) })
      .catch(() => setError('Failed to load data preview.'))
      .finally(() => setLoadingPreview(false))
  }, [open])

  // Focus inputs when step changes
  useEffect(() => {
    if (step === 2) setTimeout(() => phraseRef.current?.focus(), 80)
    if (step === 3) setTimeout(() => passwordRef.current?.focus(), 80)
  }, [step])

  const handleClose = () => {
    if (executing) return
    setOpen(false)
  }

  const handleExecute = async () => {
    setError('')
    setExecuting(true)
    try {
      const res = await fetch('/api/admin/reset/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmPhrase: CONFIRM_PHRASE, password }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
        return
      }
      setDone(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setExecuting(false)
    }
  }

  const stepDone = (s: number) => step > s || done

  return (
    <>
      {/* ── Danger Zone card ── */}
      <div style={{
        marginTop: 32,
        padding: '22px 26px',
        background: 'rgba(239,68,68,0.05)',
        border: '1px solid rgba(239,68,68,0.18)',
        borderRadius: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            {/* Icon */}
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldAlert size={18} color="#EF4444" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Danger Zone
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                  color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  padding: '2px 7px', borderRadius: 100,
                }}>Irreversible</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 480 }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Master Reset</strong> permanently
                deletes all platform data for this organization — frameworks, controls, findings, tasks,
                vendors, evidence, pentest engagements, and all other records. Your admin account and
                platform configuration are preserved.
              </p>
              <p style={{ fontSize: 12, color: 'rgba(239,68,68,0.7)', marginTop: 6 }}>
                Use this to clear demo/seed data before going live with real client data.
              </p>
            </div>
          </div>

          {/* Trigger button */}
          <button
            onClick={() => setOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
              padding: '9px 18px', borderRadius: 9,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
          >
            <Trash2 size={14} />
            Master Reset
          </button>
        </div>
      </div>

      {/* ── Modal overlay ── */}
      {open && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto',
              background: '#111218',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 18,
              boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(239,68,68,0.1)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 22px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Trash2 size={15} color="#EF4444" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Master Reset</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>Permanently clears all platform data</div>
                </div>
              </div>
              {!executing && !done && (
                <button onClick={handleClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 4, borderRadius: 6, display: 'flex' }}>
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Step progress bar */}
            {!done && (
              <div style={{ padding: '14px 22px 0', display: 'flex', alignItems: 'center', gap: 0 }}>
                {[1, 2, 3].map((s, i) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <StepDot step={s} current={step} done={stepDone(s)} />
                      <span style={{ fontSize: 10, color: step === s ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.28)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {s === 1 ? 'Review' : s === 2 ? 'Confirm' : 'Verify'}
                      </span>
                    </div>
                    {i < 2 && (
                      <div style={{ flex: 1, height: 1, margin: '0 10px', marginBottom: 14, background: stepDone(s) ? '#22C55E' : 'rgba(255,255,255,0.08)', transition: 'background 0.3s' }} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── STEP 1: Data preview ── */}
            {!done && step === 1 && (
              <div style={{ padding: '18px 22px 22px' }}>
                <div style={{
                  padding: '12px 14px', borderRadius: 10, marginBottom: 16,
                  background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <AlertTriangle size={14} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12.5, color: 'rgba(239,68,68,0.9)', lineHeight: 1.6 }}>
                    The following data will be <strong>permanently deleted</strong>. This action cannot be undone. 
                    Your admin account and platform settings will be preserved.
                  </p>
                </div>

                {loadingPreview ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0', justifyContent: 'center' }}>
                    <Loader2 size={14} color="#EF4444" style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading data preview...</span>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
                      {categories.map(cat => (
                        <div key={cat.key} style={{
                          display: 'flex', alignItems: 'center', gap: 9,
                          padding: '9px 12px', borderRadius: 9,
                          background: cat.count > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${cat.count > 0 ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.06)'}`,
                        }}>
                          <CategoryIcon icon={cat.icon} size={12} />
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', flex: 1, lineHeight: 1.3 }}>{cat.label}</span>
                          <span style={{
                            fontSize: 12, fontWeight: 700, minWidth: 24, textAlign: 'right',
                            color: cat.count > 0 ? '#EF4444' : 'rgba(255,255,255,0.25)',
                          }}>{cat.count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total summary */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '11px 14px', borderRadius: 9, marginBottom: 18,
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart3 size={14} color="#EF4444" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Total records to delete</span>
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#EF4444' }}>
                        {totalRows.toLocaleString()}
                      </span>
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleClose} style={{
                    flex: 1, padding: '10px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>Cancel</button>
                  <button onClick={() => setStep(2)} disabled={loadingPreview} style={{
                    flex: 1, padding: '10px 0', borderRadius: 9, border: 'none',
                    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: loadingPreview ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: loadingPreview ? 0.5 : 1,
                    boxShadow: '0 2px 12px rgba(239,68,68,0.3)',
                  }}>
                    I understand, continue <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Confirmation phrase ── */}
            {!done && step === 2 && (
              <div style={{ padding: '18px 22px 22px' }}>
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, marginBottom: 20 }}>
                  To confirm you want to permanently delete all platform data, type the following phrase exactly as shown:
                </p>

                <div style={{
                  padding: '12px 16px', borderRadius: 10, marginBottom: 18, textAlign: 'center',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                }}>
                  <code style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.08em', color: '#EF4444', fontFamily: 'monospace' }}>
                    {CONFIRM_PHRASE}
                  </code>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 7, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Type the phrase above
                  </label>
                  <input
                    ref={phraseRef}
                    type="text"
                    value={phrase}
                    onChange={e => setPhrase(e.target.value)}
                    placeholder="RESET PLATFORM"
                    autoComplete="off"
                    spellCheck={false}
                    style={{
                      width: '100%', padding: '11px 14px', borderRadius: 9, fontFamily: 'monospace',
                      background: '#1a1c25', border: `1px solid ${phrase === CONFIRM_PHRASE ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      color: phrase === CONFIRM_PHRASE ? '#22C55E' : 'rgba(255,255,255,0.85)',
                      fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', outline: 'none',
                      transition: 'border-color 0.15s',
                      boxSizing: 'border-box',
                    }}
                  />
                  {phrase.length > 0 && phrase !== CONFIRM_PHRASE && (
                    <p style={{ fontSize: 11.5, color: '#EF4444', marginTop: 5 }}>Phrase does not match — must be exactly <code>RESET PLATFORM</code></p>
                  )}
                </div>

                {error && (
                  <div style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setStep(1); setPhrase(''); setError('') }} style={{
                    flex: 1, padding: '10px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>Back</button>
                  <button
                    onClick={() => { setError(''); setStep(3) }}
                    disabled={phrase !== CONFIRM_PHRASE}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 9, border: 'none',
                      background: phrase === CONFIRM_PHRASE ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'rgba(255,255,255,0.06)',
                      color: phrase === CONFIRM_PHRASE ? '#fff' : 'rgba(255,255,255,0.25)',
                      fontSize: 13, fontWeight: 700,
                      cursor: phrase === CONFIRM_PHRASE ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      boxShadow: phrase === CONFIRM_PHRASE ? '0 2px 12px rgba(239,68,68,0.3)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    Continue <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Password verification ── */}
            {!done && step === 3 && (
              <div style={{ padding: '18px 22px 22px' }}>
                <div style={{
                  padding: '12px 14px', borderRadius: 10, marginBottom: 20,
                  background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.18)',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <Shield size={14} color="#8B5CF6" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                    Final verification — enter your account password to confirm your identity and authorize the reset.
                    This cannot be undone.
                  </p>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 7, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Your password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      ref={passwordRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && password.length >= 1 && !executing) handleExecute() }}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      style={{
                        width: '100%', padding: '11px 44px 11px 14px', borderRadius: 9,
                        background: '#1a1c25', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.85)', fontSize: 14, outline: 'none',
                        boxSizing: 'border-box', fontFamily: 'inherit',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(x => !x)}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'rgba(255,255,255,0.35)', padding: 2, display: 'flex',
                      }}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p style={{ fontSize: 12.5, color: '#EF4444' }}>{error}</p>
                  </div>
                )}

                {/* Final warning */}
                <div style={{
                  padding: '10px 14px', borderRadius: 9, marginBottom: 18,
                  background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                }}>
                  <p style={{ fontSize: 12, color: 'rgba(239,68,68,0.8)', lineHeight: 1.6 }}>
                    ⚠ This will immediately delete <strong>{totalRows.toLocaleString()} records</strong> across all
                    modules. There is no recovery option.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setStep(2); setPassword(''); setError('') }} disabled={executing} style={{
                    flex: 1, padding: '10px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600,
                    cursor: executing ? 'not-allowed' : 'pointer', opacity: executing ? 0.5 : 1,
                  }}>Back</button>
                  <button
                    onClick={handleExecute}
                    disabled={!password || executing}
                    style={{
                      flex: 1.5, padding: '10px 0', borderRadius: 9, border: 'none',
                      background: password && !executing ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'rgba(255,255,255,0.06)',
                      color: password && !executing ? '#fff' : 'rgba(255,255,255,0.25)',
                      fontSize: 13, fontWeight: 700,
                      cursor: password && !executing ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      boxShadow: password && !executing ? '0 2px 12px rgba(239,68,68,0.35)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {executing
                      ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Resetting…</>
                      : <><Trash2 size={14} /> Delete All Data</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── SUCCESS state ── */}
            {done && (
              <div style={{ padding: '32px 22px 28px', textAlign: 'center' }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 18px',
                }}>
                  <CheckCircle size={28} color="#22C55E" />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
                  Platform Reset Complete
                </h3>
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
                  All platform data has been cleared. Your admin account and system settings are intact.
                  You can now start fresh with real data.
                </p>
                <button
                  onClick={() => { setOpen(false); window.location.reload() }}
                  style={{
                    padding: '11px 28px', borderRadius: 9, border: 'none',
                    background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 2px 12px rgba(139,92,246,0.35)',
                  }}
                >
                  Reload Platform
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
