'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { AssessmentSnapshot } from '@/types/database'
import { EVENT_LABELS } from './constants'

interface Props {
  snapshots:   AssessmentSnapshot[]
  initialIdx:  number
  urls:        Record<string, string>
  onClose:     () => void
}

export function SnapshotModal({ snapshots, initialIdx, urls, onClose }: Props) {
  const [idx, setIdx] = useState(initialIdx)
  const snap = snapshots[idx]
  if (!snap) return null

  const triggeredBy = (snap as Record<string, unknown>).triggered_by_event as string | undefined
  const label = triggeredBy
    ? EVENT_LABELS[triggeredBy] ?? triggeredBy
    : 'Periodic snapshot'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="relative max-w-2xl w-full flex flex-col items-center gap-3"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <p className="text-sm font-medium text-white">{label}</p>

        {urls[snap.id] ? (
          <img src={urls[snap.id]} alt={label} className="w-full rounded-xl border border-white/10 shadow-2xl" />
        ) : (
          <div className="w-full aspect-video bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
            <span className="text-xs text-slate-500">Image unavailable</span>
          </div>
        )}

        <p className="text-xs text-slate-500">{new Date(snap.taken_at).toLocaleString()}</p>

        {snapshots.length > 1 && (
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIdx(i => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="text-xs text-slate-600">{idx + 1} / {snapshots.length}</span>
            <button
              onClick={() => setIdx(i => Math.min(snapshots.length - 1, i + 1))}
              disabled={idx === snapshots.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors disabled:opacity-30"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
