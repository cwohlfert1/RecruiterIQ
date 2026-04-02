'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'

// ─── Avatar ───────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-purple-500',
  'bg-cyan-500',   'bg-rose-500',    'bg-amber-500',
]

function InitialAvatar({ name }: { name: string }) {
  const char  = name.trim()[0]?.toUpperCase() ?? '?'
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  return (
    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0', color)}>
      {char}
    </div>
  )
}

// ─── CQI badge ────────────────────────────────────────────────

function CqiBadge({ score }: { score: number }) {
  const cls =
    score >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' :
    score >= 60 ? 'text-yellow-400  bg-yellow-500/10  border-yellow-500/25'  :
                  'text-red-400     bg-red-500/10      border-red-500/25'
  return (
    <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded-full border tabular-nums', cls)}>
      {score}
    </span>
  )
}

// ─── Days in stage ────────────────────────────────────────────

function daysInStage(stageChangedAt: string): string {
  const days = differenceInDays(new Date(), new Date(stageChangedAt))
  if (days === 0) return 'Today'
  return `${days}d`
}

// ─── Props ────────────────────────────────────────────────────

interface Props {
  candidate:   CandidateRow
  noteCount:   number
  onClick:     () => void
  isDragOverlay?: boolean
}

// ─── Component ───────────────────────────────────────────────

export function CandidateCard({ candidate: c, noteCount, onClick, isDragOverlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:   c.id,
    data: { candidateId: c.id, stage: c.pipeline_stage },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const hasFlags   = c.red_flag_score !== null && (c.red_flags_json as unknown[] | null)?.length
  const hasAssess  = c.invite_status !== null
  const stageDate  = c.stage_changed_at ?? c.created_at

  const tags = (c.tags_json ?? []) as string[]

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-[#1A1D2E] border rounded-xl p-3 cursor-grab active:cursor-grabbing select-none',
        'transition-all duration-150',
        isDragging || isDragOverlay
          ? 'border-indigo-400 shadow-[0_0_0_2px_rgba(99,102,241,0.4)] opacity-60'
          : 'border-white/8 hover:border-white/16 hover:shadow-lg',
      )}
    >
      {/* Row 1: avatar + name + days in stage */}
      <div className="flex items-start gap-2 mb-2">
        <InitialAvatar name={c.candidate_name} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{c.candidate_name}</p>
          <p className="text-[11px] text-slate-500 truncate">{c.candidate_email}</p>
        </div>
        <span className="text-[10px] text-slate-600 flex-shrink-0 mt-0.5">
          {daysInStage(stageDate)}
        </span>
      </div>

      {/* Row 2: badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {c.cqi_score !== null && <CqiBadge score={c.cqi_score} />}

        {hasFlags ? (
          <span className="text-[11px]" title="Has red flags">🚩</span>
        ) : null}

        {hasAssess && c.invite_status === 'completed' && c.trust_score !== null ? (
          <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-full">
            T:{c.trust_score} S:{c.skill_score ?? '—'}
          </span>
        ) : hasAssess ? (
          <span className="text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">
            Pending
          </span>
        ) : null}

        {noteCount > 0 && (
          <span className="text-[10px] text-slate-500 ml-auto">
            📝 {noteCount}
          </span>
        )}
      </div>

      {/* Row 3: tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400"
            >
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-[10px] text-slate-600">+{tags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}
