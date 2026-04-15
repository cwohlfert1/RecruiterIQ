'use client'

import { useState, useEffect, useMemo } from 'react'
import { Users, TrendingUp, Award, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { PipelineStage } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────

interface ProjectRef {
  id:          string
  title:       string
  client_name: string
  jd_text:     string | null
  owner_id:    string
}

interface Member {
  id:       string
  user_id:  string
  role:     string
  email:    string | null
  added_at?: string | null
}

interface ActivityItem {
  id:            string
  action_type:   string
  metadata_json: Record<string, unknown>
  user_id:       string | null
  user_email:    string | null
  created_at:    string
}

interface Props {
  project:        ProjectRef
  candidates:     CandidateRow[]
  members:        Member[]
  planTier:       'free' | 'pro' | 'agency'
  isManager:      boolean
  onJumpToPipeline: (stage?: PipelineStage) => void
  onJumpToCandidates: () => void
}

// ─── Pipeline stage config ────────────────────────────────────

const PIPELINE_STAGES: Array<{ key: PipelineStage; label: string; color: string; bar: string }> = [
  { key: 'reviewing',          label: 'Reviewing',          color: 'text-slate-300',   bar: 'bg-slate-500'   },
  { key: 'screened',            label: 'Screened',           color: 'text-blue-300',    bar: 'bg-blue-500'    },
  { key: 'internal_submittal',  label: 'Int. Submittal',     color: 'text-indigo-300',  bar: 'bg-indigo-500'  },
  { key: 'client_submittal',    label: 'Client Submittal',   color: 'text-violet-300',  bar: 'bg-violet-500'  },
  { key: 'interviewing',        label: 'Interviewing',       color: 'text-amber-300',   bar: 'bg-amber-500'   },
  { key: 'placed',              label: 'Placed',             color: 'text-green-300',   bar: 'bg-green-500'   },
  { key: 'rejected',            label: 'Rejected',           color: 'text-red-300',     bar: 'bg-red-500'     },
]

// ─── Avatar ───────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-purple-500',
  'bg-cyan-500',   'bg-rose-500',    'bg-amber-500',
]

function Avatar({ email, size = 'sm' }: { email: string | null; size?: 'sm' | 'xs' }) {
  const char  = email ? email[0].toUpperCase() : '?'
  const color = email ? AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length] : 'bg-slate-600'
  const cls   = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-5 h-5 text-[10px]'
  return (
    <div className={cn('rounded-full flex items-center justify-center font-bold text-white flex-shrink-0', color, cls)}>
      {char}
    </div>
  )
}

// ─── Score ring (reused for health score) ────────────────────

function ScoreRing({ score, size = 80, label }: { score: number; size?: number; label: string }) {
  const radius      = size * 0.38
  const circumference = 2 * Math.PI * radius
  const dash          = Math.max(0, Math.min(score / 100, 1)) * circumference
  const color =
    score >= 80 ? '#10b981' :
    score >= 50 ? '#f59e0b' :
                  '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="rgba(255,255,255,0.06)" strokeWidth={size * 0.075} fill="none"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={color} strokeWidth={size * 0.075} fill="none"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-xl font-bold text-white">{score}</span>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 text-center leading-tight">{label}</p>
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
    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border tabular-nums', cls)}>
      {score}
    </span>
  )
}

// ─── Health score calculator ──────────────────────────────────

function calcHealthScore(
  project:    ProjectRef,
  candidates: CandidateRow[],
  members:    Member[],
  hasBooleans: boolean,
): number {
  let score = 0
  if (project.jd_text)                                          score += 20
  if (hasBooleans)                                              score += 10
  if (candidates.length >= 3)                                   score += 20
  if (candidates.some(c => c.cqi_score !== null))               score += 20
  if (candidates.some(c => c.assessment_invite_id !== null))    score += 20
  if (members.length > 1)                                       score += 10
  return score
}

// ─── Week helpers ─────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

// ─── Component ───────────────────────────────────────────────

