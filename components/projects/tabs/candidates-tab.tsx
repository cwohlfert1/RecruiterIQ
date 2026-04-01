'use client'

import { useState, useRef } from 'react'
import { UserPlus, Users, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { CandidateStatus, BreakdownJson } from '@/types/database'
import { AddCandidateSlideover }  from '@/components/projects/candidates/add-candidate-slideover'
import { ViewResumeSlideover }    from '@/components/projects/candidates/view-resume-slideover'
import { GenerateSummaryModal }   from '@/components/projects/candidates/generate-summary-modal'
import { SendAssessmentModal }    from '@/components/projects/candidates/send-assessment-modal'
import { CandidatesTable }        from '@/components/projects/candidates/candidates-table'
import { BatchScoreBar }          from '@/components/projects/candidates/batch-score-bar'

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
  project:    ProjectRef
  initialCandidates: CandidateRow[]
  userId:     string
  canEdit:    boolean
  isOwner:    boolean
  isManager:  boolean
}

export function CandidatesTab({
  project, initialCandidates, userId, canEdit, isOwner, isManager,
}: Props) {
  const [candidates,     setCandidates]     = useState<CandidateRow[]>(initialCandidates)
  const [addOpen,        setAddOpen]        = useState(false)
  const [viewCandidate,  setViewCandidate]  = useState<CandidateRow | null>(null)
  const [summaryTarget,  setSummaryTarget]  = useState<CandidateRow | null>(null)
  const [assessTarget,   setAssessTarget]   = useState<CandidateRow | null>(null)
  const [summaryOpen,    setSummaryOpen]    = useState(false)
  const [assessOpen,     setAssessOpen]     = useState(false)
  const [batchState,     setBatchState]     = useState<BatchState | null>(null)
  const [confirmBatch,   setConfirmBatch]   = useState(false)
  const [scoringIds,     setScoringIds]     = useState<Set<string>>(new Set())
  const abortRef = useRef<AbortController | null>(null)

  const hasJd      = !!project.jd_text
  const unscored   = candidates.filter(c => c.cqi_score === null)
  const showBatch  = hasJd && unscored.length > 0 && !batchState?.done

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
  }

  // ── Score individual ─────────────────────────────────────────

  async function handleScoreIndividual(candidate: CandidateRow) {
    if (!hasJd) { toast.error('Add a job description to enable scoring'); return }
    setScoringIds(prev => new Set(prev).add(candidate.id))

    try {
      const res = await fetch(`/api/projects/${project.id}/candidates/${candidate.id}/score`, {
        method: 'POST',
      })
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

  // ── Red flag check ───────────────────────────────────────────

  async function handleRedFlag(candidateId: string) {
    const candidate = candidates.find(c => c.id === candidateId)
    if (!candidate) return

    try {
      const res  = await fetch(`/api/projects/${project.id}/candidates/${candidateId}/red-flag`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) { toast.error(data.error ?? 'Red flag check failed'); return }

      setCandidates(prev => prev.map(c =>
        c.id === candidateId
          ? { ...c, red_flag_score: data.integrity_score, red_flag_summary: data.summary, red_flags_json: data.flags }
          : c,
      ))

      const flagCount = data.flags?.length ?? 0
      toast.success(flagCount === 0 ? 'No red flags found' : `${flagCount} flag${flagCount === 1 ? '' : 's'} found`)
    } catch {
      toast.error('Red flag check failed')
    }
  }

  // ── Batch score ──────────────────────────────────────────────

  async function startBatchScore() {
    setConfirmBatch(false)
    setBatchState({ current: 0, total: unscored.length, failed: 0, done: false })

    abortRef.current = new AbortController()

    try {
      const res = await fetch(`/api/projects/${project.id}/candidates/batch-score`, {
        method: 'POST',
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Batch scoring failed')
        setBatchState(null)
        return
      }

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

            if (event.type === 'error') {
              setBatchState(s => s ? { ...s, current: event.current, failed: s.failed + 1 } : s)
            }

            if (event.type === 'complete') {
              setBatchState(s => s ? { ...s, current: event.total, done: true, failed: event.failed } : s)
              if (event.failed === 0) {
                toast.success('All candidates scored!')
              }
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.error('Batch scoring failed')
        setBatchState(null)
      }
    }
  }

  // ── Modal handlers ───────────────────────────────────────────

  function openSummary(c: CandidateRow) {
    setSummaryTarget(c)
    setSummaryOpen(true)
  }

  function openAssessment(c: CandidateRow) {
    setAssessTarget(c)
    setAssessOpen(true)
  }

  function handleAssessmentSent(candidateId: string, inviteId: string) {
    setCandidates(prev => prev.map(c =>
      c.id === candidateId ? { ...c, assessment_invite_id: inviteId, invite_status: 'pending' } : c,
    ))
  }

  // ─────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-200">
            {candidates.length} Candidate{candidates.length !== 1 ? 's' : ''}
          </h3>

          {/* Score all unscored */}
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

      {/* No-JD warning banner */}
      {!hasJd && candidates.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-xs text-yellow-300">
          Add a job description to enable auto-scoring. Candidates will be scored on add once a JD is present.
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

      {/* Confirm batch modal */}
      {confirmBatch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12141F] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-white">Score {unscored.length} candidates?</h3>
            <p className="text-xs text-slate-400">
              This will use {unscored.length} AI credit{unscored.length !== 1 ? 's' : ''} to score all unscored candidates against the job description.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmBatch(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={startBatchScore} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150">
                Score All ({unscored.length} credits)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidates table */}
      {candidates.length > 0 ? (
        <CandidatesTable
          candidates={candidates}
          projectId={project.id}
          userId={userId}
          canEdit={canEdit}
          isOwner={isOwner}
          isManager={isManager}
          onStatusChange={handleStatusChange}
          onScored={() => {}}
          onRedFlag={handleRedFlag}
          onRemove={handleRemove}
          onViewResume={setViewCandidate}
          onSummary={openSummary}
          onAssessment={openAssessment}
          onScoreIndividual={handleScoreIndividual}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/8 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-slate-600" />
          </div>
          <p className="text-sm font-medium text-slate-400 mb-1">No candidates yet</p>
          <p className="text-xs text-slate-600 max-w-xs mb-6">
            Add candidates to start building your pipeline and tracking scoring results.
          </p>
          {canEdit && (
            <button
              onClick={() => setAddOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
            >
              Add your first candidate
            </button>
          )}
        </div>
      )}

      {/* Slide-overs + Modals */}
      <AddCandidateSlideover
        open={addOpen}
        projectId={project.id}
        hasJd={hasJd}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
      />

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
    </div>
  )
}
