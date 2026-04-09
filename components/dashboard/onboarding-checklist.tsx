'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface OnboardingStep {
  key: string
  label: string
  href: string
  done: boolean
}

interface OnboardingChecklistProps {
  aiCallsUsed: number
  hasProjects: boolean
  hasScoredCandidate: boolean
  hasBooleanSearch: boolean
  hasSummary: boolean
}

export function OnboardingChecklist({
  aiCallsUsed,
  hasProjects,
  hasScoredCandidate,
  hasBooleanSearch,
  hasSummary,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('candidai_onboarding_dismissed')
    setDismissed(stored === 'true')
  }, [])

  const steps: OnboardingStep[] = [
    { key: 'project',   label: 'Create your first project',       href: '/dashboard/projects/create', done: hasProjects },
    { key: 'score',     label: 'Add a candidate and score them',  href: '/dashboard/projects',        done: hasScoredCandidate },
    { key: 'boolean',   label: 'Generate a Boolean string',       href: '/dashboard/boolean',         done: hasBooleanSearch },
    { key: 'summary',   label: 'Generate a client summary',       href: '/dashboard/summary',         done: hasSummary },
  ]

  const completedCount = steps.filter(s => s.done).length
  const allDone = completedCount === steps.length

  // Don't show if dismissed, all done, or user has significant activity
  if (dismissed || allDone || aiCallsUsed >= 5) return null

  function handleDismiss() {
    localStorage.setItem('candidai_onboarding_dismissed', 'true')
    setDismissed(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="glass-card rounded-2xl p-5 mb-6"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Get started with Candid.ai</h3>
            <p className="text-[11px] text-slate-500">Complete these steps to get the most out of your account</p>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-indigo-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(completedCount / steps.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[11px] text-slate-500 tabular-nums flex-shrink-0">{completedCount} of {steps.length}</span>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5">
              {steps.map(step => (
                <Link
                  key={step.key}
                  href={step.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                    step.done
                      ? 'text-slate-500'
                      : 'text-slate-300 hover:bg-white/5',
                  )}
                >
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  )}
                  <span className={step.done ? 'line-through' : ''}>{step.label}</span>
                </Link>
              ))}
            </div>

            <button
              onClick={handleDismiss}
              className="mt-3 text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              I know what I&apos;m doing →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
