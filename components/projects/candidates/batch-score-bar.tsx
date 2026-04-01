'use client'

import { X } from 'lucide-react'

interface Props {
  current:  number
  total:    number
  failed:   number
  onRetry?: () => void
  onDismiss: () => void
}

export function BatchScoreBar({ current, total, failed, onRetry, onDismiss }: Props) {
  const pct      = total > 0 ? Math.round((current / total) * 100) : 0
  const done     = current >= total
  const allFailed = done && failed === total

  return (
    <div className="mb-4 px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-indigo-300 font-medium">
          {done
            ? allFailed
              ? 'All scoring attempts failed'
              : failed > 0
                ? `${current - failed} of ${total} scored — ${failed} failed`
                : 'All candidates scored!'
            : `Scoring candidates… ${current} of ${total}`}
        </span>
        <div className="flex items-center gap-3">
          {done && failed > 0 && onRetry && (
            <button onClick={onRetry} className="text-indigo-400 hover:text-indigo-200 transition-colors">
              Retry
            </button>
          )}
          {done && (
            <button onClick={onDismiss} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${done && failed === 0 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
