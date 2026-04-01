'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { CandidLogo } from '@/components/candid-logo'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export default function SignupPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreed,          setAgreed]          = useState(false)
  const [errors, setErrors] = useState<{
    email?: string; password?: string; confirmPassword?: string; terms?: string
  }>({})

  function validate() {
    const e: typeof errors = {}
    if (!email)    e.email    = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email'
    if (!password)            e.password = 'Password is required'
    else if (password.length < 8) e.password = 'Password must be at least 8 characters'
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match'
    if (!agreed) e.terms = 'You must agree to the terms'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return

    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        toast.error(error.message ?? 'Sign up failed. Please try again.')
        return
      }

      router.push('/verify-email')
    })
  }

  return (
    <div className="glass-card rounded-2xl p-8 shadow-glass">
      {/* Logo */}
      <div className="flex items-center mb-8">
        <CandidLogo variant="dark" className="h-9 w-auto" />
      </div>

      <h1 className="text-2xl font-semibold text-white mb-1">Create your account</h1>
      <p className="text-sm text-slate-400 mb-7">Free plan — no credit card required</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-slate-300">
            Work email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
            placeholder="you@company.com"
            className={cn(
              'w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-slate-500',
              'bg-white/5 border transition-all duration-150 outline-none',
              'focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60',
              errors.email ? 'border-red-500/60' : 'border-white/10 hover:border-white/20'
            )}
          />
          {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-slate-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
            placeholder="At least 8 characters"
            className={cn(
              'w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-slate-500',
              'bg-white/5 border transition-all duration-150 outline-none',
              'focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60',
              errors.password ? 'border-red-500/60' : 'border-white/10 hover:border-white/20'
            )}
          />
          {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <label htmlFor="confirm" className="text-sm font-medium text-slate-300">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: undefined })) }}
            placeholder="••••••••"
            className={cn(
              'w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-slate-500',
              'bg-white/5 border transition-all duration-150 outline-none',
              'focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60',
              errors.confirmPassword ? 'border-red-500/60' : 'border-white/10 hover:border-white/20'
            )}
          />
          {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword}</p>}
        </div>

        {/* Terms */}
        <div className="space-y-1">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => { setAgreed(e.target.checked); setErrors(p => ({ ...p, terms: undefined })) }}
                className="sr-only"
              />
              <div className={cn(
                'w-4 h-4 rounded border flex items-center justify-center transition-all duration-150',
                agreed
                  ? 'bg-indigo-500 border-indigo-500'
                  : errors.terms
                    ? 'border-red-500/60 bg-white/5'
                    : 'border-white/20 bg-white/5 group-hover:border-white/40'
              )}>
                {agreed && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-slate-400">
              I agree to the{' '}
              <span className="text-indigo-400 hover:text-indigo-300 transition-colors">Terms of Service</span>
              {' '}and{' '}
              <span className="text-indigo-400 hover:text-indigo-300 transition-colors">Privacy Policy</span>
            </span>
          </label>
          {errors.terms && <p className="text-xs text-red-400 pl-7">{errors.terms}</p>}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            'w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white',
            'bg-gradient-brand transition-all duration-150 hover-glow',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-2'
          )}
        >
          {isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
          ) : (
            'Start for free'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}
