import { Loader2, Sparkles, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { BreakdownJson, CqiRecommendation } from '@/types/database'
import { CqiRing, BreakdownBar } from './atoms'
import { BREAKDOWN_CATEGORIES, RECOMMENDATION_BADGE, type BenchmarkData, type ClientIntel, type ProjectRef, type RedFlag } from './constants'

interface Props {
  candidate:   CandidateRow
  project:     ProjectRef
  benchmark:   BenchmarkData | null
  clientIntel: ClientIntel | null
  flags:       RedFlag[] | null
  flagScore:   number | null
  flagging:    boolean
  onRunFlagCheck: () => void
}

export function OverviewSection({
  candidate, project, benchmark, clientIntel, flags, flagScore, flagging, onRunFlagCheck,
}: Props) {
  const breakdown = candidate.cqi_breakdown_json as (BreakdownJson & { recommendation?: CqiRecommendation }) | null

  return (
    <>
      {/* CQI Score */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">CQI Score</p>
        {candidate.cqi_score !== null ? (
          <>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <CqiRing score={candidate.cqi_score} size={100} />
                {breakdown?.recommendation && RECOMMENDATION_BADGE[breakdown.recommendation] && (
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    RECOMMENDATION_BADGE[breakdown.recommendation].cls,
                  )}>
                    {RECOMMENDATION_BADGE[breakdown.recommendation].label}
                  </span>
                )}
                {clientIntel && clientIntel.outcome_count >= 3 && clientIntel.success_threshold != null && (
                  <div className="w-full max-w-[100px] text-center mt-1">
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      <Star className="w-2.5 h-2.5" fill="currentColor" />
                      Client Intel
                    </span>
                    <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">
                      {candidate.cqi_score != null && candidate.cqi_score < clientIntel.success_threshold
                        ? `Below ${clientIntel.success_threshold} CQI on ${project.client_name} = low success`
                        : `${clientIntel.outcome_count} past submissions to ${project.client_name}`
                      }
                    </p>
                  </div>
                )}
              </div>
              {breakdown && (
                <div className="flex-1 space-y-2">
                  {BREAKDOWN_CATEGORIES.map(cat => (
                    <BreakdownBar
                      key={cat.key}
                      label={cat.label}
                      score={breakdown[cat.key]?.score ?? 0}
                      weight={breakdown[cat.key]?.weight ?? 0}
                      inverted={cat.inverted}
                    />
                  ))}
                </div>
              )}
            </div>
            {benchmark && (
              <div className="mt-4 rounded-xl p-3 border border-indigo-500/20 bg-indigo-500/5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-2">Benchmark Comparison</p>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 mb-0.5">Benchmark</p>
                    <p className={cn('text-xl font-bold tabular-nums',
                      benchmark.cqi_score >= 80 ? 'text-emerald-400' :
                      benchmark.cqi_score >= 60 ? 'text-yellow-400' : 'text-red-400'
                    )}>{benchmark.cqi_score}</p>
                  </div>
                  <div className="text-slate-600 text-base">→</div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 mb-0.5">This candidate</p>
                    <p className={cn('text-xl font-bold tabular-nums',
                      candidate.cqi_score >= 80 ? 'text-emerald-400' :
                      candidate.cqi_score >= 60 ? 'text-yellow-400' : 'text-red-400'
                    )}>{candidate.cqi_score}</p>
                  </div>
                  <div className="ml-auto text-xs font-medium">
                    {candidate.cqi_score >= benchmark.cqi_score
                      ? <span className="text-emerald-400">↑ Above</span>
                      : <span className="text-rose-400">↓ Below</span>
                    }
                  </div>
                </div>
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
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Red Flags</p>
          <button
            onClick={onRunFlagCheck}
            disabled={flagging}
            className="flex items-center gap-1 text-[10px] text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-full hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
          >
            {flagging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {flagScore !== null ? 'Re-check' : 'Run Check'}
          </button>
        </div>
        {flagScore === null ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/4 border border-white/8 rounded-xl p-3">
            <Sparkles className="w-3.5 h-3.5 text-slate-600" />
            Not checked yet
          </div>
        ) : flags && flags.length > 0 ? (
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
            <p className="text-[10px] text-slate-500 mt-1">Integrity score: {flagScore}/100</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            No red flags detected
          </div>
        )}
      </section>

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
    </>
  )
}
