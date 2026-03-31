'use client'

import { motion } from 'framer-motion'
import { FileSearch, FileText, Search, Trophy, Clock } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import type { ActivityLog, ActivityFeature } from '@/types/database'

const FEATURE_META: Record<ActivityFeature, { icon: React.ReactNode; color: string; label: string }> = {
  resume_scorer:  { icon: <FileSearch className="w-4 h-4" />, color: 'text-indigo-400 bg-indigo-500/15', label: 'Resume Scorer'     },
  summary:        { icon: <FileText   className="w-4 h-4" />, color: 'text-violet-400 bg-violet-500/15', label: 'Summary Generator' },
  boolean:        { icon: <Search     className="w-4 h-4" />, color: 'text-blue-400   bg-blue-500/15',   label: 'Boolean Generator' },
  stack_ranking:  { icon: <Trophy     className="w-4 h-4" />, color: 'text-yellow-400 bg-yellow-500/15', label: 'Stack Ranking'     },
}

interface ActivityFeedProps {
  activities: ActivityLog[]
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-3">
          <Clock className="w-5 h-5 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-400">No activity yet</p>
        <p className="text-xs text-slate-600 mt-1">Your recent actions will appear here</p>
      </div>
    )
  }

  return (
    <ul className="space-y-1">
      {activities.map((item, i) => {
        const meta = FEATURE_META[item.feature]
        return (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 + 0.1, duration: 0.2 }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/4 transition-colors duration-150"
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
              {meta.icon}
            </div>
            <p className="flex-1 text-sm text-slate-300 min-w-0 truncate">{item.description}</p>
            <span className="text-xs text-slate-600 flex-shrink-0">
              {formatRelativeTime(item.created_at)}
            </span>
          </motion.li>
        )
      })}
    </ul>
  )
}
