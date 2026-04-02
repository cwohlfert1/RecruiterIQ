'use client'

import { useState, useEffect } from 'react'
import { X, Mail, Loader2, Trash2, FileText, Send, Sparkles, Star, ThumbsUp, ThumbsDown, Crown, AlertOctagon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { PipelineStage, BreakdownJson } from '@/types/database'
import { CandidateTags }        from '@/components/projects/candidate-tags'
import { CandidateNotes }       from '@/components/projects/candidate-notes'
import { FlagCandidateModal }   from '@/components/projects/flag-candidate-modal'
import { GenerateSummaryModal } from '@/components/projects/candidates/generate-summary-modal'

// ─── Types ────────────────────────────────────────────────────

interface ProjectRef {
  id:          string
  title:       string
  client_name: string
  jd_text:     string | null
  owner_id:    string
}

interface BenchmarkData {
  role_title:  string
  hired_name:  string | null
  cqi_score:   number
  hired_at:    string | null
  this_cqi:    number
}

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
  members?:        Array<{ user_id: string; role: string; email: string | null }>
}

// ─── Pipeline stage options ────────────────────────────────────

const STAGES: Array<{ key: PipelineStage; label: string }> = [
  { key: 'sourced',         label: 'Sourced'         },
  { key: 'contacted',       label: 'Contacted'       },
  { key: 'phone_screen',    label: 'Phone Screen'    },
  { key: 'am_review',       label: 'AM Review'       },
  { key: 'assessment_sent', label: 'Assessment Sent' },
  { key: 'submitted',       label: 'Submitted'       },
  { key: 'placed',          label: 'Placed'          },
  { key: 'rejected',        label: 'Rejected'        },
]

// ─── CQI ring ────────────────────────────────────────────────

function CqiRing({ score }: { score: number }) {
  const radius      = 28
  const circumference = 2 * Math.PI * radius
  const dash          = (score / 100) * circumference
  const color =
    score >= 80 ? '#10b981' :
    score >= 60 ? '#f59e0b' :
                  '#ef4444'
  return (
    <div className="flex items-center gap-3">
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        <circle cx="36" cy="36" r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
        <circle
          cx="36" cy="36" r={radius}
          stroke={color} strokeWidth="6" fill="none"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div>
        <p className="text-2xl font-bold text-white">{score}</p>
        <p className="text-xs text-slate-500">CQI Score</p>
      </div>
    </div>
  )
}

const BREAKDOWN_CATEGORIES: Array<{ key: keyof BreakdownJson; label: string }> = [
  { key: 'must_have_skills',  label: 'Must-Have Skills'  },
  { key: 'domain_experience', label: 'Domain Experience' },
  { key: 'communication',     label: 'Communication'     },
  { key: 'tenure_stability',  label: 'Tenure Stability'  },
  { key: 'tool_depth',        label: 'Tool Depth'        },
]

function BreakdownBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300 font-medium">
          {score} <span className="text-slate-600">({Math.round(weight * 100)}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

// ─── Stage dropdown ───────────────────────────────────────────

function StageDropdown({
  candidateId,
  projectId,
  stage,
  canEdit,
  onChange,
}: {
  candidateId: string
  projectId:   string
  stage:       PipelineStage
  canEdit:     boolean
  onChange:    (s: PipelineStage) => void
}) {
  const [saving, setSaving] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as PipelineStage
    if (next === stage) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/candidates/${candidateId}/stage`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stage: next }),
      })
      if (!res.ok) { toast.error('Failed to update stage'); return }
      onChange(next)
      toast.success(`Moved to ${STAGES.find(s => s.key === next)?.label}`)
    } catch {
      toast.error('Failed to update stage')
    } finally { setSaving(false) }
  }

  if (!canEdit) {
    const label = STAGES.find(s => s.key === stage)?.label ?? stage
    return (
      <span className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
        {label}
      </span>
    )
  }

  return (
    <div className="relative flex items-center gap-1">
      {saving && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />}
      <select
        value={stage}
        onChange={handleChange}
        disabled={saving}
        className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
      >
        {STAGES.map(s => (
          <option key={s.key} value={s.key} className="bg-[#1A1D2E] text-white">
            {s.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

export function CandidateSlideout({
  candidate,
  projectId,
  project,
  userId,
  canEdit,
  isManager,
  onClose,
  onStageChange,
  onTagsChange,
  onRemove,
  members,
}: Props) {
  const open = !!candidate

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const [removing,      setRemoving]      = useState(false)
  const [flagging,      setFlagging]      = useState(false)
  const [flagModalOpen, setFlagModalOpen] = useState(false)
  const [flagType,      setFlagType]      = useState<string | null>(candidate?.flag_type ?? null)
  const [summaryOpen,   setSummaryOpen]   = useState(false)
  const [localFlags,    setLocalFlags]    = useState<Array<{ type: string; severity: string; evidence: string; explanation: string }> | null>(null)
  const [localFlagScore, setLocalFlagScore] = useState<number | null>(null)
  const [starred,     setStarred]     = useState(candidate?.starred ?? false)
  const [reaction,    setReaction]    = useState<string | null>(candidate?.reaction ?? null)
  const [savingReact, setSavingReact] = useState(false)
  const [benchmark,   setBenchmark]   = useState<BenchmarkData | null>(null)

  // Sync star/reaction/flag state when candidate changes
  useEffect(() => {
    setStarred(candidate?.starred ?? false)
    setReaction(candidate?.reaction ?? null)
    setFlagType(candidate?.flag_type ?? null)
    setBenchmark(null)
    setLocalFlags(null)
    setLocalFlagScore(null)
  }, [candidate?.id])

  // Fetch benchmark comparison when candidate has a CQI score
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
    // Optimistic toggle: same reaction clears it
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

  const breakdown     = candidate?.cqi_breakdown_json as BreakdownJson | null
  const flags         = localFlags ?? (candidate?.red_flags_json as Array<{ type: string; severity: string; evidence: string; explanation: string }> | null)
  const flagScore     = localFlagScore ?? candidate?.red_flag_score ?? null
  const currentStage  = (candidate?.pipeline_stage ?? 'sourced') as PipelineStage
  const tags         = (candidate?.tags_json ?? []) as string[]

  return (
    <AnimatePresence>
      {open && candidate && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] bg-[#12141F] border-l border-white/10 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/8 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white truncate">{candidate.candidate_name}</h2>
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
                <div className="mt-2">
                  <StageDropdown
                    candidateId={candidate.id}
                    projectId={projectId}
                    stage={currentStage}
                    canEdit={canEdit}
                    onChange={s => onStageChange(candidate.id, s)}
                  />
                </div>
                {/* Star + reaction row */}
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
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* CQI Score */}
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">CQI Score</p>
                {candidate.cqi_score !== null ? (
                  <>
                    <CqiRing score={candidate.cqi_score} />
                    {breakdown && (
                      <div className="mt-3 space-y-2.5">
                        {BREAKDOWN_CATEGORIES.map(cat => (
                          <BreakdownBar
                            key={cat.key}
                            label={cat.label}
                            score={breakdown[cat.key].score}
                            weight={breakdown[cat.key].weight}
                          />
                        ))}
                      </div>
                    )}
                    {/* Benchmark comparison card */}
                    {benchmark && (
                      <div className="mt-4 rounded-xl p-3 border border-indigo-500/20 bg-indigo-500/5">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-2">Benchmark Comparison</p>
                        <p className="text-xs text-slate-400 mb-2.5">
                          Similar role: <span className="text-slate-200 font-medium">{benchmark.role_title}</span>
                          {benchmark.hired_name && (
                            <span className="text-slate-500"> · Hired: {benchmark.hired_name.split(' ')[0]}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <p className="text-[10px] text-slate-500 mb-0.5">Benchmark CQI</p>
                            <p className={cn('text-xl font-bold tabular-nums',
                              benchmark.cqi_score >= 80 ? 'text-emerald-400' :
                              benchmark.cqi_score >= 60 ? 'text-yellow-400' : 'text-red-400'
                            )}>
                              {benchmark.cqi_score}
                            </p>
                          </div>
                          <div className="text-slate-600 text-base">→</div>
                          <div className="text-center">
                            <p className="text-[10px] text-slate-500 mb-0.5">This Candidate</p>
                            <p className={cn('text-xl font-bold tabular-nums',
                              candidate.cqi_score >= 80 ? 'text-emerald-400' :
                              candidate.cqi_score >= 60 ? 'text-yellow-400' : 'text-red-400'
                            )}>
                              {candidate.cqi_score}
                            </p>
                          </div>
                          <div className="ml-auto text-xs font-medium">
                            {candidate.cqi_score >= benchmark.cqi_score
                              ? <span className="text-emerald-400">↑ Above</span>
                              : <span className="text-rose-400">↓ Below</span>
                            }
                          </div>
                        </div>
                        {benchmark.hired_at && (
                          <p className="text-[10px] text-slate-600 mt-2">
                            Hired {new Date(benchmark.hired_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-slate-500 bg-white/4 border border-white/8 rounded-xl p-3">
                    Not scored yet
                  </div>
                )}
              </section>

              {/* Red Flags */}
              {flagScore !== null && (
                <section>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Red Flags</p>
                  {flags && flags.length > 0 ? (
                    <div className="space-y-2">
                      {flags.map((flag, i) => (
                        <div key={i} className="px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                              flag.severity === 'high'   ? 'bg-red-500/20 text-red-400' :
                              flag.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                            'bg-slate-500/20 text-slate-400'
                            )}>
                              {flag.severity}
                            </span>
                            <span className="text-xs font-medium text-slate-300">{flag.type}</span>
                          </div>
                          <p className="text-xs text-slate-500">{flag.explanation}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                      No red flags found
                    </div>
                  )}
                </section>
              )}

              {/* Assessment Results */}
              {candidate.invite_status === 'completed' && (
                <section>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Assessment Results</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/4 border border-white/8 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">Trust Score</p>
                      <p className="text-xl font-bold text-emerald-400">{candidate.trust_score ?? '—'}</p>
                    </div>
                    <div className="bg-white/4 border border-white/8 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">Skill Score</p>
                      <p className="text-xl font-bold text-indigo-400">{candidate.skill_score ?? '—'}</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Resume */}
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Resume</p>
                <pre className="whitespace-pre-wrap text-xs text-slate-400 font-sans leading-relaxed bg-white/3 border border-white/8 rounded-xl p-3 max-h-48 overflow-y-auto">
                  {candidate.resume_text}
                </pre>
              </section>

              {/* Tags */}
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Tags</p>
                <CandidateTags
                  candidateId={candidate.id}
                  projectId={projectId}
                  initialTags={tags}
                  canEdit={canEdit}
                  onTagsChange={tags => onTagsChange(candidate.id, tags)}
                />
              </section>

              {/* Notes */}
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Notes</p>
                <CandidateNotes
                  candidateId={candidate.id}
                  projectId={projectId}
                  userId={userId}
                  canEdit={canEdit}
                  members={members}
                />
              </section>
            </div>

            {/* Footer actions */}
            <div className="px-5 py-4 border-t border-white/8 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {isManager && !candidate.assessment_invite_id && (
                  <button
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
                    onClick={() => toast.info('Open Send Assessment from Candidates tab')}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Assessment
                  </button>
                )}
                <button
                  onClick={handleRedFlag}
                  disabled={flagging}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
                >
                  {flagging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Red Flags
                </button>
                <button
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                  onClick={() => setSummaryOpen(true)}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Summary
                </button>
                <button
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 bg-white/5 border border-white/10 hover:bg-white/8 transition-colors"
                  onClick={async () => {
                    if (candidate.resume_file_url) {
                      // Download original file via signed URL
                      const res = await fetch(`/api/projects/${projectId}/candidates/${candidate.id}/resume`)
                      if (res.ok) {
                        const { url } = await res.json()
                        const a = document.createElement('a')
                        a.href = url
                        a.target = '_blank'
                        a.click()
                        return
                      }
                    }
                    // Fallback: download extracted text as .txt
                    if (!candidate.resume_text) return
                    const blob = new Blob([candidate.resume_text], { type: 'text/plain' })
                    const url  = URL.createObjectURL(blob)
                    const a    = document.createElement('a')
                    a.href     = url
                    a.download = `${candidate.candidate_name.replace(/\s+/g, '_')}_resume.txt`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Resume
                </button>
              </div>

              {/* Flag Candidate button */}
              <button
                onClick={() => setFlagModalOpen(true)}
                className={cn(
                  'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors',
                  flagType
                    ? 'text-rose-300 bg-rose-500/15 border-rose-500/30 hover:bg-rose-500/20'
                    : 'text-rose-400 bg-transparent border-rose-500/30 hover:bg-rose-500/10'
                )}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                {flagType ? `Flagged: ${flagType.toUpperCase()}` : 'Flag Candidate'}
              </button>

              {canEdit && (
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Remove from Project
                </button>
              )}
            </div>

            {/* Generate Summary modal */}
            <GenerateSummaryModal
              open={summaryOpen}
              candidate={candidate}
              project={project}
              onClose={() => setSummaryOpen(false)}
            />

            {/* Flag candidate modal */}
            {candidate && (
              <FlagCandidateModal
                isOpen={flagModalOpen}
                candidateId={candidate.id}
                candidateName={candidate.candidate_name}
                candidateEmail={candidate.candidate_email}
                projectId={projectId}
                onClose={() => setFlagModalOpen(false)}
                onFlagged={ft => setFlagType(ft)}
              />
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
