'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, GitCompare, Trophy, CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'

interface CompareResult {
  recommendation: 'A' | 'B' | 'tie'
  summary:        string
  candidateA: { name: string; cqi_score: number | null; strengths: string[]; weaknesses: string[] }
  candidateB: { name: string; cqi_score: number | null; strengths: string[]; weaknesses: string[] }
}

interface Props {
  base:       CandidateRow | null   // the candidate the user clicked "Compare" on
  candidates: CandidateRow[]        // all candidates in the project (for picking B)
  projectId:  string
  onClose:    () => void
}

type Step = 'pick' | 'result'

export function CandidateCompare({ base, candidates, projectId, onClose }: Props) {
  const [step,      setStep]      = useState<Step>('pick')
  const [targetId,  setTargetId]  = useState<string>('')
  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState<CompareResult | null>(null)

  // Reset when base changes
  useEffect(() => {
    setStep('pick')
    setTargetId('')
    setResult(null)
  }, [base?.id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const others = candidates.filter(c => c.id !== base?.id)

  async function handleCompare() {
    if (!base || !targetId) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/projects/${projectId}/candidates/compare`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ candidateAId: base.id, candidateBId: targetId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Comparison failed'); return }
      setResult(data as CompareResult)
      setStep('result')
    } catch {
      toast.error('Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  if (!base) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-50"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{   opacity: 0, scale: 0.96,  y: 8 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-full max-w-2xl bg-[#12141F] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">
                {step === 'pick' ? 'Compare Candidates' : 'Comparison Result'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">

            {/* ── PICK STEP ─────────────────────────────── */}
            {step === 'pick' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Comparing <span className="text-white font-medium">{base.candidate_name}</span> against:
                </p>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {others.length === 0 && (
                    <p className="text-xs text-slate-500 py-4 text-center">No other candidates in this project.</p>
                  )}
                  {others.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setTargetId(c.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-colors',
                        targetId === c.id
                          ? 'border-indigo-500/50 bg-indigo-500/10 text-white'
                          : 'border-white/8 bg-white/3 text-slate-300 hover:bg-white/6 hover:border-white/15',
                      )}
                    >
                      <div>
                        <p className="text-xs font-medium">{c.candidate_name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{c.candidate_email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {c.cqi_score !== null && (
                          <span className="text-xs font-semibold text-indigo-300">CQI {c.cqi_score}</span>
                        )}
                        {targetId === c.id && <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── RESULT STEP ───────────────────────────── */}
            {step === 'result' && result && (
              <div className="space-y-5">
                {/* Recommendation banner */}
                <div className={cn(
                  'flex items-start gap-3 px-4 py-3 rounded-xl border',
                  result.recommendation === 'tie'
                    ? 'border-amber-500/30 bg-amber-500/8'
                    : 'border-emerald-500/30 bg-emerald-500/8',
                )}>
                  <Trophy className={cn(
                    'w-4 h-4 mt-0.5 shrink-0',
                    result.recommendation === 'tie' ? 'text-amber-400' : 'text-emerald-400',
                  )} />
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {result.recommendation === 'tie'
                        ? 'Too close to call'
                        : `Recommend submitting ${result.recommendation === 'A' ? result.candidateA.name : result.candidateB.name}`}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{result.summary}</p>
                  </div>
                </div>

                {/* Side-by-side */}
                <div className="grid grid-cols-2 gap-4">
                  {([
                    { label: 'A', data: result.candidateA, highlight: result.recommendation === 'A' },
                    { label: 'B', data: result.candidateB, highlight: result.recommendation === 'B' },
                  ] as const).map(({ label, data, highlight }) => (
                    <div
                      key={label}
                      className={cn(
                        'rounded-xl border p-4 space-y-3',
                        highlight ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/8 bg-white/3',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Candidate {label}</p>
                          <p className="text-xs font-semibold text-white mt-0.5">{data.name}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {data.cqi_score !== null && (
                            <span className="text-xs font-bold text-indigo-300">CQI {data.cqi_score}</span>
                          )}
                          {highlight && result.recommendation !== 'tie' && (
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.5 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {data.strengths.map((s, i) => (
                          <div key={i} className="flex gap-2 text-xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="text-slate-300">{s}</span>
                          </div>
                        ))}
                        {data.weaknesses.map((w, i) => (
                          <div key={i} className="flex gap-2 text-xs">
                            <XCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                            <span className="text-slate-400">{w}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-white/8 flex justify-between items-center">
            {step === 'result' ? (
              <>
                <button
                  onClick={() => { setStep('pick'); setResult(null) }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Compare different candidate
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:border-white/20 hover:text-white transition-colors"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompare}
                  disabled={!targetId || loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Comparing…' : 'Compare'}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
