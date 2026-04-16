import type { AssessmentSnapshot } from '@/types/database'
import { EVENT_LABELS } from './constants'

interface Props {
  snapshots:    AssessmentSnapshot[]
  snapshotUrls: Record<string, string>
  startMs:      number
  onOpenModal:  (list: AssessmentSnapshot[], idx: number) => void
}

export function SnapshotGallery({ snapshots, snapshotUrls, startMs, onOpenModal }: Props) {
  if (snapshots.length === 0) return null

  const violationSnapshots = snapshots.filter(s => !!(s as Record<string, unknown>).triggered_by_event)
  const periodicSnapshots  = snapshots.filter(s => !(s as Record<string, unknown>).triggered_by_event)

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Violation Snapshots ({violationSnapshots.length})
        </h2>
        {violationSnapshots.length === 0 ? (
          <p className="text-xs text-slate-600 italic">No violation snapshots captured — webcam may have been off or no high-severity events occurred.</p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {violationSnapshots.map((snap, i) => {
              const tbe = (snap as Record<string, unknown>).triggered_by_event as string | null
              return (
                <button
                  key={snap.id}
                  onClick={() => onOpenModal(violationSnapshots, i)}
                  className="group glass-card rounded-xl overflow-hidden aspect-video bg-white/5 flex flex-col items-center justify-center relative border border-red-500/15 hover:border-red-500/40 transition-colors"
                >
                  {snapshotUrls[snap.id] ? (
                    <img src={snapshotUrls[snap.id]} alt="Violation" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-600">{new Date(snap.taken_at).toLocaleTimeString()}</span>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1.5 py-1 text-[9px] text-red-300 truncate">
                    {tbe ? (EVENT_LABELS[tbe] ?? tbe) : 'Violation'}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {periodicSnapshots.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Periodic Snapshots ({periodicSnapshots.length}) — Retained 90 days
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {periodicSnapshots.map((snap, i) => {
              const secsIn = Math.round((new Date(snap.taken_at).getTime() - startMs) / 1000)
              const label  = secsIn >= 60 ? `${Math.floor(secsIn / 60)}:${String(secsIn % 60).padStart(2, '0')} in` : `${secsIn}s in`
              return (
                <button
                  key={snap.id}
                  onClick={() => onOpenModal(periodicSnapshots, i)}
                  className="group glass-card rounded-xl overflow-hidden aspect-video bg-white/5 flex flex-col items-center justify-center relative border border-white/8 hover:border-white/20 transition-colors"
                >
                  {snapshotUrls[snap.id] ? (
                    <img src={snapshotUrls[snap.id]} alt="Periodic" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-600">{new Date(snap.taken_at).toLocaleTimeString()}</span>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1.5 py-1 text-[9px] text-slate-400 truncate">
                    {label}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
