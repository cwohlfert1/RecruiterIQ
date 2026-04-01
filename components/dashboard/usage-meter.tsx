'use client'

import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/types/database'

interface UsageMeterProps {
  profile: UserProfile
}

export function UsageMeter({ profile }: UsageMeterProps) {
  const isFree = profile.plan_tier === 'free'
  const limit  = isFree ? 10 : null
  const used   = profile.ai_calls_this_month

  if (!isFree) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">AI calls this month</span>
          <span className="text-sm font-semibold text-white tabular-nums">{used} used</span>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-green-500/8 border border-green-500/20">
          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-green-300">Unlimited</span>
          <span className="text-xs text-slate-500 ml-auto">No call limit on your plan</span>
        </div>
      </div>
    )
  }

  const pct   = Math.min((used / limit!) * 100, 100)
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-indigo-500'
  const remaining = Math.max((limit ?? 0) - used, 0)

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">AI calls this month</span>
        <span className="text-sm font-semibold text-white tabular-nums">
          {used}
          <span className="text-slate-500 font-normal"> / {limit}</span>
        </span>
      </div>

      <div className="w-full h-2 bg-white/8 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          className={cn('h-full rounded-full', color)}
        />
      </div>

      <p className={cn(
        'text-xs',
        remaining === 0 ? 'text-red-400' : remaining <= 2 ? 'text-yellow-400' : 'text-slate-500'
      )}>
        {remaining === 0
          ? 'You\'ve used all your free calls this month'
          : `${remaining} call${remaining === 1 ? '' : 's'} remaining`}
      </p>
    </div>
  )
}