export function OverviewTab({
  project,
  candidates,
  members,
  planTier,
  onJumpToPipeline,
  onJumpToCandidates,
}: Props) {
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [hasBooleans, setHasBooleans] = useState(false)

  useEffect(() => {
    // Fetch activity for stats (last 100 items covers at least 2 weeks for most projects)
    fetch(`/api/projects/${project.id}/activity?page=0&limit=100`)
      .then(r => r.json())
      .then(json => { if (json.items) setActivity(json.items) })
      .catch(() => {})

    // Check if boolean strings exist (use existing boolean route)
    fetch(`/api/projects/${project.id}/boolean`)
      .then(r => r.json())
      .then(json => {
        const hasActive = Array.isArray(json.myString)
          ? json.myString.length > 0
          : !!json.myString
        setHasBooleans(hasActive || (Array.isArray(json.allStrings) && json.allStrings.length > 0))
      })
      .catch(() => {})
  }, [project.id])

  // ── Pipeline stage counts ────────────────────────────────────

  const stageCounts = useMemo(() => {
    const counts: Partial<Record<PipelineStage, number>> = {}
    for (const s of PIPELINE_STAGES) counts[s.key] = 0
    for (const c of candidates) {
      const stage = (c.pipeline_stage ?? 'reviewing') as PipelineStage
      counts[stage] = (counts[stage] ?? 0) + 1
    }
    return counts
  }, [candidates])

  const maxCount = Math.max(1, ...Object.values(stageCounts).map(v => v ?? 0))

  // ── Activity stats ───────────────────────────────────────────

  const { thisWeek, lastWeek, contributions } = useMemo(() => {
    const now        = new Date()
    const thisStart  = startOfWeek(now)
    const lastStart  = new Date(thisStart); lastStart.setDate(lastStart.getDate() - 7)

    const thisWeek  = { added: 0, scored: 0, assessed: 0 }
    const lastWeek  = { added: 0, scored: 0, assessed: 0 }
    const contribs: Record<string, { email: string | null; added: number; scored: number; assessed: number }> = {}

    for (const item of activity) {
      const t = new Date(item.created_at)
      const uid = item.user_id ?? 'unknown'
      if (!contribs[uid]) contribs[uid] = { email: item.user_email, added: 0, scored: 0, assessed: 0 }

      const isThis = t >= thisStart
      const isLast = t >= lastStart && t < thisStart

      if (item.action_type === 'candidate_added') {
        if (isThis) thisWeek.added++
        if (isLast) lastWeek.added++
        if (isThis || isLast) contribs[uid].added++
      }
      if (item.action_type === 'candidate_scored' || item.action_type === 'batch_score_completed') {
        if (isThis) thisWeek.scored++
        if (isLast) lastWeek.scored++
        if (isThis || isLast) contribs[uid].scored++
      }
      if (item.action_type === 'assessment_sent') {
        if (isThis) thisWeek.assessed++
        if (isLast) lastWeek.assessed++
        if (isThis || isLast) contribs[uid].assessed++
      }
    }

    return { thisWeek, lastWeek, contributions: Object.values(contribs).sort((a, b) => (b.added + b.scored + b.assessed) - (a.added + a.scored + a.assessed)) }
  }, [activity])

  // ── Top candidates ───────────────────────────────────────────

  const topCandidates = useMemo(() =>
    [...candidates]
      .filter(c => c.cqi_score !== null)
      .sort((a, b) => (b.cqi_score ?? 0) - (a.cqi_score ?? 0))
      .slice(0, 3),
    [candidates]
  )

  // ── Health score ─────────────────────────────────────────────

  const healthScore = calcHealthScore(project, candidates, members, hasBooleans)

  // ─────────────────────────────────────────────────────────────

  function delta(current: number, prior: number) {
    const diff = current - prior
    if (diff === 0) return null
    return diff > 0 ? `+${diff} vs last week` : `${diff} vs last week`
  }

  const STAGE_LABEL: Record<PipelineStage, string> = {
    reviewing: 'Reviewing', screened: 'Screened',
    internal_submittal: 'Int. Submittal', client_submittal: 'Client Submittal',
    interviewing: 'Interviewing', placed: 'Placed', rejected: 'Rejected',
  }

  return (
    <div className="space-y-4">
      {/* 2×2 grid on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Pipeline Funnel ─────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Pipeline Funnel</h3>
          </div>

          {candidates.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No candidates yet</p>
          ) : (
            <div className="space-y-2">
              {PIPELINE_STAGES.map(stage => {
                const count = stageCounts[stage.key] ?? 0
                const pct   = count === 0 ? 0 : Math.max(4, Math.round((count / maxCount) * 100))
                return (
                  <button
                    key={stage.key}
                    onClick={() => onJumpToPipeline(stage.key)}
                    className="w-full group flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                  >
                    <span className="text-[11px] text-slate-500 w-24 flex-shrink-0 truncate group-hover:text-slate-300 transition-colors">
                      {stage.label}
                    </span>
                    <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', stage.bar)}
                        style={{ width: `${pct}%`, opacity: count === 0 ? 0.2 : 0.85 }}
                      />
                    </div>
                    <span className={cn('text-xs font-semibold tabular-nums w-5 text-right', stage.color)}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Project Health ──────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Project Completeness</h3>
          </div>

          <div className="flex items-center gap-6">
            <ScoreRing score={healthScore} label="Project Completeness" />
            <div className="flex-1 space-y-2">
              {[
                { label: 'Job Description',    done: !!project.jd_text,                                  pts: 20 },
                { label: 'Boolean Strings',    done: hasBooleans,                                         pts: 10 },
                { label: '3+ Candidates',      done: candidates.length >= 3,                              pts: 20 },
                { label: '1+ Scored',          done: candidates.some(c => c.cqi_score !== null),          pts: 20 },
                { label: '1+ Assessed',        done: candidates.some(c => c.assessment_invite_id !== null), pts: 20 },
                { label: 'Team Member',        done: members.length > 1,                                  pts: 10 },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={cn('w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0',
                    item.done
                      ? 'bg-emerald-500/20 border-emerald-500/40'
                      : 'bg-white/5 border-white/10'
                  )}>
                    {item.done && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                  </div>
                  <span className={cn('text-[11px]', item.done ? 'text-slate-300' : 'text-slate-600')}>
                    {item.label}
                  </span>
                  <span className="text-[10px] text-slate-600 ml-auto">+{item.pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Activity Summary ────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">This Week</h3>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Candidates Added', value: thisWeek.added,    prior: lastWeek.added    },
              { label: 'Scores Run',       value: thisWeek.scored,   prior: lastWeek.scored   },
              { label: 'Assessments Sent', value: thisWeek.assessed, prior: lastWeek.assessed },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-xs text-slate-400">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white tabular-nums">{row.value}</span>
                  {delta(row.value, row.prior) && (
                    <span className={cn('text-[10px] font-medium',
                      row.value > row.prior ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {delta(row.value, row.prior)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Top Candidates ──────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-yellow-500/15 border border-yellow-500/20 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-yellow-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Top Candidates</h3>
            {candidates.length > 3 && (
              <button
                onClick={onJumpToCandidates}
                className="ml-auto text-[11px] text-indigo-400 hover:text-indigo-200 transition-colors"
              >
                View All →
              </button>
            )}
          </div>

          {topCandidates.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No scored candidates yet</p>
          ) : (
            <div className="space-y-2">
              {topCandidates.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <span className="text-xs font-bold text-slate-600 w-4 tabular-nums">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.candidate_name}</p>
                    <p className="text-[11px] text-slate-500">{STAGE_LABEL[(c.pipeline_stage ?? 'reviewing') as PipelineStage]}</p>
                  </div>
                  {c.cqi_score !== null && <CqiBadge score={c.cqi_score} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Team Contributions (Agency only) ──────────────────── */}
      {planTier === 'agency' && contributions.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Team Contributions (This Week)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-white/8">
                  {['Member', 'Added', 'Scored', 'Assessed'].map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500 pb-2 pr-4 first:pl-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {contributions.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <Avatar email={row.email} size="xs" />
                        <span className="text-xs text-slate-300 truncate">{row.email?.split('@')[0] ?? 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-slate-400 tabular-nums">{row.added}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-400 tabular-nums">{row.scored}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-400 tabular-nums">{row.assessed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
