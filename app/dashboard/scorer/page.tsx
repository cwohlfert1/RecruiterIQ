'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileSearch, Loader2, RefreshCw, ShieldAlert, AlertTriangle, CheckCircle2, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { UpgradeModal } from '@/components/upgrade-modal'
import { FileDropTextarea } from '@/components/ui/file-drop-textarea'
import { cn } from '@/lib/utils'
import type { RedFlag } from '@/types/database'

// ─── Shared types ──────────────────────────────────────────

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

interface RedFlagResult {
  integrity_score: number
  flags:           RedFlag[]
  summary:         string
  recommendation:  'proceed' | 'caution' | 'pass'
}

// ─── Helpers ───────────────────────────────────────────────

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

// ─── CountUpNumber ─────────────────────────────────────────

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

// ─── ScoreRing ─────────────────────────────────────────────

function ScoreRing({ score, size = 160, label }: { score: number; size?: number; label?: string }) {
  const radius        = 58
  const circumference = 2 * Math.PI * radius
  const strokeWidth   = 10
  const center        = size / 2
  const color         = getScoreColor(score)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={center} cy={center} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={circumference}
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
      {label && <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>}
    </div>
  )
}

// ─── WordCounter ───────────────────────────────────────────

function WordCounter({ count, max }: { count: number; max: number }) {
  const pct      = count / max
  const colorCls = pct >= 1 ? 'text-red-400' : pct >= 0.8 ? 'text-yellow-400' : 'text-slate-500'
  return (
    <span className={cn('text-xs', colorCls)}>
      {count.toLocaleString()} / {max.toLocaleString()} words
    </span>
  )
}

// ─── LoadingSkeleton ───────────────────────────────────────

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

function RedFlagLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="w-36 h-36 rounded-full bg-white/8 mx-auto" />
      <div className="h-3 bg-white/8 rounded w-1/3 mx-auto" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/8 space-y-2">
          <div className="h-3 bg-white/8 rounded w-1/4" />
          <div className="h-2 bg-white/6 rounded w-full" />
          <div className="h-2 bg-white/6 rounded w-3/4" />
        </div>
      ))}
    </div>
  )
}

// ─── Category rows config ──────────────────────────────────

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

// ─── Red Flag helpers ──────────────────────────────────────

