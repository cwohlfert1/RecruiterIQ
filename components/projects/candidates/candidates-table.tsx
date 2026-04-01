'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Trophy, Medal, Eye, FileText, Flag, Send, Trash2, Loader2, Star } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { CandidateStatus } from '@/types/database'

const STATUS_OPTIONS: CandidateStatus[] = ['reviewing', 'screening', 'submitted', 'rejected']

const STATUS_LABEL: Record<CandidateStatus, string> = {
  reviewing: 'Reviewing',
  screening: 'Screening',
  submitted: 'Submitted',
  rejected:  'Rejected',
}

const STATUS_CLASS: Record<CandidateStatus, string> = {
  reviewing: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  screening: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  submitted: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  rejected:  'bg-red-500/15 text-red-400 border-red-500/20',
}

// ─── CQI Badge ────────────────────────────────────────────────

function CqiBadge({ score }: { score: number }) {
  const cls =
    score >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' :
    score >= 60 ? 'text-yellow-400  bg-yellow-500/10  border-yellow-500/25'  :
                  'text-red-400     bg-red-500/10      border-red-500/25'

  return (
    <span className={cn('text-sm font-bold px-2 py-0.5 rounded-full border tabular-nums', cls)}>
      {score}
    </span>
  )
}

// ─── Rank cell ────────────────────────────────────────────────

function RankCell({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="text-slate-600 text-sm">—</span>
  if (rank === 1) return <span title="#1"><Trophy className="w-4 h-4 text-yellow-400" /></span>
  if (rank === 2) return <span title="#2"><Medal  className="w-4 h-4 text-slate-400"  /></span>
  if (rank === 3) return <span title="#3"><Medal  className="w-4 h-4 text-amber-700"  /></span>
  return <span className="text-slate-500 text-sm tabular-nums">#{rank}</span>
}

// ─── Status Dropdown ──────────────────────────────────────────

function StatusDropdown({
  candidateId,
  projectId,
  status,
  onChange,
}: {
  candidateId: string
  projectId:   string
  status:      CandidateStatus
  onChange:    (next: CandidateStatus) => void
}) {
  const [open,   setOpen]    = useState(false)
  const [saving, setSaving]  = useState(false)
  const ref                  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function pick(next: CandidateStatus) {
    if (next === status) { setOpen(false); return }
    setOpen(false); setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/candidates/${candidateId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: next }),
      })
      if (!res.ok) { toast.error('Failed to update status'); return }
      onChange(next)
    } catch {
      toast.error('Failed to update status')
    } finally { setSaving(false) }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors hover:opacity-80', STATUS_CLASS[status])}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin inline" /> : STATUS_LABEL[status]}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-32 bg-[#1A1D2E] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => pick(s)}
              className={cn('w-full text-left px-3 py-2 text-xs transition-colors', s === status ? 'opacity-40 cursor-default' : 'hover:bg-white/5', STATUS_CLASS[s].split(' ')[1])}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Actions Menu ─────────────────────────────────────────────

