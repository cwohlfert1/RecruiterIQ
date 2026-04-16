import { cn } from '@/lib/utils'

export function CqiRing({ score, size = 100 }: { score: number; size?: number }) {
  const r             = (size / 2) - 8
  const circumference = 2 * Math.PI * r
  const dash          = (score / 100) * circumference
  const color =
    score >= 80 ? '#10b981' :
    score >= 60 ? '#f59e0b' :
                  '#ef4444'
  const center   = size / 2
  const sw       = size > 80 ? 8 : 6
  const fontSize = size > 80 ? 24 : 18

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={center} cy={center} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={sw} fill="none" />
          <circle
            cx={center} cy={center} r={r}
            stroke={color} strokeWidth={sw} fill="none"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-bold text-white leading-none" style={{ fontSize }}>{score}</p>
          <p className="text-[9px] text-slate-500 mt-0.5">CQI</p>
        </div>
      </div>
    </div>
  )
}

export function BreakdownBar({ label, score, weight, inverted }: { label: string; score: number; weight: number; inverted?: boolean }) {
  const displayScore = inverted ? 100 - score : score
  const color = displayScore >= 80 ? 'bg-emerald-500' : displayScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300 font-medium">
          {displayScore} <span className="text-slate-600">({Math.round(weight * 100)}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${displayScore}%` }} />
      </div>
    </div>
  )
}
