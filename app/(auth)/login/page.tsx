'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { CandidLogo } from '@/components/candid-logo'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [errors,   setErrors]   = useState<{ email?: string; password?: string }>({})

  function validate() {
    const e: typeof errors = {}
    if (!email)    e.email    = 'Email is required'
    if (!password) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return

    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        toast.error(error.message ?? 'Sign in failed. Please try again.')
        return
      }

      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="glass-card rounded-2xl p-8 shadow-glass">
      {/* Logo */}
      <div className="flex items-center mb-8">
        <CandidLogo variant="dark" className="h-9 w-auto" />
      </div>

      <h1 className="text-2xl font-semibold text-white mb-1">Welcome back</h1>
      <p className="text-sm text-slate-400 mb-7">Sign in to your account</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-slate-300">
            Email
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
          {errors.email && (
            <p className="text-xs text-red-400">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-slate-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
            placeholder="••••••••"
            className={cn(
              'w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-slate-500',
              'bg-white/5 border transition-all duration-150 outline-none',
              'focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60',
              errors.password ? 'border-red-500/60' : 'border-white/10 hover:border-white/20'
            )}
          />
          {errors.password && (
            <p className="text-xs text-red-400">{errors.password}</p>
          )}
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
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
          Create one free
        </Link>
      </p>
    </div>
  )
}
