'use client'

import { usePathname } from 'next/navigation'
import { getPlanLimit } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/types/database'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':          'Dashboard',
  '/dashboard/scorer':   'Resume Scorer',
  '/dashboard/summary':  'Summary Generator',
  '/dashboard/boolean':  'Boolean Generator',
  '/dashboard/ranking':  'Stack Ranking',
  '/dashboard/history':  'History',
  '/dashboard/settings': 'Settings',
}

interface TopBarProps {
  profile: UserProfile
}

export function TopBar({ profile }: TopBarProps) {
  const pathname = usePathname()
  const title    = PAGE_TITLES[pathname] ?? 'Candid.ai'
  const limit    = getPlanLimit(profile.plan_tier)
  const used     = profile.ai_calls_this_month
  const pct      = limit ? Math.min((used / limit) * 100, 100) : 0

  const meterColor = pct >= 90
    ? 'bg-red-500'
    : pct >= 70
      ? 'bg-yellow-500'
      : 'bg-indigo-500'

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#0F1117]/80 backdrop-blur-sm sticky top-0 z-10">
      <h1 className="text-lg font-semibold text-white">{title}</h1>

      {/* Usage meter — only shown when meaningful */}
      {limit !== null && (
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">AI calls this month</p>
            <p className="text-sm font-semibold text-white">
              {used}
              <span className="text-slate-500 font-normal"> / {limit}</span>
            </p>
          </div>
          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', meterColor)}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {limit === null && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-slate-400">Unlimited AI calls</span>
        </div>
      )}
    </header>
  )
}
