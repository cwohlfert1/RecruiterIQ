'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreHorizontal, Trophy, Medal, Eye, FileText, Flag, Send, Trash2, Loader2, Star, Crown, GitCompare } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { CandidateStatus, BreakdownJson, RedFlag } from '@/types/database'

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

const BREAKDOWN_CATS: Array<{ key: keyof BreakdownJson; label: string; inverted?: boolean }> = [
  { key: 'technical_fit',     label: 'Technical Fit'    },
  { key: 'domain_experience', label: 'Domain Experience' },
  { key: 'scope_impact',      label: 'Scope & Impact'   },
  { key: 'communication',     label: 'Communication'    },
  { key: 'catfish_risk',      label: 'Red Flag Risk',   inverted: true },
]

// ─── Tooltip engine ───────────────────────────────────────────
// Uses fixed positioning to escape table overflow clipping.
// Smart above/below: shows above when near bottom of viewport.

interface TooltipRect {
  x:      number   // center x of the badge
  top:    number   // badge top  (viewport-relative)
  bottom: number   // badge bottom (viewport-relative)
}

function useTooltip(delay = 200) {
  const [rect,   setRect]   = useState<TooltipRect | null>(null)
  const timerRef            = useRef<ReturnType<typeof setTimeout> | null>(null)

  function show(e: React.MouseEvent) {
    if (timerRef.current) clearTimeout(timerRef.current)
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setRect({ x: r.left + r.width / 2, top: r.top, bottom: r.bottom })
  }

  function hide() {
    timerRef.current = setTimeout(() => setRect(null), delay)
  }

  function keepOpen() {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  return { rect, show, hide, keepOpen }
}

function tooltipPos(rect: TooltipRect, tooltipH: number, tooltipW = 280) {
  const GAP = 8
  const spaceBelow = window.innerHeight - rect.bottom
  const showBelow  = spaceBelow >= tooltipH + GAP

  const rawTop = showBelow ? rect.bottom + GAP : rect.top - tooltipH - GAP
  // Clamp to viewport so tooltip never overflows top or bottom
  const top  = Math.max(GAP, Math.min(rawTop, window.innerHeight - tooltipH - GAP))
  const left = Math.max(GAP, Math.min(rect.x - tooltipW / 2, window.innerWidth - tooltipW - GAP))
  const arrowLeft = Math.max(8, Math.min(rect.x - left - 5, tooltipW - 18))

  return { top, left, showBelow, arrowLeft }
}

// ─── CQI Tooltip ──────────────────────────────────────────────

function CqiTooltip({
  candidate,
  rect,
  onMouseEnter,
  onMouseLeave,
}: {
  candidate:    CandidateRow
  rect:         TooltipRect
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const breakdown = candidate.cqi_breakdown_json as BreakdownJson | null
  if (!breakdown) return null

  const summary  = BREAKDOWN_CATS.map(c => breakdown[c.key]?.explanation).find(Boolean)
  const TOOLTIP_H = summary ? 220 : 175
  const { top, left, showBelow, arrowLeft } = tooltipPos(rect, TOOLTIP_H)

  return (
    <motion.div
      initial={{ opacity: 0, y: showBelow ? -4 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{   opacity: 0, y: showBelow ? -4 : 4 }}
      transition={{ duration: 0.14 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: 'fixed', left, top, width: 280, zIndex: 9999 }}
      className="bg-[#12141F] border border-white/12 rounded-xl shadow-2xl p-3 pointer-events-auto"
    >
      {/* Arrow — above badge = bottom arrow, below badge = top arrow */}
      {showBelow ? (
        <div style={{ position: 'absolute', top: -5, left: arrowLeft, width: 10, height: 10 }}
          className="bg-[#12141F] border-t border-l border-white/12 rotate-45" />
      ) : (
        <div style={{ position: 'absolute', bottom: -5, left: arrowLeft, width: 10, height: 10 }}
          className="bg-[#12141F] border-b border-r border-white/12 rotate-45" />
      )}

      <p className="text-xs font-semibold text-white mb-0.5 truncate">{candidate.candidate_name}</p>
      <p className="text-[10px] text-slate-500 mb-2.5">CQI breakdown:</p>

      <div className="space-y-1.5">
        {BREAKDOWN_CATS.map(({ key, label, inverted }) => {
          const cat   = breakdown[key]
          if (!cat) return null
          const displayScore = inverted ? 100 - cat.score : cat.score
          const color = displayScore >= 80 ? 'bg-emerald-500' : displayScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
          return (
            <div key={key}>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-300 font-medium tabular-nums">{displayScore}/100</span>
              </div>
              <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', color)} style={{ width: `${displayScore}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {summary && (
        <p className="text-[10px] text-slate-500 leading-relaxed mt-2.5 border-t border-white/8 pt-2">
          {summary}
        </p>
      )}
    </motion.div>
  )
}

// ─── Red Flag Tooltip ──────────────────────────────────────────

function RedFlagTooltip({
  candidate,
  rect,
  onMouseEnter,
  onMouseLeave,
}: {
  candidate:    CandidateRow
  rect:         TooltipRect
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const flags  = candidate.red_flags_json as RedFlag[] | null
  const hasRun = candidate.red_flag_score !== null

  const flagCount = flags?.length ?? 0
  const TOOLTIP_H = hasRun && flagCount > 0 ? Math.min(280, 80 + flagCount * 55) : 70
  const { top, left, showBelow, arrowLeft } = tooltipPos(rect, TOOLTIP_H)

  const SEVERITY_COLOR: Record<string, string> = { high: 'bg-red-500', medium: 'bg-yellow-500', low: 'bg-emerald-500' }

  return (
    <motion.div
      initial={{ opacity: 0, y: showBelow ? -4 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{   opacity: 0, y: showBelow ? -4 : 4 }}
      transition={{ duration: 0.14 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: 'fixed', left, top, width: 280, zIndex: 9999 }}
      className="bg-[#12141F] border border-white/12 rounded-xl shadow-2xl p-3 pointer-events-auto"
    >
      {showBelow ? (
        <div style={{ position: 'absolute', top: -5, left: arrowLeft, width: 10, height: 10 }}
          className="bg-[#12141F] border-t border-l border-white/12 rotate-45" />
      ) : (
        <div style={{ position: 'absolute', bottom: -5, left: arrowLeft, width: 10, height: 10 }}
          className="bg-[#12141F] border-b border-r border-white/12 rotate-45" />
      )}

      {!hasRun ? (
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Red flag check not run yet. Click <span className="text-indigo-400">Check</span> to analyze this resume.
        </p>
      ) : flags && flags.length > 0 ? (
        <>
          <p className="text-[10px] font-semibold text-slate-300 mb-2">
            {flags.length} flag{flags.length !== 1 ? 's' : ''} detected:
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {flags.map((f, i) => (
              <div key={i} className="flex gap-2 text-[10px]">
                <span className={cn('w-2 h-2 rounded-full mt-0.5 flex-shrink-0', SEVERITY_COLOR[f.severity] ?? 'bg-slate-500')} />
                <div>
                  <p className="font-medium text-slate-300">{f.severity.toUpperCase()} — {f.type}</p>
                  {f.evidence && <p className="text-slate-500 mt-0.5 leading-relaxed">&ldquo;{f.evidence}&rdquo;</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-white/8">
            <span className="text-[10px] text-slate-500">
              Integrity: <span className="text-slate-300 font-medium">{candidate.red_flag_score}/100</span>
            </span>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-emerald-400">No red flags detected — resume looks clean.</p>
      )}
    </motion.div>
  )
}

// ─── CQI Badge with Tooltip ───────────────────────────────────

function CqiBadgeWithTooltip({ candidate }: { candidate: CandidateRow }) {
  const score = candidate.cqi_score!
  const cls   =
    score >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' :
    score >= 60 ? 'text-yellow-400  bg-yellow-500/10  border-yellow-500/25'  :
                  'text-red-400     bg-red-500/10      border-red-500/25'

  const { rect, show, hide, keepOpen } = useTooltip()

  return (
    <>
      <span
        onMouseEnter={show}
        onMouseLeave={hide}
        className={cn('text-sm font-bold px-2 py-0.5 rounded-full border tabular-nums cursor-default select-none', cls)}
      >
        {score}
      </span>
      {rect && createPortal(
        <AnimatePresence>
          <CqiTooltip
            candidate={candidate}
            rect={rect}
            onMouseEnter={keepOpen}
            onMouseLeave={hide}
          />
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

// ─── Red Flag Cell with Tooltip ───────────────────────────────

function RedFlagCellWithTooltip({
  candidate,
  onCheck,
}: {
  candidate: CandidateRow
  onCheck:   () => void
}) {
  const flags    = candidate.red_flags_json as RedFlag[] | null
  const hasRun   = candidate.red_flag_score !== null
  const highFlags = flags?.filter(f => f.severity === 'high')  ?? []
  const medFlags  = flags?.filter(f => f.severity === 'medium') ?? []

  const { rect, show, hide, keepOpen } = useTooltip()

  return (
    <>
      <div onMouseEnter={show} onMouseLeave={hide} className="inline-flex items-center gap-1.5 cursor-default">
        {hasRun ? (
          <>
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
          </>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); hide(); onCheck() }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Check
          </button>
        )}
      </div>
      {rect && createPortal(
        <AnimatePresence>
          <RedFlagTooltip
            candidate={candidate}
            rect={rect}
            onMouseEnter={keepOpen}
            onMouseLeave={hide}
          />
        </AnimatePresence>,
        document.body,
      )}
    </>
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
  const [open,     setOpen]    = useState(false)
  const [saving,   setSaving]  = useState(false)
  const [dropPos,  setDropPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef                 = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as Node
      if (btnRef.current && !btnRef.current.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function openDropdown() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + 4, left: r.left })
    setOpen(true)
  }

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
    <>
      <button
        ref={btnRef}
        onClick={openDropdown}
        disabled={saving}
        className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors hover:opacity-80', STATUS_CLASS[status])}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin inline" /> : STATUS_LABEL[status]}
      </button>
      {open && dropPos && createPortal(
        <div
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
          className="w-32 bg-[#1A1D2E] border border-white/10 rounded-xl shadow-xl overflow-hidden"
        >
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => pick(s)}
              className={cn('w-full text-left px-3 py-2 text-xs transition-colors', s === status ? 'opacity-40 cursor-default' : 'hover:bg-white/5', STATUS_CLASS[s].split(' ')[1])}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
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
  onCompare,
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
  onCompare:    () => void
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
    { icon: Eye,        label: 'View Resume',      action: onView,       always: true  },
    { icon: Star,       label: 'Score',            action: onScore,      always: candidate.cqi_score === null },
    { icon: Flag,       label: 'Check Red Flags',  action: onRedFlag,    always: true  },
    { icon: FileText,   label: 'Generate Summary', action: onSummary,    always: true  },
    { icon: GitCompare, label: 'Compare',          action: onCompare,    always: true  },
    { icon: Send,       label: 'Send Assessment',  action: onAssessment, always: isManager && !candidate.assessment_invite_id },
    { icon: Trash2,     label: 'Remove',           action: onRemove,     always: isOwner, danger: true },
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
  selected?:    Set<string>
  allSelected?: boolean
  someSelected?: boolean
  onToggleSelect?: (id: string) => void
  onSelectAll?:   () => void
  onStatusChange: (id: string, status: CandidateStatus) => void
  onScored:     (id: string, score: number) => void
  onRedFlag:    (id: string) => void
  onRemove:     (id: string) => void
  onViewResume: (candidate: CandidateRow) => void
  onSummary:    (candidate: CandidateRow) => void
  onAssessment: (candidate: CandidateRow) => void
  onScoreIndividual: (candidate: CandidateRow) => void
  onCompare:    (candidate: CandidateRow) => void
}

export function CandidatesTable({
  candidates, projectId, userId, canEdit, isOwner, isManager,
  selected = new Set(), allSelected, someSelected, onToggleSelect, onSelectAll,
  onStatusChange, onRemove, onViewResume, onSummary, onAssessment, onScoreIndividual, onRedFlag, onCompare,
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
      <table className="w-full text-sm border-collapse min-w-[760px]">
        <thead>
          <tr className="border-b border-white/8">
            {/* Checkbox header */}
            <th className="pb-3 pr-2 pl-1 w-8">
              {onSelectAll && (
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = !!someSelected }}
                  onChange={onSelectAll}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-indigo-500 cursor-pointer"
                />
              )}
            </th>
            {['Rank', 'Name', 'Rate', 'CQI', 'Red Flags', 'Assessment', 'Status', 'Actions'].map(h => (
              <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500 pb-3 pr-4 first:pl-1">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {candidates.map(c => (
            <tr key={c.id} className={cn('hover:bg-white/2 transition-colors group', selected.has(c.id) && 'bg-indigo-500/5')}>
              {/* Checkbox */}
              <td className="py-4 pr-2 pl-1 w-8">
                {onToggleSelect && (
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => onToggleSelect(c.id)}
                    className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-indigo-500 cursor-pointer"
                  />
                )}
              </td>

              {/* Rank */}
              <td className="py-4 pr-4 pl-1 w-10">
                <RankCell rank={ranks[c.id] ?? null} />
              </td>

              {/* Name + email */}
              <td className="py-4 pr-4">
                <button onClick={() => onViewResume(c)} className="text-left group/name">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-white group-hover/name:text-indigo-300 transition-colors">{c.candidate_name}</p>
                    {c.hired && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <Crown className="w-2.5 h-2.5" />
                        Hired
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{c.candidate_email}</p>
                </button>
              </td>

              {/* Rate */}
              <td className="py-4 pr-4 w-28">
                {c.pay_rate_min != null || c.pay_rate_max != null ? (
                  <span className="text-xs text-slate-300 tabular-nums">
                    {c.pay_rate_min != null && c.pay_rate_max != null
                      ? `$${c.pay_rate_min}–$${c.pay_rate_max}`
                      : c.pay_rate_min != null
                        ? `$${c.pay_rate_min}+`
                        : `up to $${c.pay_rate_max}`}
                    <span className="text-slate-600 ml-0.5">/{c.pay_rate_type === 'annual' ? 'yr' : 'hr'}</span>
                  </span>
                ) : (
                  <span className="text-slate-600 text-xs">—</span>
                )}
              </td>

              {/* CQI */}
              <td className="py-4 pr-4 w-24">
                {c.cqi_score !== null ? (
                  <CqiBadgeWithTooltip candidate={c} />
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
              <td className="py-4 pr-4 w-28">
                <RedFlagCellWithTooltip
                  candidate={c}
                  onCheck={() => onRedFlag(c.id)}
                />
              </td>

              {/* Assessment */}
              <td className="py-4 pr-4 w-36">
                {c.invite_status === 'completed' ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium text-emerald-400">Trust: {c.trust_score ?? '—'}</span>
                    <span className="text-[11px] font-medium text-indigo-400">Skill: {c.skill_score ?? '—'}</span>
                  </div>
                ) : c.invite_status === 'pending' ? (
                  <span className="text-[11px] font-semibold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                    Pending
                  </span>
                ) : (
                  isManager ? (
                    <button onClick={() => onAssessment(c)} className="text-xs text-indigo-400 hover:text-indigo-200 transition-colors">
                      Send
                    </button>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )
                )}
              </td>

              {/* Status */}
              <td className="py-4 pr-4 w-28">
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
              <td className="py-4 pl-1 w-10">
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
                  onCompare={() => onCompare(c)}
                  onRemove={() => handleRemove(c)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
