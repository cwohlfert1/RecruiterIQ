'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Linkedin, Mail, Maximize2, Minimize2, Star, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { PipelineStage } from '@/types/database'
import { CandidateNotes }         from '@/components/projects/candidate-notes'
import { CandidateTags }          from '@/components/projects/candidate-tags'
import { ClientSubmittalModal }   from '@/components/projects/candidates/client-submittal-modal'
import { FlagCandidateModal }     from '@/components/projects/flag-candidate-modal'
import { GenerateSummaryModal }   from '@/components/projects/candidates/generate-summary-modal'
import { InternalSubmittalModal } from '@/components/projects/candidates/internal-submittal-modal'
import { RejectionReasonModal }   from '@/components/projects/rejection-reason-modal'
import { SendAssessmentModal }    from '@/components/projects/candidates/send-assessment-modal'

import type { BenchmarkData, ClientIntel, Insights, ProjectRef, RedFlag } from './constants'
import { FooterActions }    from './footer-actions'
import { InsightsTab }      from './insights-tab'
import { OverviewSection }  from './overview-section'
import { StageDropdown }    from './stage-dropdown'

interface Props {
  candidate:       CandidateRow | null
  projectId:       string
  project:         ProjectRef
  userId:          string
  canEdit:         boolean
  isManager:       boolean
  onClose:         () => void
  onStageChange:   (candidateId: string, stage: PipelineStage) => void
  onTagsChange:    (candidateId: string, tags: string[]) => void
  onRemove:        (candidateId: string) => void
  onAssessmentSent?: (candidateId: string, inviteId: string) => void
  members?:        Array<{ user_id: string; role: string; email: string | null }>
}

