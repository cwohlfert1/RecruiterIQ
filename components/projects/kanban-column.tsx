'use client'

import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CandidateCard } from '@/components/projects/candidate-card'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { PipelineStage } from '@/types/database'

interface Props {
  stage:         PipelineStage
  label:         string
  candidates:    CandidateRow[]
  noteCounts:    Record<string, number>
  canEdit:       boolean
  isOver:        boolean
  onCardClick:   (candidate: CandidateRow) => void
  onAddClick:    () => void
}

export function KanbanColumn({
  stage, label, candidates, noteCounts, canEdit, isOver, onCardClick, onAddClick,
}: Props) {
  const { setNodeRef } = useDroppable({ id: stage })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col flex-shrink-0 w-60 rounded-2xl border transition-all duration-150',
        isOver
          ? 'border-indigo-400/60 bg-indigo-500/5 shadow-[0_0_0_2px_rgba(99,102,241,0.15)]'
          : 'border-white/8 bg-[#14172A]',
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/6 bg-slate-800/40 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">{label}</span>
          <span className="text-[10px] font-bold text-slate-500 bg-white/8 px-1.5 py-0.5 rounded-full tabular-nums">
            {candidates.length}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={onAddClick}
            className="w-5 h-5 rounded-md flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/8 transition-colors"
            title={`Add candidate to ${label}`}
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
        {candidates.map(c => (
          <CandidateCard
            key={c.id}
            candidate={c}
            noteCount={noteCounts[c.id] ?? 0}
            onClick={() => onCardClick(c)}
          />
        ))}

        {candidates.length === 0 && (
          <div className={cn(
            'h-16 flex items-center justify-center rounded-xl border border-dashed text-xs text-slate-700 transition-colors',
            isOver ? 'border-indigo-400/40 text-indigo-500' : 'border-white/8',
          )}>
            {isOver ? 'Drop here' : 'Empty'}
          </div>
        )}
      </div>
    </div>
  )
}
