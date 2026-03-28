import Link from 'next/link'
import { Brain, Mail, ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Check Your Email' }

export default function VerifyEmailPage() {
  return (
    <div className="glass-card rounded-2xl p-8 shadow-glass text-center">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-semibold gradient-text">RecruiterIQ</span>
      </div>

      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6">
        <Mail className="w-8 h-8 text-indigo-400" />
      </div>

      <h1 className="text-2xl font-semibold text-white mb-2">Check your email</h1>
      <p className="text-sm text-slate-400 leading-relaxed mb-8 max-w-xs mx-auto">
        We sent a verification link to your inbox. Click the link to activate your account
        and get started.
      </p>

      {/* Checklist */}
      <div className="bg-white/4 border border-white/8 rounded-xl p-4 text-left mb-8 space-y-2.5">
        {[
          'Check your inbox (and spam folder)',
          'Click the verification link',
          'You\'ll be redirected to your dashboard',
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-3 text-sm text-slate-400">
            <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-semibold text-indigo-400">{i + 1}</span>
            </div>
            {step}
          </div>
        ))}
      </div>

      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sign in
      </Link>
    </div>
  )
}
