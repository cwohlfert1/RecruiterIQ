'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { KanbanColumn }    from '@/components/projects/kanban-column'
import { CandidateCard }   from '@/components/projects/candidate-card'
import { CandidateSlideout } from '@/components/projects/candidate-slideout'
import { AddCandidateSlideover } from '@/components/projects/candidates/add-candidate-slideover'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { PipelineStage } from '@/types/database'

// ─── Stage config ─────────────────────────────────────────────

export const PIPELINE_STAGES: Array<{ key: PipelineStage; label: string }> = [
  { key: 'reviewing',          label: 'Reviewing'          },
  { key: 'screened',           label: 'Screened'           },
  { key: 'internal_submittal', label: 'Internal Submittal' },
  { key: 'client_submittal',   label: 'Client Submittal'   },
  { key: 'interviewing',       label: 'Interviewing'       },
  { key: 'placed',             label: 'Placed'             },
  { key: 'rejected',           label: 'Rejected'           },
]

// ─── Types ────────────────────────────────────────────────────

interface ProjectRef {
  id:          string
  title:       string
  client_name: string
  jd_text:     string | null
  owner_id:    string
}

interface Props {
  project:              ProjectRef
  initialCandidates:    CandidateRow[]
  userId:               string
  canEdit:              boolean
  isManager:            boolean
  initialStageFilter?:  PipelineStage
}

// ─── Component ───────────────────────────────────────────────

export function KanbanBoard({
  project,
  initialCandidates,
  userId,
  canEdit,
  isManager,
  initialStageFilter,
}: Props) {
  const [candidates, setCandidates] = useState<CandidateRow[]>(initialCandidates)
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [overId,     setOverId]     = useState<PipelineStage | null>(null)
  const [slideout,   setSlideout]   = useState<CandidateRow | null>(null)
  const [addStage,   setAddStage]   = useState<PipelineStage | null>(null)
  const [stageFilter, setStageFilter] = useState<PipelineStage | undefined>(initialStageFilter)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Group candidates by stage
  const byStage = useMemo(() => {
    const map: Record<PipelineStage, CandidateRow[]> = {
      reviewing: [], screened: [], internal_submittal: [],
      client_submittal: [], interviewing: [], placed: [], rejected: [],
    }
    for (const c of candidates) {
      const stage = (c.pipeline_stage ?? 'reviewing') as PipelineStage
      // Apply stage filter if set (from overview funnel click)
      if (stageFilter && stage !== stageFilter) continue
      map[stage].push(c)
    }
    return map
  }, [candidates, stageFilter])

  // Active card for overlay
  const activeCandidate = useMemo(
    () => candidates.find(c => c.id === activeId) ?? null,
    [candidates, activeId]
  )

  // ── Drag handlers ──────────────────────────────────────────

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function onDragOver({ over }: DragOverEvent) {
    setOverId((over?.id as PipelineStage) ?? null)
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    setOverId(null)

    const candidateId = active.id as string
    const newStage    = over?.id as PipelineStage | undefined

    if (!newStage || !PIPELINE_STAGES.find(s => s.key === newStage)) return

    const candidate = candidates.find(c => c.id === candidateId)
    if (!candidate) return

    const currentStage = (candidate.pipeline_stage ?? 'reviewing') as PipelineStage
    if (currentStage === newStage) return

    // Optimistic update
    setCandidates(prev =>
      prev.map(c => c.id === candidateId
        ? { ...c, pipeline_stage: newStage, stage_changed_at: new Date().toISOString() }
        : c
      )
    )

    const stageLabelMap: Record<PipelineStage, string> = {
      reviewing: 'Reviewing', screened: 'Screened',
      internal_submittal: 'Internal Submittal', client_submittal: 'Client Submittal',
      interviewing: 'Interviewing', placed: 'Placed', rejected: 'Rejected',
    }

    try {
      const res = await fetch(
        `/api/projects/${project.id}/candidates/${candidateId}/stage`,
        {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ stage: newStage }),
        }
      )
      if (!res.ok) throw new Error('Failed')
      toast.success(`${candidate.candidate_name} moved to ${stageLabelMap[newStage]}`)
    } catch {
      // Revert on failure
      setCandidates(prev =>
        prev.map(c => c.id === candidateId
          ? { ...c, pipeline_stage: currentStage }
          : c
        )
      )
      toast.error('Failed to move candidate')
    }
  }

  // ── Candidate added from Kanban ────────────────────────────

  const handleAdded = useCallback((candidate: CandidateRow) => {
    setCandidates(prev => [candidate, ...prev])
  }, [])

  // ── Slide-out update handlers ──────────────────────────────

  function handleSlideoutStageChange(candidateId: string, newStage: PipelineStage) {
    setCandidates(prev => prev.map(c =>
      c.id === candidateId
        ? { ...c, pipeline_stage: newStage, stage_changed_at: new Date().toISOString() }
        : c
    ))
    if (slideout?.id === candidateId) {
      setSlideout(prev => prev ? { ...prev, pipeline_stage: newStage } : prev)
    }
  }

  function handleSlideoutTagsChange(candidateId: string, tags: string[]) {
    setCandidates(prev => prev.map(c =>
      c.id === candidateId ? { ...c, tags_json: tags } : c
    ))
    if (slideout?.id === candidateId) {
      setSlideout(prev => prev ? { ...prev, tags_json: tags } : prev)
    }
  }

  function handleSlideoutRemove(candidateId: string) {
    setCandidates(prev => prev.filter(c => c.id !== candidateId))
    setSlideout(null)
  }

  // ─────────────────────────────────────────────────────────────

  const visibleStages = stageFilter
    ? PIPELINE_STAGES.filter(s => s.key === stageFilter)
    : PIPELINE_STAGES

  return (
    <div>
      {/* Stage filter chips (when jumping from overview) */}
      {stageFilter && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-slate-500">Filtered:</span>
          <span className="text-xs font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
            {PIPELINE_STAGES.find(s => s.key === stageFilter)?.label}
          </span>
          <button
            onClick={() => setStageFilter(undefined)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {/* Kanban columns */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {visibleStages.map(stage => (
            <KanbanColumn
              key={stage.key}
              stage={stage.key}
              label={stage.label}
              candidates={byStage[stage.key]}
              noteCounts={{}}
              canEdit={canEdit}
              isOver={overId === stage.key}
              onCardClick={candidate => setSlideout(candidate)}
              onAddClick={() => setAddStage(stage.key)}
            />
          ))}
        </div>

        {/* Drag overlay (ghost card) */}
        <DragOverlay>
          {activeCandidate ? (
            <CandidateCard
              candidate={activeCandidate}
              noteCount={0}
              onClick={() => {}}
              isDragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Candidate slide-out */}
      <CandidateSlideout
        candidate={slideout}
        projectId={project.id}
        project={project}
        userId={userId}
        canEdit={canEdit}
        isManager={isManager}
        onClose={() => setSlideout(null)}
        onStageChange={handleSlideoutStageChange}
        onTagsChange={handleSlideoutTagsChange}
        onRemove={handleSlideoutRemove}
      />

      {/* Add candidate slide-over (pre-seeded stage) */}
      <AddCandidateSlideover
        open={addStage !== null}
        projectId={project.id}
        hasJd={!!project.jd_text}
        initialStage={addStage ?? undefined}
        onClose={() => setAddStage(null)}
        onAdded={handleAdded}
      />
    </div>
  )
}