const SEVERITY_CONFIG = {
  high:   { label: 'High',   dot: '🔴', cls: 'bg-red-500/15 text-red-400 border-red-500/25'      },
  medium: { label: 'Medium', dot: '🟡', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  low:    { label: 'Low',    dot: '🟢', cls: 'bg-green-500/15 text-green-400 border-green-500/25'  },
}

const RECOMMENDATION_CONFIG = {
  proceed: {
    label: 'Proceed',
    desc:  'No major concerns — move forward with confidence.',
    icon:  <CheckCircle2 className="w-5 h-5 text-green-400" />,
    cls:   'bg-green-500/10 border-green-500/25 text-green-400',
  },
  caution: {
    label: 'Ask About These Flags',
    desc:  'Worth a phone call to clarify before moving forward.',
    icon:  <AlertTriangle className="w-5 h-5 text-yellow-400" />,
    cls:   'bg-yellow-500/10 border-yellow-500/25 text-yellow-400',
  },
  pass: {
    label: 'Consider Passing',
    desc:  'Multiple integrity concerns — proceed with significant caution.',
    icon:  <Minus className="w-5 h-5 text-red-400" />,
    cls:   'bg-red-500/10 border-red-500/25 text-red-400',
  },
}

// ─── Main page ─────────────────────────────────────────────

export default function ScorerPage() {
  const [activeTab, setActiveTab] = useState<'score' | 'redflag'>('score')

  // — Score tab state —
  const [jdText,       setJdText]       = useState('')
  const [resumeText,   setResumeText]   = useState('')
  const [isLoading,    setIsLoading]    = useState(false)
  const [result,       setResult]       = useState<ScoreResult | null>(null)
  const [errors,       setErrors]       = useState<{ jd?: string; resume?: string }>({})

  // — Red Flag tab state —
  const [rfResumeText, setRfResumeText] = useState('')
  const [rfJdText,     setRfJdText]     = useState('')
  const [rfLoading,    setRfLoading]    = useState(false)
  const [rfResult,     setRfResult]     = useState<RedFlagResult | null>(null)
  const [rfErrors,     setRfErrors]     = useState<{ resume?: string }>({})

  // — Shared upgrade modal —
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeReason,    setUpgradeReason]    = useState<'limit_reached' | 'plan_required'>('limit_reached')
  const [upgradePlan,      setUpgradePlan]      = useState<'pro' | 'agency' | undefined>(undefined)

  // ─── Score tab handlers ─────────────────────────────────

  const jdWords     = wordCount(jdText)
  const resumeWords = wordCount(resumeText)

  async function handleScoreSubmit() {
    const newErrors: { jd?: string; resume?: string } = {}
    if (!jdText.trim())     newErrors.jd     = 'Job description is required'
    if (!resumeText.trim()) newErrors.resume  = 'Resume text is required'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
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
        if (data.error === 'limit_reached')  { setUpgradeReason('limit_reached'); setUpgradePlan(undefined); setShowUpgradeModal(true) }
        else if (data.error === 'plan_required') { setUpgradeReason('plan_required'); setUpgradePlan('pro'); setShowUpgradeModal(true) }
        else toast.error('Access denied. Please check your plan.')
        setIsLoading(false)
        return
      }

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        toast.error(data.error ?? 'Something went wrong. Please try again.')
        setIsLoading(false)
        return
      }

      setResult(await res.json() as ScoreResult)
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleScoreAnother() {
    setResult(null); setJdText(''); setResumeText(''); setErrors({})
  }

  // ─── Red Flag tab handlers ──────────────────────────────

  const rfResumeWords = wordCount(rfResumeText)
  const rfJdWords     = wordCount(rfJdText)

  async function handleRedFlagSubmit() {
    if (!rfResumeText.trim()) { setRfErrors({ resume: 'Resume text is required' }); return }
    setRfErrors({})
    setRfLoading(true)
    setRfResult(null)

    try {
      const res = await fetch('/api/analyze-red-flags', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ resume_text: rfResumeText, jd_text: rfJdText || undefined }),
      })

      if (res.status === 403) {
        const data = await res.json() as { error: string }
        if (data.error === 'limit_reached')      { setUpgradeReason('limit_reached'); setUpgradePlan(undefined); setShowUpgradeModal(true) }
        else if (data.error === 'plan_required') { setUpgradeReason('plan_required'); setUpgradePlan('pro'); setShowUpgradeModal(true) }
        else toast.error('Access denied. Please check your plan.')
        setRfLoading(false)
        return
      }

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        toast.error(data.error ?? 'Something went wrong. Please try again.')
        setRfLoading(false)
        return
      }

      setRfResult(await res.json() as RedFlagResult)
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setRfLoading(false)
    }
  }

  function handleCheckAnother() {
    setRfResult(null); setRfResumeText(''); setRfJdText(''); setRfErrors({})
  }

  // ─── Render ─────────────────────────────────────────────

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold gradient-text mb-1">Resume Scorer</h1>
          <p className="text-slate-400 text-sm">
            AI-powered resume analysis to help you make faster, better hiring decisions.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 glass rounded-xl mb-6 w-fit">
          <button
            onClick={() => setActiveTab('score')}
            className={cn(
              'flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-150',
              activeTab === 'score'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
            )}
          >
            <FileSearch className="w-4 h-4" />
            Score Resume
          </button>
          <button
            onClick={() => setActiveTab('redflag')}
            className={cn(
              'flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-150',
              activeTab === 'redflag'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
            )}
          >
            <ShieldAlert className="w-4 h-4" />
            Red Flag Check
          </button>
        </div>

        <AnimatePresence mode="wait">

          {/* ══ TAB 1: SCORE RESUME ══ */}
          {activeTab === 'score' && (
            <motion.div
              key="score"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left: Inputs */}
                <div className="glass-card rounded-2xl p-6 space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="jd-input" className="text-sm font-medium text-slate-300">
                        Job Description <span className="text-red-400 ml-0.5">*</span>
                      </label>
                      <WordCounter count={jdWords} max={2000} />
                    </div>
                    <FileDropTextarea
                      id="jd-input"
                      value={jdText}
                      onChange={v => { setJdText(v); if (errors.jd) setErrors(p => ({ ...p, jd: undefined })) }}
                      placeholder="Paste or drag-and-drop the job description here…"
                      rows={10}
                      error={errors.jd}
                      minHeight="200px"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="resume-input" className="text-sm font-medium text-slate-300">
                        Resume <span className="text-red-400 ml-0.5">*</span>
                      </label>
                      <WordCounter count={resumeWords} max={5000} />
                    </div>
                    <FileDropTextarea
                      id="resume-input"
                      value={resumeText}
                      onChange={v => { setResumeText(v); if (errors.resume) setErrors(p => ({ ...p, resume: undefined })) }}
                      placeholder="Paste or drag-and-drop the candidate's resume here…"
                      rows={14}
                      error={errors.resume}
                      minHeight="280px"
                    />
                  </div>

                  <button
                    onClick={handleScoreSubmit}
                    disabled={isLoading}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl',
                      'text-sm font-semibold text-white transition-all duration-150',
                      'bg-gradient-to-r from-indigo-500 to-violet-500',
                      'hover:from-indigo-400 hover:to-violet-400 hover:shadow-lg hover:shadow-indigo-500/25',
                      'disabled:opacity-60 disabled:cursor-not-allowed',
                    )}
                  >
                    {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> : <><FileSearch className="w-4 h-4" /> Score Resume</>}
                  </button>
                </div>

                {/* Right: Results */}
                <div className="glass-card rounded-2xl p-6 min-h-[400px] flex flex-col">
                  {!isLoading && !result && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                        <FileSearch className="w-7 h-7 text-slate-500" />
                      </div>
                      <p className="text-slate-500 text-sm">Your score will appear here after analysis.</p>
                    </div>
                  )}

                  {isLoading && !result && (
                    <div className="flex-1 flex flex-col justify-center py-4"><LoadingSkeleton /></div>
                  )}

                  <AnimatePresence>
                    {result && !isLoading && (
                      <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.4 }}
                        className="flex flex-col gap-6"
                      >
                        {result.job_title && (
                          <p className="text-xs text-slate-400 text-center tracking-wide uppercase">{result.job_title}</p>
                        )}

                        <div className="flex flex-col items-center gap-2">
                          <ScoreRing score={result.score} size={160} />
                          <span className={cn('text-xs font-bold tracking-widest mt-1', getScoreLabelColor(result.score))}>
                            {getScoreLabel(result.score)}
                          </span>
                        </div>

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
                                    <span className="text-xs font-semibold text-white tabular-nums w-6 text-right">{cat.score}</span>
                                  </div>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                                  <motion.div
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: color }}
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${cat.score}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 * idx }}
                                  />
                                </div>
                                <p className="text-xs italic text-slate-400 leading-relaxed">{cat.explanation}</p>
                              </div>
                            )
                          })}
                        </div>

                        <button
                          onClick={handleScoreAnother}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:bg-white/5 hover:text-white hover:border-white/20 transition-all duration-150"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Score Another Resume
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ TAB 2: RED FLAG CHECK ══ */}
          {activeTab === 'redflag' && (
            <motion.div
              key="redflag"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left: Inputs */}
                <div className="glass-card rounded-2xl p-6 space-y-6">
                  <div>
                    <h2 className="text-sm font-semibold text-white mb-0.5">Resume Red Flag Check</h2>
                    <p className="text-xs text-slate-400">Claude scans for employment gaps, vague claims, inconsistencies, and more.</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="rf-resume" className="text-sm font-medium text-slate-300">
                        Resume <span className="text-red-400 ml-0.5">*</span>
                      </label>
                      <WordCounter count={rfResumeWords} max={5000} />
                    </div>
                    <FileDropTextarea
                      id="rf-resume"
                      value={rfResumeText}
                      onChange={v => { setRfResumeText(v); if (rfErrors.resume) setRfErrors({}) }}
                      placeholder="Paste or drag-and-drop the candidate's resume here…"
                      rows={14}
                      error={rfErrors.resume}
                      minHeight="280px"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="rf-jd" className="text-sm font-medium text-slate-300">
                        Job Description
                        <span className="text-slate-500 text-xs font-normal ml-1">(optional — helps detect skill mismatches)</span>
                      </label>
                      <WordCounter count={rfJdWords} max={2000} />
                    </div>
                    <FileDropTextarea
                      id="rf-jd"
                      value={rfJdText}
                      onChange={setRfJdText}
                      placeholder="Paste or drag-and-drop the job description to detect catfish signals…"
                      rows={6}
                      minHeight="160px"
                    />
                  </div>

                  <button
                    onClick={handleRedFlagSubmit}
                    disabled={rfLoading}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl',
                      'text-sm font-semibold text-white transition-all duration-150',
                      'bg-gradient-to-r from-red-500 to-rose-500',
                      'hover:from-red-400 hover:to-rose-400 hover:shadow-lg hover:shadow-red-500/25',
                      'disabled:opacity-60 disabled:cursor-not-allowed',
                    )}
                  >
                    {rfLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                      : <><ShieldAlert className="w-4 h-4" /> Analyze for Red Flags</>
                    }
                  </button>
                </div>

                {/* Right: Results */}
                <div className="glass-card rounded-2xl p-6 min-h-[400px] flex flex-col">
                  {!rfLoading && !rfResult && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                        <ShieldAlert className="w-7 h-7 text-slate-500" />
                      </div>
                      <p className="text-slate-500 text-sm">Your integrity report will appear here.</p>
                    </div>
                  )}

                  {rfLoading && !rfResult && (
                    <div className="flex-1 flex flex-col justify-center py-4"><RedFlagLoadingSkeleton /></div>
                  )}

                  <AnimatePresence>
                    {rfResult && !rfLoading && (
                      <motion.div
                        key="rf-results"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.4 }}
                        className="flex flex-col gap-5"
                      >
                        {/* Integrity score ring */}
                        <div className="flex flex-col items-center gap-1">
                          <ScoreRing score={rfResult.integrity_score} size={144} label="Resume Integrity Score" />
                        </div>

                        {/* Flags */}
                        {rfResult.flags.length === 0 ? (
                          <div className="flex flex-col items-center gap-2 py-4 text-center">
                            <CheckCircle2 className="w-8 h-8 text-green-400" />
                            <p className="text-sm font-medium text-green-400">No red flags detected</p>
                            <p className="text-xs text-slate-500">This resume looks clean. Proceed with confidence.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                              {rfResult.flags.length} flag{rfResult.flags.length !== 1 ? 's' : ''} detected
                            </p>
                            {rfResult.flags.map((flag, i) => {
                              const sev = SEVERITY_CONFIG[flag.severity]
                              return (
                                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/8 space-y-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn(
                                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                                      sev.cls,
                                    )}>
                                      {sev.dot} {sev.label}
                                    </span>
                                    <span className="text-sm font-medium text-white">{flag.type}</span>
                                  </div>
                                  <p className="text-xs text-slate-300 leading-relaxed">
                                    <span className="text-slate-500">Evidence: </span>
                                    {flag.evidence}
                                  </p>
                                  <p className="text-xs text-slate-400 italic leading-relaxed">{flag.explanation}</p>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Summary + recommendation */}
                        <div className="space-y-3 pt-1 border-t border-white/8">
                          <p className="text-sm text-slate-300 leading-relaxed">{rfResult.summary}</p>
                          {(() => {
                            const rec = RECOMMENDATION_CONFIG[rfResult.recommendation]
                            return (
                              <div className={cn('flex items-center gap-3 p-3 rounded-xl border', rec.cls)}>
                                {rec.icon}
                                <div>
                                  <p className="text-sm font-semibold">{rec.label}</p>
                                  <p className="text-xs opacity-80">{rec.desc}</p>
                                </div>
                              </div>
                            )
                          })()}
                        </div>

                        <button
                          onClick={handleCheckAnother}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:bg-white/5 hover:text-white hover:border-white/20 transition-all duration-150"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Check Another Resume
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason={upgradeReason}
        requiredPlan={upgradePlan}
      />
    </>
  )
}
