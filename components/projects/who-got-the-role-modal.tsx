'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Confetti ─────────────────────────────────────────────────

interface Particle {
  id:    number
  x:     number
  color: string
  delay: number
  dur:   number
  size:  number
}

const COLORS = ['#6366f1','#10b981','#f59e0b','#ec4899','#3b82f6','#8b5cf6','#14b8a6']

function Confetti({ show }: { show: boolean }) {
  const particles = useRef<Particle[]>(
    Array.from({ length: 60 }, (_, i) => ({
      id:    i,
      x:     Math.random() * 100,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 0.6,
      dur:   1.5 + Math.random() * 1,
      size:  6 + Math.random() * 6,
    }))
  )

  if (!show) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {particles.current.map(p => (
        <div
          key={p.id}
          className="absolute top-0 rounded-sm animate-confetti-fall"
          style={{
            left:             `${p.x}%`,
            width:            p.size,
            height:           p.size,
            backgroundColor:  p.color,
            animationDelay:   `${p.delay}s`,
            animationDuration:`${p.dur}s`,
            transform:        `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────

interface Candidate {
  id:            string
  candidate_name: string
  cqi_score:     number | null
}

interface Props {
  isOpen:       boolean
  projectId:    string
  candidates:   Candidate[]
  onConfirm:    (candidateId: string, candidateName: string) => void
  onSkip:       () => void
  onClose:      () => void
}

// ─── Component ───────────────────────────────────────────────

export function WhoGotTheRoleModal({ isOpen, projectId, candidates, onConfirm, onSkip, onClose }: Props) {
  const [selected,  setSelected]  = useState<string>('')
  const [saving,    setSaving]    = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  void projectId // used by parent via onConfirm callback

  const sorted = [...candidates].sort((a, b) => (b.cqi_score ?? -1) - (a.cqi_score ?? -1))

  useEffect(() => {
    if (isOpen && sorted.length > 0) {
      setSelected(sorted[0].id)
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm() {
    if (!selected) return
    const candidate = candidates.find(c => c.id === selected)
    if (!candidate) return

    setSaving(true)
    try {
      setShowConfetti(true)
      onConfirm(selected, candidate.candidate_name)
      setTimeout(() => setShowConfetti(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Confetti show={showConfetti} />

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
              onClick={onClose}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 16 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-md bg-[#1A1D2E] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between p-6 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Who got the role?</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        This helps Cortex learn what great candidates look like for your agency
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="px-6 pb-6 space-y-4">
                  {candidates.length === 0 ? (
                    <p className="text-sm text-slate-400">No candidates in this project yet.</p>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-400">Select hired candidate</label>
                      <select
                        value={selected}
                        onChange={e => setSelected(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 appearance-none cursor-pointer"
                      >
                        {sorted.map(c => (
                          <option key={c.id} value={c.id} className="bg-[#1A1D2E] text-white">
                            {c.candidate_name}{c.cqi_score !== null ? ` — CQI: ${c.cqi_score}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={handleConfirm}
                      disabled={!selected || saving}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl',
                        'text-sm font-semibold text-white transition-all duration-150',
                        'bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      {saving
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                        : <><Trophy className="w-4 h-4" />Mark as Hired</>
                      }
                    </button>
                    <button
                      onClick={onSkip}
                      className="px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