function ActionsMenu({
  candidate,
  projectId,
  isOwner,
  isManager,
  onView,
  onSummary,
  onAssessment,
  onScore,
  onRedFlag,
  onRemove,
}: {
  candidate:    CandidateRow
  projectId:    string
  isOwner:      boolean
  isManager:    boolean
  onView:       () => void
  onSummary:    () => void
  onAssessment: () => void
  onScore:      () => void
  onRedFlag:    () => void
  onRemove:     () => void
}) {
  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const items = [
    { icon: Eye,      label: 'View Resume',        action: onView,        always: true  },
    { icon: Star,     label: 'Score',              action: onScore,       always: candidate.cqi_score === null },
    { icon: Flag,     label: 'Check Red Flags',    action: onRedFlag,     always: true  },
    { icon: FileText, label: 'Generate Summary',   action: onSummary,     always: true  },
    { icon: Send,     label: 'Send Assessment',    action: onAssessment,  always: isManager && !candidate.assessment_invite_id },
    { icon: Trash2,   label: 'Remove',             action: onRemove,      always: isOwner, danger: true },
  ].filter(i => i.always)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-[#1A1D2E] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
          {items.map(({ icon: Icon, label, action, danger }) => (
            <button
              key={label}
              onClick={() => { action(); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-2.5 text-xs flex items-center gap-2 transition-colors',
                danger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Table ───────────────────────────────────────────────

interface Props {
  candidates:   CandidateRow[]
  projectId:    string
  userId:       string
  canEdit:      boolean
  isOwner:      boolean
  isManager:    boolean
  onStatusChange: (id: string, status: CandidateStatus) => void
  onScored:     (id: string, score: number) => void
  onRedFlag:    (id: string) => void
  onRemove:     (id: string) => void
  onViewResume: (candidate: CandidateRow) => void
  onSummary:    (candidate: CandidateRow) => void
  onAssessment: (candidate: CandidateRow) => void
  onScoreIndividual: (candidate: CandidateRow) => void
}

export function CandidatesTable({
  candidates, projectId, userId, canEdit, isOwner, isManager,
  onStatusChange, onRemove, onViewResume, onSummary, onAssessment, onScoreIndividual, onRedFlag,
}: Props) {

  // Compute ranks by CQI (scored candidates only, descending)
  const ranks: Record<string, number | null> = {}
  const scored = [...candidates].filter(c => c.cqi_score !== null).sort((a, b) => (b.cqi_score ?? 0) - (a.cqi_score ?? 0))
  scored.forEach((c, i) => { ranks[c.id] = i + 1 })
  candidates.filter(c => c.cqi_score === null).forEach(c => { ranks[c.id] = null })

  async function handleRemove(candidate: CandidateRow) {
    const confirmed = confirm(`Remove ${candidate.candidate_name} from this project?`)
    if (!confirmed) return

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
    }
  }

  if (candidates.length === 0) return null

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse min-w-[720px]">
        <thead>
          <tr className="border-b border-white/8">
            {['Rank', 'Name', 'CQI', 'Red Flags', 'Assessment', 'Status', 'Actions'].map(h => (
              <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500 pb-3 pr-4 first:pl-1">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {candidates.map(c => {
            const highFlags = (c.red_flags_json as Array<{ severity: string }> | null)?.filter(f => f.severity === 'high') ?? []
            const medFlags  = (c.red_flags_json as Array<{ severity: string }> | null)?.filter(f => f.severity === 'medium') ?? []
            const hasFlags  = c.red_flag_score !== null

            return (
              <tr key={c.id} className="hover:bg-white/2 transition-colors group">
                {/* Rank */}
                <td className="py-3 pr-4 pl-1 w-10">
                  <RankCell rank={ranks[c.id] ?? null} />
                </td>

                {/* Name + email */}
                <td className="py-3 pr-4">
                  <button
                    onClick={() => onViewResume(c)}
                    className="text-left group/name"
                  >
                    <p className="font-medium text-white group-hover/name:text-indigo-300 transition-colors">{c.candidate_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.candidate_email}</p>
                  </button>
                </td>

                {/* CQI */}
                <td className="py-3 pr-4 w-24">
                  {c.cqi_score !== null ? (
                    <CqiBadge score={c.cqi_score} />
                  ) : (
                    <button
                      onClick={() => onScoreIndividual(c)}
                      className="text-xs text-indigo-400 hover:text-indigo-200 transition-colors"
                    >
                      Score
                    </button>
                  )}
                </td>

                {/* Red Flags */}
                <td className="py-3 pr-4 w-28">
                  {hasFlags ? (
                    <div className="flex items-center gap-1.5">
                      {highFlags.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                          {highFlags.length}
                        </span>
                      )}
                      {medFlags.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
                          <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
                          {medFlags.length}
                        </span>
                      )}
                      {highFlags.length === 0 && medFlags.length === 0 && (
                        <span className="text-xs text-emerald-400">Clean</span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => onRedFlag(c.id)}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Check
                    </button>
                  )}
                </td>

                {/* Assessment */}
                <td className="py-3 pr-4 w-36">
                  {c.invite_status === 'completed' ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-medium text-emerald-400">
                        Trust: {c.trust_score ?? '—'}
                      </span>
                      <span className="text-[11px] font-medium text-indigo-400">
                        Skill: {c.skill_score ?? '—'}
                      </span>
                    </div>
                  ) : c.invite_status === 'pending' ? (
                    <span className="text-[11px] font-semibold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                      Pending
                    </span>
                  ) : (
                    isManager ? (
                      <button
                        onClick={() => onAssessment(c)}
                        className="text-xs text-indigo-400 hover:text-indigo-200 transition-colors"
                      >
                        Send
                      </button>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )
                  )}
                </td>

                {/* Status */}
                <td className="py-3 pr-4 w-28">
                  {canEdit ? (
                    <StatusDropdown
                      candidateId={c.id}
                      projectId={projectId}
                      status={c.status as CandidateStatus}
                      onChange={next => onStatusChange(c.id, next)}
                    />
                  ) : (
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', STATUS_CLASS[c.status as CandidateStatus])}>
                      {STATUS_LABEL[c.status as CandidateStatus]}
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className="py-3 pl-1 w-10">
                  <ActionsMenu
                    candidate={c}
                    projectId={projectId}
                    isOwner={isOwner}
                    isManager={isManager}
                    onView={() => onViewResume(c)}
                    onSummary={() => onSummary(c)}
                    onAssessment={() => onAssessment(c)}
                    onScore={() => onScoreIndividual(c)}
                    onRedFlag={() => onRedFlag(c.id)}
                    onRemove={() => handleRemove(c)}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
