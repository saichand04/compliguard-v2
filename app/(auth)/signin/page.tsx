'use client'

import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, GitBranch, Eye, EyeOff, ArrowRight } from 'lucide-react'

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type SignInFormData = z.infer<typeof signInSchema>

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  })

  const onSubmit = async (data: SignInFormData) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Sign in failed'); return }
      router.push(callbackUrl)
    } catch { setError('An unexpected error occurred. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <>
      <h1 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 26,
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: 4,
        letterSpacing: '-0.01em',
      }}>
        Welcome back
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 28 }}>
        Sign in to your compliance workspace
      </p>

      {error && (
        <div style={{
          marginBottom: 20,
          padding: '10px 14px',
          background: 'var(--rose-dim)',
          border: '1px solid rgba(244,63,94,0.30)',
          borderRadius: 'var(--radius-md)',
          color: '#FDA4AF',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Email address
          </label>
          <input
            type="email"
            autoComplete="email"
            className="cg-input"
            placeholder="you@company.com"
            {...register('email')}
          />
          {errors.email && <p style={{ fontSize: 12, color: '#FDA4AF', marginTop: 4 }}>{errors.email.message}</p>}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
            <Link href="/forgot-password" style={{ fontSize: 12, color: 'var(--violet)', textDecoration: 'none' }}>
              Forgot password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              className="cg-input"
              placeholder="••••••••"
              style={{ paddingRight: 40 }}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 0, display: 'flex',
              }}
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.password && <p style={{ fontSize: 12, color: '#FDA4AF', marginTop: 4 }}>{errors.password.message}</p>}
        </div>

        <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: 4 }}>
          {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          {loading ? 'Signing in…' : 'Sign in'}
          {!loading && <ArrowRight size={14} />}
        </button>
      </form>

      {/* Divider */}
      <div style={{ position: 'relative', margin: '24px 0', textAlign: 'center' }}>
        <div style={{ position: 'absolute', inset: '50% 0 auto 0', height: 1, background: 'var(--border-glass)' }} />
        <span style={{ position: 'relative', background: 'transparent', padding: '0 12px', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          or continue with
        </span>
      </div>

      {/* OAuth */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <a href="/api/auth/oauth/google" className="btn-ghost" style={{ justifyContent: 'center', textDecoration: 'none' }}>
          <svg width="15" height="15" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google
        </a>
        <a href="/api/auth/oauth/github" className="btn-ghost" style={{ justifyContent: 'center', textDecoration: 'none' }}>
          <GitBranch size={14} />
          GitHub
        </a>
      </div>

      <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" style={{ color: 'var(--violet)', textDecoration: 'none', fontWeight: 500 }}>
          Sign up
        </Link>
      </p>
    </>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--violet)' }} />
      </div>
    }>
      <SignInForm />
    </Suspense>
  )
}
