import { cn } from '@/lib/utils'

export function ScoreRing({ score, label }: { score: number | null; label: string }) {
  const pct    = score ?? 0
  const radius = 40
  const circ   = 2 * Math.PI * radius
  const offset = circ - (pct / 100) * circ
  const color  = pct >= 70 ? '#22C55E' : pct >= 40 ? '#EAB308' : '#EF4444'

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={score !== null ? color : 'rgba(255,255,255,0.1)'}
            strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{score ?? '—'}</span>
          <span className="text-[10px] text-slate-500">/100</span>
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mt-2">{label}</p>
    </div>
  )
}

export function PercentileBadge({ score, avg }: { score: number | null; avg: number }) {
  if (score === null) return null
  const diff = score - avg
  if (diff > 10)  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25 font-medium">Top performer</span>
  if (diff > 0)   return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25 font-medium">Above average</span>
  if (diff < -10) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-medium">Below average</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/25 font-medium">Average</span>
}

export function SeverityDot({ severity }: { severity: string }) {
  const cls = {
    high:   'bg-red-500',
    medium: 'bg-yellow-500',
    low:    'bg-green-500',
    info:   'bg-slate-500',
  }[severity] ?? 'bg-slate-500'
  return <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', cls)} />
}
