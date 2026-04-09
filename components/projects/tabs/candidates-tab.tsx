'use client'

import { useState, useRef, useMemo, useCallback } from 'react'
import { UserPlus, Users, Loader2, Search, X, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { CandidateStatus, BreakdownJson, PipelineStage } from '@/types/database'
import { AddCandidateSlideover }  from '@/components/projects/candidates/add-candidate-slideover'
import { ViewResumeSlideover }    from '@/components/projects/candidates/view-resume-slideover'
import { GenerateSummaryModal }   from '@/components/projects/candidates/generate-summary-modal'
import { SendAssessmentModal }    from '@/components/projects/candidates/send-assessment-modal'
import { CandidatesTable }        from '@/components/projects/candidates/candidates-table'
import { BatchScoreBar }          from '@/components/projects/candidates/batch-score-bar'
import { CandidateFilters, DEFAULT_FILTERS } from '@/components/projects/candidate-filters'
import { CandidateSlideout }      from '@/components/projects/candidate-slideout'
import { CandidateCompare }       from '@/components/projects/candidate-compare'
import type { FilterState }       from '@/components/projects/candidate-filters'

interface BatchState {
  current:  number
  total:    number
  failed:   number
  done:     boolean
}

interface ProjectRef {
  id:          string
  title:       string
  client_name: string
  jd_text:     string | null
  owner_id:    string
}

interface Props {
  project:           ProjectRef
  initialCandidates: CandidateRow[]
  userId:            string
  canEdit:           boolean
  isOwner:           boolean
  isManager:         boolean
  planTier?:         'free' | 'pro' | 'agency'
  members?:          Array<{ user_id: string; email: string | null }>
}

const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  sourced: 'Sourced', contacted: 'Contacted',
  internal_submittal: 'Internal Submittal', assessment: 'Assessment',
  submitted: 'Submitted', placed: 'Placed', rejected: 'Rejected',
}

