'use client'

import { useState, useEffect } from 'react'
import { User, Mail, Shield, Save, Loader2, Key, ArrowLeft, Camera } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SessionUser {
  id: string
  email: string
  role: string
  firstName: string | null
  lastName: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [pwdSaved, setPwdSaved] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setUser(data.user)
          setFirstName(data.user.firstName || '')
          setLastName(data.user.lastName || '')
          setEmail(data.user.email || '')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || email.charAt(0).toUpperCase()

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName }),
      })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setPwdError('')
    if (newPassword !== confirmPassword) { setPwdError('Passwords do not match'); return }
    if (newPassword.length < 8) { setPwdError('Password must be at least 8 characters'); return }
    setSavingPwd(true)
    try {
      const res = await fetch('/api/users/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setPwdError(data.error || 'Failed to change password'); return }
      setPwdSaved(true)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setTimeout(() => setPwdSaved(false), 3000)
    } finally {
      setSavingPwd(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <Loader2 size={20} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }} className="animate-fade-in">

      <div style={{ marginBottom: 28 }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ fontSize: 13 }}>
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      {/* Avatar + name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: 'white',
            boxShadow: '0 0 24px rgba(139,92,246,0.4)',
          }}>{initials}</div>
          <button style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(139,92,246,0.9)', border: '2px solid var(--bg-base)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <Camera size={11} color="white" />
          </button>
        </div>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {firstName} {lastName}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{email}</span>
            <span style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
              color: '#C4B5FD', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
              padding: '2px 8px', borderRadius: 100,
            }}>{user?.role?.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="glass-card" style={{ padding: 28, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <User size={15} color="#8B5CF6" />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Personal Information</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>First name</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} className="glass-input" style={{ width: '100%' }} placeholder="First name" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Last name</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} className="glass-input" style={{ width: '100%' }} placeholder="Last name" />
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Email address</label>
          <div style={{ position: 'relative' }}>
            <Mail size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={email} readOnly className="glass-input" style={{ width: '100%', paddingLeft: 34, opacity: 0.7 }} />
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Email changes require admin approval</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSaveProfile} disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
            {profileSaved ? 'Saved!' : 'Save profile'}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="glass-card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <Key size={15} color="#06B6D4" />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Change Password</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Current password</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="glass-input" style={{ width: '100%' }} placeholder="••••••••" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>New password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="glass-input" style={{ width: '100%' }} placeholder="Min. 8 characters" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="glass-input" style={{ width: '100%' }} placeholder="Repeat new password" />
          </div>
        </div>
        {pwdError && (
          <div style={{ fontSize: 12.5, color: '#F87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>
            {pwdError}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleChangePassword} disabled={savingPwd || !currentPassword || !newPassword} className="btn-primary" style={{ fontSize: 13, background: 'linear-gradient(135deg, #06B6D4, #0284C7)' }}>
            {savingPwd ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Key size={13} />}
            {pwdSaved ? 'Changed!' : 'Change password'}
          </button>
        </div>
      </div>

    </div>
  )
}
