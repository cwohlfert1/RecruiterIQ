'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Activity } from 'lucide-react'
import type { ProjectActivityType } from '@/types/database'

// ─── Types ───────────────────────────────────────────────────

interface ActivityItem {
  id:            string
  action_type:   ProjectActivityType
  metadata_json: Record<string, unknown>
  user_id:       string | null
  created_at:    string
  user_email:    string | null
}

interface Props {
  projectId: string
}

// ─── Activity message templates ───────────────────────────────

function getActivityMessage(
  type:     ProjectActivityType,
  meta:     Record<string, unknown>,
  email:    string | null
): { text: string; accent: string } {
  const who = email ? email.split('@')[0] : 'Someone'

  switch (type) {
    case 'project_created':
      return { text: `${who} created this project`, accent: 'text-indigo-400' }

    case 'candidate_added':
      return {
        text:   `${who} added ${meta.name ?? 'a candidate'}`,
        accent: 'text-emerald-400',
      }

    case 'candidate_scored':
      return {
        text:   `${who} scored ${meta.name ?? 'a candidate'} — CQI ${meta.score ?? '—'}`,
        accent: 'text-blue-400',
      }

    case 'candidate_status_changed':
      if (meta.removed) {
        return {
          text:   `${who} removed ${meta.name ?? 'a candidate'}`,
          accent: 'text-rose-400',
        }
      }
      return {
        text:   `${who} moved ${meta.name ?? 'a candidate'} to ${meta.status ?? '—'}`,
        accent: 'text-yellow-400',
      }

    case 'candidate_stage_changed':
      return {
        text:   `${who} moved ${meta.name ?? 'a candidate'} to ${meta.to_stage ?? '—'}`,
        accent: 'text-indigo-400',
      }

    case 'red_flag_checked':
      return {
        text:   `${who} flagged a red flag on ${meta.name ?? 'a candidate'}`,
        accent: 'text-rose-400',
      }

    case 'boolean_generated':
      return {
        text:   `${who} generated Boolean strings for ${meta.count ?? 'the team'}`,
        accent: 'text-purple-400',
      }

    case 'boolean_regenerated':
      return {
        text:   meta.scope === 'all'
          ? `${who} regenerated Boolean strings for everyone`
          : `${who} regenerated their Boolean string`,
        accent: 'text-purple-400',
      }

    case 'assessment_sent':
      return {
        text:   `${who} sent an assessment to ${meta.name ?? 'a candidate'}`,
        accent: 'text-cyan-400',
      }

    case 'assessment_completed':
      return {
        text:   `${meta.name ?? 'A candidate'} completed their assessment — Trust ${meta.trust_score ?? '—'} / Skill ${meta.skill_score ?? '—'}`,
        accent: 'text-cyan-400',
      }

    case 'project_shared':
      return {
        text:   `${who} shared the project with ${meta.count ?? 1} member${(meta.count as number) !== 1 ? 's' : ''}`,
        accent: 'text-indigo-400',
      }

    case 'jd_updated':
      return { text: `${who} updated the job description`, accent: 'text-yellow-400' }

    case 'project_status_changed':
      return {
        text:   `${who} changed project status to ${meta.status ?? '—'}`,
        accent: 'text-slate-300',
      }

    case 'member_added':
      return {
        text:   `${who} added ${meta.email ?? 'a new member'} as ${meta.role ?? 'member'}`,
        accent: 'text-emerald-400',
      }

    case 'batch_score_started':
      return {
        text:   `${who} started batch scoring ${meta.count ?? ''} candidates`,
        accent: 'text-blue-400',
      }

    case 'batch_score_completed':
      return {
        text:   `Batch scoring complete — ${meta.count ?? ''} candidates scored`,
        accent: 'text-blue-400',
      }

    default:
      return { text: 'Activity recorded', accent: 'text-slate-400' }
  }
}

// ─── Avatar ───────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-purple-500',
  'bg-cyan-500',   'bg-rose-500',    'bg-amber-500',
]

function Avatar({ email }: { email: string | null }) {
  const char  = email ? email[0].toUpperCase() : '?'
  const color = email
    ? AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length]
    : 'bg-slate-600'

  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
      {char}
    </div>
  )
}

// ─── Single item ──────────────────────────────────────────────

function ActivityItemRow({ item }: { item: ActivityItem }) {
  const { text, accent } = getActivityMessage(
    item.action_type,
    item.metadata_json ?? {},
    item.user_email
  )

  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <Avatar email={item.user_email} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${accent}`}>{text}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────

export function ActivityTab({ projectId }: Props) {
  const [items,    setItems]    = useState<ActivityItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [nextPage, setNextPage] = useState<number | null>(null)
  const [fetching, setFetching] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback(async (page: number) => {
    setFetching(true)
    try {
      const res  = await fetch(`/api/projects/${projectId}/activity?page=${page}`)
      const json = await res.json()
      if (res.ok) {
        setItems(prev => page === 0 ? json.items : [...prev, ...json.items])
        setNextPage(json.nextPage)
      }
    } finally {
      setFetching(false)
      setLoading(false)
    }
  }, [projectId])

  // Initial load
  useEffect(() => {
    fetchPage(0)
  }, [fetchPage])

  // Infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && nextPage !== null && !fetching) {
          fetchPage(nextPage)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [nextPage, fetching, fetchPage])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/8 flex items-center justify-center mb-4">
          <Activity className="w-6 h-6 text-slate-600" />
        </div>
        <p className="text-sm font-medium text-slate-400 mb-1">No activity yet</p>
        <p className="text-xs text-slate-600 max-w-xs">
          Actions taken on this project will appear here.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="divide-y divide-white/5">
        {items.map(item => (
          <ActivityItemRow key={item.id} item={item} />
        ))}
      </div>

      {/* Sentinel + loader */}
      <div ref={sentinelRef} className="h-4" />
      {fetching && nextPage !== null && (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-indigo-400/50 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