export function CandidatesTab({
  project, initialCandidates, userId, canEdit, isOwner, isManager, planTier = 'free', members = [],
}: Props) {
  const [candidates,     setCandidates]     = useState<CandidateRow[]>(initialCandidates)
  const [addOpen,        setAddOpen]        = useState(false)
  const [viewCandidate,  setViewCandidate]  = useState<CandidateRow | null>(null)
  const [slideout,       setSlideout]       = useState<CandidateRow | null>(null)
  const [summaryTarget,  setSummaryTarget]  = useState<CandidateRow | null>(null)
  const [assessTarget,   setAssessTarget]   = useState<CandidateRow | null>(null)
  const [summaryOpen,    setSummaryOpen]    = useState(false)
  const [assessOpen,     setAssessOpen]     = useState(false)
  const [batchState,     setBatchState]     = useState<BatchState | null>(null)
  const [confirmBatch,   setConfirmBatch]   = useState(false)
  const [scoringIds,     setScoringIds]     = useState<Set<string>>(new Set())
  const [compareBase,    setCompareBase]    = useState<CandidateRow | null>(null)

  // Search & Filters
  const [searchQuery,    setSearchQuery]    = useState('')
  const [filters,        setFilters]        = useState<FilterState>(DEFAULT_FILTERS)

  // Bulk actions
  const [selected,       setSelected]       = useState<Set<string>>(new Set())
  const [bulkStage,      setBulkStage]      = useState<PipelineStage | ''>('')
  const [bulkMoving,     setBulkMoving]     = useState(false)
  const [bulkRemoving,   setBulkRemoving]   = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  const hasJd      = !!project.jd_text
  const unscored   = candidates.filter(c => c.cqi_score === null)
  const showBatch  = hasJd && unscored.length > 0 && !batchState?.done

  // ── Derived: all tags across candidates ─────────────────────

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const c of candidates) {
      for (const tag of (c.tags_json ?? []) as string[]) set.add(tag)
    }
    return Array.from(set).sort()
  }, [candidates])

  const memberOptions = useMemo(() => members.map(m => ({
    value: m.user_id,
    label: m.email?.split('@')[0] ?? m.user_id.slice(0, 8),
  })), [members])

  // ── Filtered + searched candidates ──────────────────────────

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return candidates.filter(c => {
      // Search
      if (q && !c.candidate_name.toLowerCase().includes(q) && !c.candidate_email.toLowerCase().includes(q)) return false
      // Stages
      if (filters.stages.length > 0 && !filters.stages.includes((c.pipeline_stage ?? 'sourced') as PipelineStage)) return false
      // CQI range (only if scored)
      if (c.cqi_score !== null) {
        if (c.cqi_score < filters.cqiMin || c.cqi_score > filters.cqiMax) return false
      }
      // Red flags
      if (filters.redFlags === 'none' && c.red_flag_score !== null) return false
      if (filters.redFlags === 'has'  && c.red_flag_score === null) return false
      // Assessment
      if (filters.assessment === 'not_sent'  && c.invite_status !== null) return false
      if (filters.assessment === 'pending'   && c.invite_status !== 'pending') return false
      if (filters.assessment === 'completed' && c.invite_status !== 'completed') return false
      // Tags
      if (filters.tags.length > 0) {
        const cTags = (c.tags_json ?? []) as string[]
        if (!filters.tags.every(t => cTags.includes(t))) return false
      }
      // Added by
      if (filters.addedBy.length > 0 && !filters.addedBy.includes(c.added_by ?? '')) return false
      return true
    })
  }, [candidates, searchQuery, filters])

  // ── Checkbox helpers ─────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(c => c.id)))
    }
  }

  // ── Bulk move stage ──────────────────────────────────────────

  async function handleBulkMove() {
    if (!bulkStage || selected.size === 0) return
    setBulkMoving(true)
    const ids = Array.from(selected)
    let success = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/projects/${project.id}/candidates/${id}/stage`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: bulkStage }),
        })
        if (res.ok) { success++; setCandidates(prev => prev.map(c => c.id === id ? { ...c, pipeline_stage: bulkStage as PipelineStage } : c)) }
      } catch { /* continue */ }
    }
    setBulkMoving(false)
    setSelected(new Set())
    setBulkStage('')
    toast.success(`${success} candidate${success !== 1 ? 's' : ''} moved to ${PIPELINE_STAGE_LABELS[bulkStage as PipelineStage]}`)
  }

  // ── Bulk remove ──────────────────────────────────────────────

  async function handleBulkRemove() {
    if (!confirm(`Remove ${selected.size} candidate${selected.size !== 1 ? 's' : ''} from this project?`)) return
    setBulkRemoving(true)
    const ids = Array.from(selected)
    let success = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/projects/${project.id}/candidates/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deleted_at: 'now' }),
        })
        if (res.ok) { success++; setCandidates(prev => prev.filter(c => c.id !== id)) }
      } catch { /* continue */ }
    }
    setBulkRemoving(false)
    setSelected(new Set())
    toast.success(`${success} candidate${success !== 1 ? 's' : ''} removed`)
  }

  // ── Export CSV ────────────────────────────────────────────────

  function handleExportCSV() {
    const selectedCandidates = filtered.filter(c => selected.has(c.id))
    const rows = [
      ['Name', 'Email', 'Stage', 'CQI Score', 'Red Flags', 'Assessment', 'Tags'],
      ...selectedCandidates.map(c => [
        c.candidate_name,
        c.candidate_email,
        PIPELINE_STAGE_LABELS[(c.pipeline_stage ?? 'sourced') as PipelineStage],
        c.cqi_score?.toString() ?? '',
        c.red_flag_score !== null ? (((c.red_flags_json as unknown[])?.length ?? 0) + ' flags') : 'Not checked',
        c.invite_status ?? 'Not sent',
        ((c.tags_json ?? []) as string[]).join('; '),
      ]),
    ]
    const csv  = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${project.title}-candidates.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${selectedCandidates.length} candidate${selectedCandidates.length !== 1 ? 's' : ''} exported`)
  }

  // ── Add candidate ────────────────────────────────────────────

  function handleAdded(candidate: CandidateRow) {
    setCandidates(prev => [candidate, ...prev])
  }

  // ── Status change ────────────────────────────────────────────

  function handleStatusChange(id: string, status: CandidateStatus) {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  // ── Remove ───────────────────────────────────────────────────

  function handleRemove(id: string) {
    setCandidates(prev => prev.filter(c => c.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  // ── Score individual ─────────────────────────────────────────

  async function handleScoreIndividual(candidate: CandidateRow) {
    if (!hasJd) { toast.error('Add a job description to enable scoring'); return }
    setScoringIds(prev => new Set(prev).add(candidate.id))
    try {
      const res  = await fetch(`/api/projects/${project.id}/candidates/${candidate.id}/score`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Scoring failed'); return }
      setCandidates(prev => prev.map(c =>
        c.id === candidate.id
          ? { ...c, cqi_score: data.cqi_score, cqi_breakdown_json: data.cqi_breakdown_json as BreakdownJson }
          : c,
      ))
      toast.success(`CQI: ${data.cqi_score}`)
    } catch {
      toast.error('Scoring failed')
    } finally {
      setScoringIds(prev => { const s = new Set(prev); s.delete(candidate.id); return s })
    }
  }

  // ── Red flag check ────────────────────────────────────────────

  async function handleRedFlag(candidateId: string) {
    const candidate = candidates.find(c => c.id === candidateId)
    if (!candidate) return
    try {
      const res  = await fetch(`/api/projects/${project.id}/candidates/${candidateId}/red-flag`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Red flag check failed'); return }
      setCandidates(prev => prev.map(c =>
        c.id === candidateId
          ? { ...c, red_flag_score: data.integrity_score, red_flag_summary: data.summary, red_flags_json: data.flags }
          : c,
      ))
      const flagCount = data.flags?.length ?? 0
      toast.success(flagCount === 0 ? 'No red flags found' : `${flagCount} flag${flagCount !== 1 ? 's' : ''} found`)
    } catch {
      toast.error('Red flag check failed')
    }
  }

  // ── Batch score ───────────────────────────────────────────────

  async function startBatchScore() {
    setConfirmBatch(false)
    setBatchState({ current: 0, total: unscored.length, failed: 0, done: false })
    abortRef.current = new AbortController()
    try {
      const res = await fetch(`/api/projects/${project.id}/candidates/batch-score`, {
        method: 'POST',
        signal: abortRef.current.signal,
      })
      if (!res.ok) { setBatchState(null); return }
      const reader  = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'progress') {
              setCandidates(prev => prev.map(c =>
                c.id === event.candidateId
                  ? { ...c, cqi_score: event.score, cqi_breakdown_json: event.breakdown as BreakdownJson }
                  : c,
              ))
              setBatchState(s => s ? { ...s, current: event.current } : s)
            }
            if (event.type === 'complete') {
              setBatchState(s => s ? { ...s, current: event.total, done: true, failed: event.failed } : s)
              if (event.failed === 0) toast.success('All candidates scored!')
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setBatchState(null)
    }
  }

  // ── Modal handlers ────────────────────────────────────────────

  function openSummary(c: CandidateRow)    { setSummaryTarget(c); setSummaryOpen(true) }
  function openAssessment(c: CandidateRow) { setAssessTarget(c);  setAssessOpen(true)  }

  function handleAssessmentSent(candidateId: string, inviteId: string) {
    setCandidates(prev => prev.map(c =>
      c.id === candidateId ? { ...c, assessment_invite_id: inviteId, invite_status: 'pending' } : c,
    ))
  }

  // ── Slide-out handlers ────────────────────────────────────────

  const handleSlideoutStageChange = useCallback((id: string, stage: PipelineStage) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, pipeline_stage: stage } : c))
  }, [])

  const handleSlideoutTagsChange = useCallback((id: string, tags: string[]) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, tags_json: tags } : c))
  }, [])

  const handleSlideoutRemove = useCallback((id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id))
    setSlideout(null)
  }, [])

  // ─────────────────────────────────────────────────────────────

  const allSelected   = selected.size > 0 && selected.size === filtered.length
  const someSelected  = selected.size > 0 && !allSelected

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-200">
            {candidates.length} Candidate{candidates.length !== 1 ? 's' : ''}
          </h3>
          {hasJd && unscored.length > 0 && (!batchState || batchState.done) && (
            <button
              onClick={() => setConfirmBatch(true)}
              className="text-xs text-indigo-400 hover:text-indigo-200 transition-colors border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 rounded-full"
            >
              Score {unscored.length} unscored
            </button>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
          >
            <UserPlus className="w-4 h-4" />
            Add Candidate
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-9 pr-9 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4">
        <CandidateFilters
          filters={filters}
          onChange={setFilters}
          allTags={allTags}
          memberOptions={memberOptions}
          isAgency={planTier === 'agency'}
        />
      </div>

      {/* No-JD warning */}
      {!hasJd && candidates.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-xs text-yellow-300">
          Add a job description to enable auto-scoring.
        </div>
      )}

      {/* Batch score progress */}
      {batchState && (
        <BatchScoreBar
          current={batchState.current}
          total={batchState.total}
          failed={batchState.failed}
          onDismiss={() => setBatchState(null)}
          onRetry={() => startBatchScore()}
        />
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <span className="text-xs font-medium text-indigo-300">
            {selected.size} candidate{selected.size !== 1 ? 's' : ''} selected
          </span>

          {/* Move to stage */}
          <div className="flex items-center gap-1.5 ml-2">
            <select
              value={bulkStage}
              onChange={e => setBulkStage(e.target.value as PipelineStage | '')}
              className="text-xs bg-white/5 border border-white/10 text-slate-400 px-2 py-1 rounded-lg appearance-none focus:outline-none focus:border-indigo-500/40"
            >
              <option value="" className="bg-[#1A1D2E]">Move to stage…</option>
              {Object.entries(PIPELINE_STAGE_LABELS).map(([k, v]) => (
                <option key={k} value={k} className="bg-[#1A1D2E] text-white">{v}</option>
              ))}
            </select>
            <button
              onClick={handleBulkMove}
              disabled={!bulkStage || bulkMoving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 hover:bg-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {bulkMoving ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3 rotate-270" />}
              Move
            </button>
          </div>

          {/* Send Assessment */}
          {isManager && (
            <button
              onClick={() => { if (filtered.filter(c => selected.has(c.id)).length > 0) { setAssessTarget(filtered.filter(c => selected.has(c.id))[0]); setAssessOpen(true) }}}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
            >
              Send Assessment
            </button>
          )}

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            Export CSV
          </button>

          {/* Remove */}
          {canEdit && (
            <button
              onClick={handleBulkRemove}
              disabled={bulkRemoving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40 transition-colors ml-auto"
            >
              {bulkRemoving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Remove
            </button>
          )}
        </div>
      )}

      {/* Confirm batch modal */}
      {confirmBatch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12141F] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-white">Score {unscored.length} candidates?</h3>
            <p className="text-xs text-slate-400">
              This will use {unscored.length} screening{unscored.length !== 1 ? 's' : ''} to score all unscored candidates.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmBatch(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:text-white transition-colors">Cancel</button>
              <button onClick={startBatchScore} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150">
                Score All ({unscored.length} credits)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidates table */}
      {filtered.length > 0 ? (
        <CandidatesTable
          candidates={filtered}
          projectId={project.id}
          userId={userId}
          canEdit={canEdit}
          isOwner={isOwner}
          isManager={isManager}
          selected={selected}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          allSelected={allSelected}
          someSelected={someSelected}
          onStatusChange={handleStatusChange}
          onScored={() => {}}
          onRedFlag={handleRedFlag}
          onRemove={handleRemove}
          onViewResume={c => setSlideout(c)}
          onSummary={openSummary}
          onAssessment={openAssessment}
          onScoreIndividual={handleScoreIndividual}
          onCompare={c => setCompareBase(c)}
        />
      ) : candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/8 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-slate-600" />
          </div>
          <p className="text-sm font-medium text-slate-400 mb-1">No candidates yet</p>
          <p className="text-xs text-slate-600 max-w-xs mb-6">Add candidates to start building your pipeline.</p>
          {canEdit && (
            <button onClick={() => setAddOpen(true)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150">
              Add your first candidate
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium text-slate-400 mb-1">No candidates match your filters</p>
          <p className="text-xs text-slate-600 mb-4">Try adjusting your search or filter criteria.</p>
          <button
            onClick={() => { setSearchQuery(''); setFilters(DEFAULT_FILTERS) }}
            className="text-xs text-indigo-400 hover:text-indigo-200 transition-colors border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 rounded-full"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Slide-overs + Modals */}
      <AddCandidateSlideover
        open={addOpen}
        projectId={project.id}
        hasJd={hasJd}
        isManager={isManager}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
      />

      {/* Candidate detail slide-out (replaces view-resume) */}
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
        onAssessmentSent={handleAssessmentSent}
        members={members.map(m => ({ user_id: m.user_id, role: 'member', email: m.email }))}
      />

      {/* Legacy view-resume slide-over (kept for backward compat) */}
      <ViewResumeSlideover
        candidate={viewCandidate}
        onClose={() => setViewCandidate(null)}
      />

      <GenerateSummaryModal
        open={summaryOpen}
        candidate={summaryTarget}
        project={project}
        onClose={() => { setSummaryOpen(false); setSummaryTarget(null) }}
      />

      <SendAssessmentModal
        open={assessOpen}
        candidate={assessTarget}
        project={project}
        onClose={() => { setAssessOpen(false); setAssessTarget(null) }}
        onSent={handleAssessmentSent}
      />

      {compareBase && (
        <CandidateCompare
          base={compareBase}
          candidates={candidates}
          projectId={project.id}
          onClose={() => setCompareBase(null)}
        />
      )}
    </div>
  )
}
