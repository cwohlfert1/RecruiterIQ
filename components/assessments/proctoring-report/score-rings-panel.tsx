import type { AssessmentSession } from '@/types/database'
import { ScoreRing, PercentileBadge } from './atoms'

export interface Benchmark {
  avg_skill_score:   number
  avg_trust_score:   number
  total_assessments: number
  template_type:     string
}

interface Props {
  session:   AssessmentSession
  benchmark: Benchmark | null | undefined
}

export function ScoreRingsPanel({ session, benchmark }: Props) {
  const showBenchmark = !!(benchmark && benchmark.total_assessments >= 3)
  const notEnoughData = !!(benchmark && benchmark.total_assessments < 3)

  return (
    <div className="glass-card rounded-2xl p-8 flex items-start justify-center gap-16">
      <div className="flex flex-col items-center gap-2">
        <ScoreRing score={session.trust_score} label="Trust Score" />
        {showBenchmark && (
          <div className="flex flex-col items-center gap-1.5 text-center">
            <PercentileBadge score={session.trust_score} avg={benchmark!.avg_trust_score} />
            <p className="text-xs text-slate-500">
              Avg integrity for {benchmark!.template_type}: {Math.round(benchmark!.avg_trust_score)}/100
            </p>
          </div>
        )}
        {notEnoughData && <p className="text-[10px] text-slate-600">Not enough data yet</p>}
      </div>

      <div className="w-px h-20 bg-white/8 mt-4" />

      <div className="flex flex-col items-center gap-2">
        <ScoreRing score={session.skill_score} label="Skill Score" />
        {showBenchmark && (
          <div className="flex flex-col items-center gap-1.5 text-center">
            <PercentileBadge score={session.skill_score} avg={benchmark!.avg_skill_score} />
            <p className="text-xs text-slate-500">
              Avg skill for {benchmark!.template_type}: {Math.round(benchmark!.avg_skill_score)}/100
              {' '}across {benchmark!.total_assessments} candidate{benchmark!.total_assessments !== 1 ? 's' : ''}
            </p>
          </div>
        )}
        {notEnoughData && <p className="text-[10px] text-slate-600">Not enough data yet</p>}
      </div>
    </div>
  )
}
