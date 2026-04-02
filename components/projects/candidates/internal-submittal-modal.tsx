'use client'

import { useState, useEffect } from 'react'
import { X, Copy, Check, Loader2, RefreshCw, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { BreakdownJson } from '@/types/database'
import { cn } from '@/lib/utils'

interface Props {
  open:        boolean
  candidate:   CandidateRow | null
  project:     { id: string; title: string; client_name: string; jd_text: string | null }
  onClose:     () => void
  onStageMove: (candidateId: string) => void
}

// Parse "- **Label** — Body" lines into structured bullets
function parseBullets(text: string): Array<{ label: string; body: string }> {
  const lines = text.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'))
  return lines.map(line => {
    const match = line.match(/^[-•*]\s*\*\*(.+?)\*\*\s*(?:—|-{1,2})\s*(.*)$/)
    if (match) return { label: match[1].trim(), body: match[2].trim() }
    // Fallback: strip leading dash, use full line as body
    return { label: '', body: line.replace(/^[-•*]\s*/, '').trim() }
  })
}

export function InternalSubmittalModal({ open, candidate, project, onClose, onStageMove }: Props) {
  const [submittal,  setSubmittal]  = useState('')
  const [loading,    setLoading]    = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [moving,     setMoving]     = useState(false)
  const [payMin,     setPayMin]     = useState('')
  const [payMax,     setPayMax]     = useState('')

  // Regenerate whenever modal opens or candidate changes
  useEffect(() => {
    if (open && candidate) {
      setSubmittal('')
      generate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidate?.id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  async function generate() {
    if (!candidate) return
    setLoading(true)
    setSubmittal('')
    try {
      const breakdown = candidate.cqi_breakdown_json as BreakdownJson | null
      const res = await fetch('/api/generate-internal-submittal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          candidate_id:   candidate.id,
          project_id:     project.id,
          resume_text:    candidate.resume_text,
          jd_text:        project.jd_text,
          cqi_score:      candidate.cqi_score,
          cqi_breakdown:  breakdown,
          pay_rate_min:   payMin ? Number(payMin) : null,
          pay_rate_max:   payMax ? Number(payMax) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Generation failed')
        return
      }
      setSubmittal(data.submittal ?? '')
    } catch {
      toast.error('Generation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    const plain = submittal.replace(/\*\*/g, '').trim()
    await navigator.clipboard.writeText(plain)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleMoveToSubmittal() {
    if (!candidate) return
    setMoving(true)
    try {
      const res = await fetch(
        `/api/projects/${project.id}/candidates/${candidate.id}/stage`,
        {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ stage: 'internal_submittal' }),
        },
      )
      if (!res.ok) { toast.error('Failed to update stage'); return }
      onStageMove(candidate.id)
      toast.success('Moved to Internal Submittal')
      onClose()
    } catch {
      toast.error('Failed to update stage')
    } finally {
      setMoving(false)
    }
  }

  const bullets = submittal ? parseBullets(submittal) : []

  return (
    <AnimatePresence>
      {open && candidate && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.97,  y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full max-w-[600px] bg-[#0D0F1A] border border-white/12 rounded-2xl shadow-2xl flex flex-col max-h-[88vh]">

              {/* ── Document Header ─────────────────────────────── */}
              <div className="px-7 pt-6 pb-4 border-b border-white/8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400 mb-1">
                      Internal Submittal
                    </p>
                    <h2 className="text-base font-semibold text-white leading-snug">
                      {candidate.candidate_name}
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {project.title} — {project.client_name}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors shrink-0 mt-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Rate inputs — optional, affects bullet 4 */}
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-xs text-slate-500 shrink-0">Rate (W2/hr):</span>
                  <input
                    type="number"
                    placeholder="Min"
                    value={payMin}
                    onChange={e => setPayMin(e.target.value)}
                    className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40"
                  />
                  <span className="text-xs text-slate-600">–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={payMax}
                    onChange={e => setPayMax(e.target.value)}
                    className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40"
                  />
                  <span className="text-xs text-slate-600 ml-0.5">optional</span>
                </div>
              </div>

              {/* ── Document Body ────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-7 py-6">
                {loading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                    <p className="text-sm text-slate-500">Cortex is writing your submittal...</p>
                  </div>
                )}

                {!loading && bullets.length > 0 && (
                  <div className="space-y-0">
                    {bullets.map((bullet, i) => (
                      <div key={i}>
                        <div className="py-4">
                          {bullet.label ? (
                            <>
                              <p className="text-sm font-semibold text-white leading-snug mb-1.5">
                                {bullet.label}
                              </p>
                              <p className="text-sm text-slate-400 leading-relaxed">
                                {bullet.body}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-slate-400 leading-relaxed">
                              {bullet.body}
                            </p>
                          )}
                        </div>
                        {i < bullets.length - 1 && (
                          <div className="border-t border-white/6" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!loading && !submittal && (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-sm text-slate-600">No output yet.</p>
                  </div>
                )}
              </div>

              {/* ── Action Bar ───────────────────────────────────── */}
              <div className="px-7 py-4 border-t border-white/8 flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!submittal || loading}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40',
                    copied
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : 'text-slate-300 bg-white/5 border-white/10 hover:border-white/20 hover:text-white',
                  )}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>

                <button
                  onClick={generate}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 bg-white/5 border border-white/10 hover:border-white/20 hover:text-slate-200 transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                  Regenerate
                </button>

                <div className="flex-1" />

                <button
                  onClick={handleMoveToSubmittal}
                  disabled={!submittal || loading || moving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 transition-colors disabled:opacity-40"
                >
                  {moving
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <ArrowRight className="w-3.5 h-3.5" />
                  }
                  Move to Internal Submittal
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
