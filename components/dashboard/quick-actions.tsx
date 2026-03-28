'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { FileSearch, FileText, Search, Trophy, ArrowRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/types/database'

const ACTIONS = [
  {
    label:       'Resume Scorer',
    description: 'Score any resume against a job description',
    href:        '/dashboard/scorer',
    icon:        FileSearch,
    color:       'text-indigo-400',
    bg:          'bg-indigo-500/10',
    border:      'border-indigo-500/20',
    plans:       ['free', 'pro', 'agency'] as const,
  },
  {
    label:       'Summary Generator',
    description: 'Generate a 4-bullet client submittal summary',
    href:        '/dashboard/summary',
    icon:        FileText,
    color:       'text-violet-400',
    bg:          'bg-violet-500/10',
    border:      'border-violet-500/20',
    plans:       ['free', 'pro', 'agency'] as const,
  },
  {
    label:       'Boolean Generator',
    description: 'Build optimized LinkedIn and Indeed search strings',
    href:        '/dashboard/boolean',
    icon:        Search,
    color:       'text-blue-400',
    bg:          'bg-blue-500/10',
    border:      'border-blue-500/20',
    plans:       ['free', 'pro', 'agency'] as const,
  },
  {
    label:       'Stack Ranking',
    description: 'Rank multiple candidates against one job description',
    href:        '/dashboard/ranking',
    icon:        Trophy,
    color:       'text-yellow-400',
    bg:          'bg-yellow-500/10',
    border:      'border-yellow-500/20',
    plans:       ['agency'] as const,
  },
]

interface QuickActionsProps {
  profile: UserProfile
}

export function QuickActions({ profile }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {ACTIONS.map(({ label, description, href, icon: Icon, color, bg, border, plans }, i) => {
        const isLocked = !plans.includes(profile.plan_tier as never)

        return (
          <motion.div
            key={href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 + 0.15, duration: 0.25, ease: 'easeOut' }}
          >
            {isLocked ? (
              <div className={cn(
                'glass-card rounded-2xl p-4 border opacity-60 cursor-not-allowed',
                border
              )}>
                <div className="flex items-start justify-between mb-3">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', bg)}>
                    <Icon className={cn('w-4 h-4', color)} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/60 px-2 py-1 rounded-full">
                    <Lock className="w-3 h-3" />
                    Agency
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-400 mb-1">{label}</p>
                <p className="text-xs text-slate-600">{description}</p>
              </div>
            ) : (
              <Link
                href={href}
                className={cn(
                  'glass-card rounded-2xl p-4 border block group transition-all duration-200',
                  'hover:border-white/20 hover:bg-white/6',
                  border
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-150 group-hover:scale-105', bg)}>
                    <Icon className={cn('w-4 h-4', color)} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <p className="text-sm font-semibold text-white mb-1">{label}</p>
                <p className="text-xs text-slate-500">{description}</p>
              </Link>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