export function CandidateSlideout({
  candidate, projectId, project, userId, canEdit, isManager,
  onClose, onStageChange, onTagsChange, onRemove, onAssessmentSent, members,
}: Props) {
  const open = !!candidate

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const [removing,        setRemoving]        = useState(false)
  const [flagging,        setFlagging]        = useState(false)
  const [flagModalOpen,   setFlagModalOpen]   = useState(false)
  const [flagType,        setFlagType]        = useState<string | null>(candidate?.flag_type ?? null)
  const [summaryOpen,     setSummaryOpen]     = useState(false)
  const [submittalOpen,   setSubmittalOpen]   = useState(false)
  const [assessOpen,      setAssessOpen]      = useState(false)
  const [clientSubOpen,   setClientSubOpen]   = useState(false)
  const [rejectionOpen,   setRejectionOpen]   = useState(false)
  const [clientIntel,     setClientIntel]     = useState<ClientIntel | null>(null)
  const [localFlags,      setLocalFlags]      = useState<RedFlag[] | null>(null)
  const [localFlagScore,  setLocalFlagScore]  = useState<number | null>(null)
  const [starred,         setStarred]         = useState(candidate?.starred ?? false)
  const [reaction,        setReaction]        = useState<string | null>(candidate?.reaction ?? null)
  const [savingReact,     setSavingReact]     = useState(false)
  const [benchmark,       setBenchmark]       = useState<BenchmarkData | null>(null)
  const [isFullscreen,    setIsFullscreen]    = useState(false)
  const [activeTab,       setActiveTab]       = useState<'overview' | 'resume' | 'notes' | 'insights'>('overview')
  const [insights,        setInsights]        = useState<Insights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  // Reset per-candidate state
  useEffect(() => {
    setStarred(candidate?.starred ?? false)
    setReaction(candidate?.reaction ?? null)
    setFlagType(candidate?.flag_type ?? null)
    setBenchmark(null)
    setLocalFlags(null)
    setLocalFlagScore(null)
    setActiveTab('overview')
    setIsFullscreen(false)
    setInsights(null)
    setInsightsLoading(false)
  }, [candidate?.id])

  // Insights lazy load
  useEffect(() => {
    if (activeTab !== 'insights' || !candidate?.cqi_score || !projectId || insightsLoading) return
    const cached = candidate.insights_json as (Insights & { _cqi_score?: number }) | null
    if (cached && cached._cqi_score === candidate.cqi_score) {
      setInsights(cached)
      return
    }
    setInsightsLoading(true)
    fetch(`/api/projects/${projectId}/candidates/${candidate.id}/insights`, { method: 'POST' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.insights) setInsights(data.insights) })
      .catch(() => {})
      .finally(() => setInsightsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, candidate?.id, candidate?.cqi_score])

  // Benchmark
  useEffect(() => {
    if (!candidate?.cqi_score || !project.title) return
    fetch('/api/benchmarks/compare', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role_title: project.title, this_cqi: candidate.cqi_score }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.benchmark) setBenchmark(data.benchmark) })
      .catch(() => null)
  }, [candidate?.id, candidate?.cqi_score, project.title])

  // Client intel
  useEffect(() => {
    if (!candidate?.cqi_score || !project.client_name) { setClientIntel(null); return }
    fetch(`/api/client-intel?client=${encodeURIComponent(project.client_name)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.intel) setClientIntel(data.intel) })
      .catch(() => null)
  }, [candidate?.id, project.client_name])

  async function handleStar() {
    if (!candidate) return
    const next = !starred
    setStarred(next)
    setSavingReact(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/candidates/${candidate.id}/react`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ starred: next }),
      })
      if (!res.ok) { setStarred(!next); toast.error('Failed to update') }
    } catch {
      setStarred(!next)
      toast.error('Failed to update')
    } finally { setSavingReact(false) }
  }

  async function handleReaction(val: 'up' | 'down') {
    if (!candidate) return
    const next = reaction === val ? null : val
    setReaction(next)
    setSavingReact(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/candidates/${candidate.id}/react`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reaction: val }),
      })
      if (!res.ok) { setReaction(reaction); toast.error('Failed to update') }
    } catch {
      setReaction(reaction)
      toast.error('Failed to update')
    } finally { setSavingReact(false) }
  }

  async function handleRemove() {
    if (!candidate) return
    if (!confirm(`Remove ${candidate.candidate_name} from this project?`)) return
    setRemoving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/candidates/${candidate.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ deleted_at: 'now' }),
      })
      if (!res.ok) { toast.error('Failed to remove candidate'); return }
      onRemove(candidate.id)
      toast.success('Candidate removed')
    } catch {
      toast.error('Failed to remove candidate')
    } finally { setRemoving(false) }
  }

  async function handleRedFlag() {
    if (!candidate) return
    setFlagging(true)
    try {
      const res  = await fetch(`/api/projects/${projectId}/candidates/${candidate.id}/red-flag`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Red flag check failed'); return }
      const count = data.flags?.length ?? 0
      setLocalFlags(data.flags ?? [])
      setLocalFlagScore(data.integrity_score ?? null)
      toast.success(count === 0 ? 'No red flags found' : `${count} flag${count !== 1 ? 's' : ''} found`)
    } catch {
      toast.error('Red flag check failed')
    } finally { setFlagging(false) }
  }

  const flags         = localFlags ?? (candidate?.red_flags_json as RedFlag[] | null)
  const flagScore     = localFlagScore ?? candidate?.red_flag_score ?? null
  const currentStage  = (candidate?.pipeline_stage ?? 'reviewing') as PipelineStage
  const tags          = (candidate?.tags_json ?? []) as string[]

  return (
    <AnimatePresence>
      {open && candidate && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={cn('fixed inset-0 z-40', isFullscreen ? 'bg-black/70' : 'bg-black/40')}
          />

          <motion.aside
            initial={isFullscreen ? { opacity: 0, scale: 0.97 } : { x: '100%' }}
            animate={isFullscreen ? { opacity: 1, scale: 1 }    : { x: 0 }}
            exit={isFullscreen   ? { opacity: 0, scale: 0.97 }  : { x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className={cn(
              'fixed bg-[#12141F] border border-white/10 z-50 flex flex-col shadow-2xl',
              isFullscreen
                ? 'inset-[5vh_5vw] rounded-2xl'
                : 'right-0 top-0 bottom-0 h-screen w-[640px] max-w-[640px] border-l rounded-none',
            )}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/8 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white truncate">
                    {candidate.candidate_name}
                    {candidate.linkedin_url && (
                      <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-block ml-1.5 align-middle" onClick={e => e.stopPropagation()}>
                        <Linkedin className="w-3.5 h-3.5 text-indigo-400 hover:text-indigo-300 transition-colors" />
                      </a>
                    )}
                  </h2>
                  {candidate.hired && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      <Crown className="w-3 h-3" />
                      Hired
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{candidate.candidate_email}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <StageDropdown
                    candidateId={candidate.id}
                    projectId={projectId}
                    stage={currentStage}
                    canEdit={canEdit}
                    onChange={s => onStageChange(candidate.id, s)}
                    onSubmittalPrompt={type => {
                      if (type === 'internal') setSubmittalOpen(true)
                      else setClientSubOpen(true)
                    }}
                    onRejected={() => setRejectionOpen(true)}
                    onPlacedOutcome={() => {
                      fetch(`/api/projects/${projectId}/candidates/${candidate.id}/outcome`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ outcome: 'placed' }),
                      }).catch((err: unknown) => console.error('[slideout] placed outcome error:', err))
                    }}
                  />
                  {(candidate.pay_rate_min != null || candidate.pay_rate_max != null) && (
                    <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full tabular-nums">
                      {candidate.pay_rate_min != null && candidate.pay_rate_max != null
                        ? `$${candidate.pay_rate_min}–$${candidate.pay_rate_max}`
                        : candidate.pay_rate_min != null
                          ? `$${candidate.pay_rate_min}+`
                          : `up to $${candidate.pay_rate_max}`}
                      /{candidate.pay_rate_type === 'annual' ? 'yr' : 'hr'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-2.5">
                  <button
                    onClick={handleStar}
                    disabled={savingReact}
                    title={starred ? 'Unstar' : 'Star candidate'}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors disabled:opacity-50',
                      starred
                        ? 'text-amber-400 bg-amber-500/15 border-amber-500/25'
                        : 'text-slate-500 bg-white/5 border-white/10 hover:text-amber-400 hover:border-amber-500/25'
                    )}
                  >
                    <Star className="w-3.5 h-3.5" fill={starred ? 'currentColor' : 'none'} />
                    <span>{starred ? 'Starred' : 'Star'}</span>
                  </button>
                  <button
                    onClick={() => handleReaction('up')}
                    disabled={savingReact}
                    title="Thumbs up"
                    className={cn(
                      'px-2 py-1 rounded-lg text-xs border transition-colors disabled:opacity-50',
                      reaction === 'up'
                        ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25'
                        : 'text-slate-500 bg-white/5 border-white/10 hover:text-emerald-400 hover:border-emerald-500/25'
                    )}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" fill={reaction === 'up' ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => handleReaction('down')}
                    disabled={savingReact}
                    title="Thumbs down"
                    className={cn(
                      'px-2 py-1 rounded-lg text-xs border transition-colors disabled:opacity-50',
                      reaction === 'down'
                        ? 'text-rose-400 bg-rose-500/15 border-rose-500/25'
                        : 'text-slate-500 bg-white/5 border-white/10 hover:text-rose-400 hover:border-rose-500/25'
                    )}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" fill={reaction === 'down' ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setIsFullscreen(v => !v)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors"
                  title={isFullscreen ? 'Collapse' : 'Expand'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/8 px-5">
              {(['overview', 'resume', 'notes', ...(candidate.cqi_score ? ['insights' as const] : [])] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-3 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize -mb-px',
                    activeTab === tab
                      ? 'border-indigo-500 text-white'
                      : 'border-transparent text-slate-500 hover:text-slate-300',
                  )}
                >
                  {tab === 'overview' ? 'Overview' : tab === 'resume' ? 'Resume' : tab === 'notes' ? 'Notes' : 'Insights'}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className={cn(
              'flex-1 overflow-y-auto px-5 py-4',
              isFullscreen ? 'grid grid-cols-2 gap-6' : 'space-y-5',
            )}>
              {(activeTab === 'overview' || isFullscreen) && (
                <div className="space-y-5">
                  <OverviewSection
                    candidate={candidate}
                    project={project}
                    benchmark={benchmark}
                    clientIntel={clientIntel}
                    flags={flags}
                    flagScore={flagScore}
                    flagging={flagging}
                    onRunFlagCheck={handleRedFlag}
                  />
                  {!isFullscreen && (
                    <section>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Tags</p>
                      <CandidateTags
                        candidateId={candidate.id}
                        projectId={projectId}
                        initialTags={tags}
                        canEdit={canEdit}
                        onTagsChange={t => onTagsChange(candidate.id, t)}
                      />
                    </section>
                  )}
                </div>
              )}

              {(activeTab === 'resume' || isFullscreen) && (
                <div className="space-y-3">
                  {isFullscreen && (
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Resume</p>
                  )}
                  <pre className="whitespace-pre-wrap text-xs text-slate-400 font-sans leading-relaxed bg-white/3 border border-white/8 rounded-xl p-3 h-full min-h-[300px] overflow-y-auto">
                    {candidate.resume_text || 'No resume text available.'}
                  </pre>
                </div>
              )}

              {activeTab === 'notes' && !isFullscreen && (
                <div className="space-y-3">
                  <CandidateNotes
                    candidateId={candidate.id}
                    projectId={projectId}
                    userId={userId}
                    canEdit={canEdit}
                    members={members}
                  />
                </div>
              )}

              {activeTab === 'insights' && !isFullscreen && (
                <InsightsTab
                  insights={insights}
                  loading={insightsLoading}
                  hasCqiScore={!!candidate.cqi_score}
                />
              )}
            </div>

            <FooterActions
              candidate={candidate}
              projectId={projectId}
              canEdit={canEdit}
              isManager={isManager}
              flagType={flagType}
              removing={removing}
              onOpenAssess={() => setAssessOpen(true)}
              onOpenSummary={() => setSummaryOpen(true)}
              onOpenSubmittal={() => setSubmittalOpen(true)}
              onOpenFlagModal={() => setFlagModalOpen(true)}
              onRemove={handleRemove}
            />

            <GenerateSummaryModal open={summaryOpen} candidate={candidate} project={project} onClose={() => setSummaryOpen(false)} />

            <InternalSubmittalModal
              open={submittalOpen}
              candidate={candidate}
              project={project}
              onClose={() => setSubmittalOpen(false)}
              onStageMove={id => onStageChange(id, 'internal_submittal')}
            />

            <SendAssessmentModal
              open={assessOpen}
              candidate={candidate}
              project={project}
              onClose={() => setAssessOpen(false)}
              onSent={(cId, invId) => { setAssessOpen(false); onAssessmentSent?.(cId, invId) }}
            />

            <RejectionReasonModal
              open={rejectionOpen}
              candidateName={candidate.candidate_name}
              candidateId={candidate.id}
              projectId={projectId}
              onClose={() => setRejectionOpen(false)}
              onSaved={() => setRejectionOpen(false)}
            />

            <ClientSubmittalModal open={clientSubOpen} candidate={candidate} project={project} onClose={() => setClientSubOpen(false)} />

            <FlagCandidateModal
              isOpen={flagModalOpen}
              candidateId={candidate.id}
              candidateName={candidate.candidate_name}
              candidateEmail={candidate.candidate_email}
              projectId={projectId}
              onClose={() => setFlagModalOpen(false)}
              onFlagged={ft => setFlagType(ft)}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
