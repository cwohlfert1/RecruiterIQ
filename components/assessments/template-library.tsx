'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { TEMPLATE_CONFIGS } from '@/lib/assessment-constants'
import { cn } from '@/lib/utils'

const ACCENT_CLASSES: Record<string, { card: string; badge: string; btn: string }> = {
  indigo: {
    card:  'border-indigo-500/25 hover:border-indigo-500/50 bg-indigo-500/5 hover:bg-indigo-500/8',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
    btn:   'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border-indigo-500/30',
  },
  violet: {
    card:  'border-violet-500/25 hover:border-violet-500/50 bg-violet-500/5 hover:bg-violet-500/8',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
    btn:   'bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border-violet-500/30',
  },
  emerald: {
    card:  'border-emerald-500/25 hover:border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/8',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    btn:   'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30',
  },
  yellow: {
    card:  'border-yellow-500/25 hover:border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/8',
    badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
    btn:   'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-yellow-500/30',
  },
  orange: {
    card:  'border-orange-500/25 hover:border-orange-500/50 bg-orange-500/5 hover:bg-orange-500/8',
    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
    btn:   'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-orange-500/30',
  },
  blue: {
    card:  'border-blue-500/25 hover:border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/8',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
    btn:   'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/30',
  },
  cyan: {
    card:  'border-cyan-500/25 hover:border-cyan-500/50 bg-cyan-500/5 hover:bg-cyan-500/8',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
    btn:   'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/30',
  },
  slate: {
    card:  'border-slate-500/25 hover:border-slate-400/40 bg-slate-500/5 hover:bg-slate-500/8',
    badge: 'bg-slate-500/15 text-slate-300 border-slate-500/20',
    btn:   'bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 border-slate-500/30',
  },
  purple: {
    card:  'border-purple-500/25 hover:border-purple-500/50 bg-purple-500/5 hover:bg-purple-500/8',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
    btn:   'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-purple-500/30',
  },
  teal: {
    card:  'border-teal-500/25 hover:border-teal-500/50 bg-teal-500/5 hover:bg-teal-500/8',
    badge: 'bg-teal-500/15 text-teal-300 border-teal-500/20',
    btn:   'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border-teal-500/30',
  },
  green: {
    card:  'border-green-500/25 hover:border-green-500/50 bg-green-500/5 hover:bg-green-500/8',
    badge: 'bg-green-500/15 text-green-300 border-green-500/20',
    btn:   'bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/30',
  },
  red: {
    card:  'border-red-500/25 hover:border-red-500/50 bg-red-500/5 hover:bg-red-500/8',
    badge: 'bg-red-500/15 text-red-300 border-red-500/20',
    btn:   'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30',
  },
  rose: {
    card:  'border-rose-500/25 hover:border-rose-500/50 bg-rose-500/5 hover:bg-rose-500/8',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
    btn:   'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/30',
  },
  pink: {
    card:  'border-pink-500/25 hover:border-pink-500/50 bg-pink-500/5 hover:bg-pink-500/8',
    badge: 'bg-pink-500/15 text-pink-300 border-pink-500/20',
    btn:   'bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border-pink-500/30',
  },
  amber: {
    card:  'border-amber-500/25 hover:border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/8',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    btn:   'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30',
  },
}

export function TemplateLibrary() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUseTemplate(role: string) {
    setLoading(role)
    try {
      const res  = await fetch('/api/assessments/template', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ template: role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to generate questions')

      // Store template data in sessionStorage for the builder to pick up
      sessionStorage.setItem('assessmentTemplate', JSON.stringify({
        template_type: role,
        title:         `${role} Assessment`,
        role,
        questions:     json.questions ?? [],
      }))

      router.push('/dashboard/assessments/create')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/assessments"
              className="text-slate-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-semibold text-white">Template Library</h1>
          </div>
          <p className="text-sm text-slate-400 ml-6">
            Choose a role template — Cortex AI will generate a tailored assessment with starter questions
          </p>
        </div>
        <Link
          href="/dashboard/assessments/create"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 bg-white/5 border border-white/10 hover:border-white/20 hover:text-white transition-colors whitespace-nowrap flex-shrink-0"
        >
          Start from Scratch →
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATE_CONFIGS.map(config => {
          const accent  = ACCENT_CLASSES[config.accent] ?? ACCENT_CLASSES.indigo
          const isLoading = loading === config.role

          return (
            <div
              key={config.role}
              className={cn(
                'flex flex-col p-5 rounded-2xl border transition-all duration-150',
                accent.card
              )}
            >
              {/* Icon + title */}
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">{config.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{config.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{config.description}</p>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-4 flex-1">
                {config.tags.map(tag => (
                  <span
                    key={tag}
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[11px] font-medium border',
                      accent.badge
                    )}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => handleUseTemplate(config.role)}
                disabled={loading !== null}
                className={cn(
                  'flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-medium border transition-all duration-150',
                  accent.btn,
                  loading !== null && !isLoading && 'opacity-40 cursor-not-allowed',
                  isLoading && 'cursor-wait'
                )}
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Use Template
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-600 text-center">
        Templates generate 3 starter questions. You can add, edit, or remove questions in the builder.
      </p>
    </div>
  )
}
