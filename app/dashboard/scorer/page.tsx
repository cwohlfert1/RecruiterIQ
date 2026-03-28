'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileSearch, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { UpgradeModal } from '@/components/upgrade-modal'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────

interface BreakdownCategoryResult {
  score:       number
  weight:      number
  weighted:    number
  explanation: string
}

interface ScoreResult {
  score:     number
  job_title: string
  record_id: string
  breakdown: {
    must_have_skills:  BreakdownCategoryResult
    domain_experience: BreakdownCategoryResult
    communication:     BreakdownCategoryResult
    tenure_stability:  BreakdownCategoryResult
    tool_depth:        BreakdownCategoryResult
  }
}

// ─── Helpers ──────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22C55E'
  if (score >= 60) return '#EAB308'
  return '#EF4444'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'STRONG MATCH'
  if (score >= 60) return 'PARTIAL MATCH'
  return 'WEAK MATCH'
}

function getScoreLabelColor(score: number): string {
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

// ─── CountUpNumber ────────────────────────────────────────

function CountUpNumber({ target, className }: { target: number; className?: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const start    = Date.now()
    const duration = 1000
    let raf: number

    const tick = () => {
      const elapsed  = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return <span className={className}>{count}</span>
}

// ─── ScoreRing ────────────────────────────────────────────

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const radius        = 58
  const circumference = 2 * Math.PI * radius
  const strokeWidth   = 10
  const center        = size / 2
  const color         = getScoreColor(score)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUpNumber target={score} className="text-4xl font-semibold text-white tabular-nums" />
        <span className="text-xs text-slate-500 mt-0.5">/ 100</span>
      </div>
    </div>
  )
}

// ─── WordCounter ──────────────────────────────────────────

function WordCounter({ count, max }: { count: number; max: number }) {
  const pct      = count / max
  const colorCls = pct >= 1 ? 'text-red-400' : pct >= 0.8 ? 'text-yellow-400' : 'text-slate-500'

  return (
    <span className={cn('text-xs', colorCls)}>
      {count.toLocaleString()} / {max.toLocaleString()} words
    </span>
  )
}

// ─── LoadingSkeleton ──────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="w-40 h-40 rounded-full bg-white/8 mx-auto" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 bg-white/8 rounded w-3/4" />
          <div className="h-2 bg-white/6 rounded w-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Category rows config ─────────────────────────────────

const CATEGORIES: Array<{
  key:    keyof ScoreResult['breakdown']
  label:  string
  weight: string
}> = [
  { key: 'must_have_skills',  label: 'Must-Have Skills',  weight: '40%' },
  { key: 'domain_experience', label: 'Domain Experience', weight: '20%' },
  { key: 'communication',     label: 'Communication',     weight: '15%' },
  { key: 'tenure_stability',  label: 'Tenure Stability',  weight: '10%' },
  { key: 'tool_depth',        label: 'Tool Depth',        weight: '15%' },
]

// ─── Main page ────────────────────────────────────────────

export default function ScorerPage() {
  const [jdText,           setJdText]           = useState('')
  const [resumeText,       setResumeText]        = useState('')
  const [isLoading,        setIsLoading]         = useState(false)
  const [result,           setResult]            = useState<ScoreResult | null>(null)
  const [showUpgradeModal, setShowUpgradeModal]  = useState(false)
  const [upgradeReason,    setUpgradeReason]     = useState<'limit_reached' | 'plan_required'>('limit_reached')
  const [upgradePlan,      setUpgradePlan]       = useState<'pro' | 'agency' | undefined>(undefined)
  const [errors,           setErrors]            = useState<{ jd?: string; resume?: string }>({})

  const jdWords     = wordCount(jdText)
  const resumeWords = wordCount(resumeText)

  async function handleSubmit() {
    const newErrors: { jd?: string; resume?: string } = {}
    if (!jdText.trim())     newErrors.jd     = 'Job description is required'
    if (!resumeText.trim()) newErrors.resume  = 'Resume text is required'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    setIsLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/score-resume', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jd_text: jdText, resume_text: resumeText }),
      })

      if (res.status === 403) {
        const data = await res.json() as { error: string }
        if (data.error === 'limit_reached') {
          setUpgradeReason('limit_reached')
          setUpgradePlan(undefined)
          setShowUpgradeModal(true)
        } else if (data.error === 'plan_required') {
          setUpgradeReason('plan_required')
          setUpgradePlan('pro')
          setShowUpgradeModal(true)
        } else {
          toast.error('Access denied. Please check your plan.')
        }
        setIsLoading(false)
        return
      }

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        toast.error(data.error ?? 'Something went wrong. Please try again.')
        setIsLoading(false)
        return
      }

      const data = await res.json() as ScoreResult
      setResult(data)
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleScoreAnother() {
    setResult(null)
    setJdText('')
    setResumeText('')
    setErrors({})
  }

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-1">Resume Scorer</h1>
          <p className="text-slate-400 text-sm">
            Paste a job description and resume to get an AI-powered match score with detailed breakdown.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ── Left panel: Inputs ─────────────────────────── */}
          <div className="glass-card rounded-2xl p-6 space-y-6">
            {/* Job Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="jd-input" className="text-sm font-medium text-slate-300">
                  Job Description
                  <span className="text-red-400 ml-0.5">*</span>
                </label>
                <WordCounter count={jdWords} max={2000} />
              </div>
              <textarea
                id="jd-input"
                value={jdText}
                onChange={e => {
                  setJdText(e.target.value)
                  if (errors.jd) setErrors(prev => ({ ...prev, jd: undefined }))
                }}
                placeholder="Paste the job description here…"
                rows={10}
                className={cn(
                  'w-full resize-none rounded-xl bg-white/5 border px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
                  errors.jd
                    ? 'border-red-500/60'
                    : jdWords >= 2000
                    ? 'border-red-500/40'
                    : jdWords >= 1600
                    ? 'border-yellow-500/40'
                    : 'border-white/10'
                )}
              />
              {errors.jd && (
                <p className="text-xs text-red-400">{errors.jd}</p>
              )}
            </div>

            {/* Resume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="resume-input" className="text-sm font-medium text-slate-300">
                  Resume
                  <span className="text-red-400 ml-0.5">*</span>
                </label>
                <WordCounter count={resumeWords} max={5000} />
              </div>
              <textarea
                id="resume-input"
                value={resumeText}
                onChange={e => {
                  setResumeText(e.target.value)
                  if (errors.resume) setErrors(prev => ({ ...prev, resume: undefined }))
                }}
                placeholder="Paste the candidate's resume here…"
                rows={14}
                className={cn(
                  'w-full resize-none rounded-xl bg-white/5 border px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
                  errors.resume
                    ? 'border-red-500/60'
                    : resumeWords >= 5000
                    ? 'border-red-500/40'
                    : resumeWords >= 4000
                    ? 'border-yellow-500/40'
                    : 'border-white/10'
                )}
              />
              {errors.resume && (
                <p className="text-xs text-red-400">{errors.resume}</p>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl',
                'text-sm font-semibold text-white transition-all duration-150',
                'bg-gradient-to-r from-indigo-500 to-violet-500',
                'hover:from-indigo-400 hover:to-violet-400 hover:shadow-lg hover:shadow-indigo-500/25',
                'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:from-indigo-500 disabled:hover:to-violet-500'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <FileSearch className="w-4 h-4" />
                  Score Resume
                </>
              )}
            </button>
          </div>

          {/* ── Right panel: Results ───────────────────────── */}
          <div className="glass-card rounded-2xl p-6 min-h-[400px] flex flex-col">
            {/* Empty state */}
            {!isLoading && !result && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <FileSearch className="w-7 h-7 text-slate-500" />
                </div>
                <p className="text-slate-500 text-sm">
                  Your score will appear here after analysis.
                </p>
              </div>
            )}

            {/* Loading skeleton */}
            {isLoading && !result && (
              <div className="flex-1 flex flex-col justify-center py-4">
                <LoadingSkeleton />
              </div>
            )}

            {/* Results */}
            <AnimatePresence>
              {result && !isLoading && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0  }}
                  exit={{   opacity: 0, y: 20  }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-6"
                >
                  {/* Job title if present */}
                  {result.job_title && (
                    <p className="text-xs text-slate-400 text-center tracking-wide uppercase">
                      {result.job_title}
                    </p>
                  )}

                  {/* Score ring */}
                  <div className="flex flex-col items-center gap-2">
                    <ScoreRing score={result.score} size={160} />
                    <span className={cn('text-xs font-bold tracking-widest mt-1', getScoreLabelColor(result.score))}>
                      {getScoreLabel(result.score)}
                    </span>
                  </div>

                  {/* Category breakdown */}
                  <div className="space-y-4">
                    {CATEGORIES.map(({ key, label, weight }, idx) => {
                      const cat   = result.breakdown[key]
                      const color = getScoreColor(cat.score)

                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-300">{label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">{weight}</span>
                              <span className="text-xs font-semibold text-white tabular-nums w-6 text-right">
                                {cat.score}
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: color }}
                              initial={{ width: '0%' }}
                              animate={{ width: `${cat.score}%` }}
                              transition={{
                                duration: 0.8,
                                ease:     'easeOut',
                                delay:    0.1 * idx,
                              }}
                            />
                          </div>

                          {/* Explanation */}
                          <p className="text-xs italic text-slate-400 leading-relaxed">
                            {cat.explanation}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  {/* Score Another button */}
                  <button
                    onClick={handleScoreAnother}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl',
                      'text-sm font-medium text-slate-300 border border-white/10',
                      'hover:bg-white/5 hover:text-white hover:border-white/20 transition-all duration-150'
                    )}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Score Another Resume
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Upgrade modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason={upgradeReason}
        requiredPlan={upgradePlan}
      />
    </>
  )
}
