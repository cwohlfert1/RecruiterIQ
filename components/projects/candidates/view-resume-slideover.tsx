'use client'

import { useEffect } from 'react'
import { X, Mail } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { BreakdownJson } from '@/types/database'

interface Props {
  candidate: CandidateRow | null
  onClose:   () => void
}

// ─── CQI ring ────────────────────────────────────────────────

function CqiRing({ score }: { score: number }) {
  const radius      = 28
  const circumference = 2 * Math.PI * radius
  const dash          = (score / 100) * circumference
  const color =
    score >= 80 ? '#10b981' :
    score >= 60 ? '#f59e0b' :
                  '#ef4444'

  return (
    <div className="flex items-center gap-3">
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        <circle cx="36" cy="36" r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
        <circle
          cx="36" cy="36" r={radius}
          stroke={color} strokeWidth="6" fill="none"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div>
        <p className="text-2xl font-bold text-white">{score}</p>
        <p className="text-xs text-slate-500">CQI Score</p>
      </div>
    </div>
  )
}

const CATEGORIES: Array<{ key: keyof BreakdownJson; label: string }> = [
  { key: 'must_have_skills',  label: 'Must-Have Skills'    },
  { key: 'domain_experience', label: 'Domain Experience'   },
  { key: 'communication',     label: 'Communication'       },
  { key: 'tenure_stability',  label: 'Tenure Stability'    },
  { key: 'tool_depth',        label: 'Tool Depth'          },
]

function BreakdownBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const color =
    score >= 80 ? 'bg-emerald-500' :
    score >= 60 ? 'bg-yellow-500'  :
                  'bg-red-500'

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300 font-medium">{score} <span className="text-slate-600">({Math.round(weight * 100)}%)</span></span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

export function ViewResumeSlideover({ candidate, onClose }: Props) {
  const open = !!candidate

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const breakdown = candidate?.cqi_breakdown_json as BreakdownJson | null

  return (
    <AnimatePresence>
      {open && candidate && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-[520px] bg-[#12141F] border-l border-white/10 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-white/8">
              <div>
                <h2 className="text-sm font-semibold text-white">{candidate.candidate_name}</h2>
                <span className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                  <Mail className="w-3 h-3" />
                  {candidate.candidate_email}
                </span>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* CQI Score */}
              {candidate.cqi_score !== null ? (
                <div>
                  <CqiRing score={candidate.cqi_score} />
                  {breakdown && (
                    <div className="mt-4 space-y-3">
                      {CATEGORIES.map(cat => (
                        <BreakdownBar
                          key={cat.key}
                          label={cat.label}
                          score={breakdown[cat.key].score}
                          weight={breakdown[cat.key].weight}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-4 py-3 rounded-xl bg-slate-800 border border-white/8 text-xs text-slate-500">
                  Not scored yet
                </div>
              )}

              {/* Red Flags */}
              {candidate.red_flags_json && (candidate.red_flags_json as unknown[]).length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Red Flags</p>
                  <div className="space-y-2">
                    {(candidate.red_flags_json as Array<{ type: string; severity: string; evidence: string; explanation: string }>).map((flag, i) => (
                      <div key={i} className="px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                            flag.severity === 'high'   ? 'bg-red-500/20 text-red-400'    :
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
                  </div>
                </div>
              )}

              {/* Resume */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Resume</p>
                <pre className="whitespace-pre-wrap text-xs text-slate-400 font-sans leading-relaxed bg-white/3 border border-white/8 rounded-xl p-4 max-h-[500px] overflow-y-auto">
                  {candidate.resume_text}
                </pre>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
