import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import type { Insights } from './constants'

interface Props {
  insights:   Insights | null
  loading:    boolean
  hasCqiScore: boolean
}

export function InsightsTab({ insights, loading, hasCqiScore }: Props) {
  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex flex-col items-center py-12 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <p className="text-xs text-slate-500">Generating insights...</p>
        </div>
      )}

      {!loading && !insights && !hasCqiScore && (
        <div className="flex flex-col items-center py-12 text-center">
          <AlertCircle className="w-6 h-6 text-slate-600 mb-2" />
          <p className="text-xs text-slate-500">Score this candidate to generate insights.</p>
        </div>
      )}

      {!loading && insights && (
        <>
          {insights.overqualified && insights.overqualified_reason && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-300">Overqualified Flag</p>
                <p className="text-xs text-amber-200/70 mt-0.5 leading-relaxed">{insights.overqualified_reason}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/8 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/8 bg-white/3">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-semibold text-green-400">Submit If</span>
              </div>
              <div className="px-3 py-2.5 border-l-2 border-green-500/40 ml-0">
                <ul className="space-y-2">
                  {insights.submit_if.map((item, i) => (
                    <li key={i} className="text-xs text-slate-300 leading-relaxed pl-2 relative before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-green-500/50">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-white/8 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/8 bg-white/3">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-semibold text-red-400">Avoid If</span>
              </div>
              <div className="px-3 py-2.5 border-l-2 border-red-500/40 ml-0">
                <ul className="space-y-2">
                  {insights.avoid_if.map((item, i) => (
                    <li key={i} className="text-xs text-slate-300 leading-relaxed pl-2 relative before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-red-500/50">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {insights.key_gaps.length > 0 && (
            <div className="rounded-xl border border-white/8 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400">Key Gaps vs JD</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {insights.key_gaps.join(' · ')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
