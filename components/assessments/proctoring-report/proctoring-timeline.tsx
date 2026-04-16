'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ProctoringEvent, AssessmentSnapshot } from '@/types/database'
import { SeverityDot } from './atoms'
import { EVENT_LABELS } from './constants'

interface Props {
  events:             ProctoringEvent[]
  snapshots:          AssessmentSnapshot[]
  violationSnapshots: AssessmentSnapshot[]
  snapshotUrls:       Record<string, string>
  startMs:            number
  durationMs:         number
  timeSpent:          string
  onOpenModal:        (list: AssessmentSnapshot[], idx: number) => void
}

const SEVERITY_COLOR: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-yellow-500',
  low:    'bg-green-500',
  info:   'bg-slate-500',
}

export function ProctoringTimeline({
  events, snapshots, violationSnapshots, snapshotUrls, startMs, durationMs, timeSpent, onOpenModal,
}: Props) {
  const [selectedEvent, setSelectedEvent] = useState<ProctoringEvent | null>(null)

  function timelinePct(ts: string) {
    return Math.min(100, Math.max(0, ((new Date(ts).getTime() - startMs) / durationMs) * 100))
  }

  function findViolationSnapshot(event: ProctoringEvent): AssessmentSnapshot | null {
    const eventMs = new Date(event.timestamp).getTime()
    return snapshots.find(s => {
      const sms = new Date(s.taken_at).getTime()
      const tbe = (s as Record<string, unknown>).triggered_by_event as string | null
      return tbe === event.event_type && Math.abs(sms - eventMs) <= 15000
    }) ?? null
  }

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <h2 className="text-sm font-semibold text-white">Proctoring Timeline</h2>
      <div className="relative h-6 bg-white/5 rounded-full overflow-visible">
        <div className="absolute inset-0 rounded-full bg-green-500/10" />
        {events.map(event => {
          const dotColor = SEVERITY_COLOR[event.severity] ?? 'bg-slate-500'
          return (
            <button
              key={event.id}
              onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
              style={{ left: `${timelinePct(event.timestamp)}%` }}
              className={cn(
                'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-[#1A1D2E] hover:scale-150 transition-transform cursor-pointer z-10',
                dotColor
              )}
              title={EVENT_LABELS[event.event_type] ?? event.event_type}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-slate-600">
        <span>Start</span>
        <span>End ({timeSpent})</span>
      </div>

      {selectedEvent && (() => {
        const snap = findViolationSnapshot(selectedEvent)
        const snapIdxInViolations = snap ? violationSnapshots.indexOf(snap) : -1
        return (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SeverityDot severity={selectedEvent.severity} />
                <span className="font-medium text-white">{EVENT_LABELS[selectedEvent.event_type] ?? selectedEvent.event_type}</span>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
            </div>
            <p className="text-xs text-slate-500">{new Date(selectedEvent.timestamp).toLocaleTimeString()}</p>
            <pre className="text-xs text-slate-400 bg-white/5 rounded-lg p-2 overflow-x-auto">
              {JSON.stringify(selectedEvent.payload_json, null, 2)}
            </pre>
            {snap && (
              <div className="mt-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Snapshot at moment of violation</p>
                {snapshotUrls[snap.id] ? (
                  <button onClick={() => onOpenModal(
                    violationSnapshots.length > 0 ? violationSnapshots : [snap],
                    snapIdxInViolations >= 0 ? snapIdxInViolations : 0,
                  )}>
                    <img
                      src={snapshotUrls[snap.id]}
                      alt="Violation snapshot"
                      className="w-20 h-14 object-cover rounded-md border border-white/10 hover:border-indigo-500/50 transition-colors cursor-pointer"
                    />
                  </button>
                ) : (
                  <div className="w-20 h-14 bg-white/5 rounded-md border border-white/10 flex items-center justify-center">
                    <span className="text-[9px] text-slate-600">No image</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
