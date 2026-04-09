'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, X, Loader2, Copy, Check, Plus, FileText, PenLine, Sparkles,
  Target, Globe, ChevronDown, ChevronUp, SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { FileDropTextarea } from '@/components/ui/file-drop-textarea'
import { UpgradeModal } from '@/components/upgrade-modal'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────

type InputMode       = 'jd' | 'manual'
type GenerateStatus  = 'idle' | 'generating' | 'complete' | 'error'
type ActiveVariant   = 'targeted' | 'balanced' | 'broad'
type FeedbackBucket  = '< 100' | '100-500' | '500-2000' | '2000+'

interface GateErrorBody {
  error:     string
  reason:    'unauthenticated' | 'limit_reached' | 'plan_required'
  planTier?: 'free' | 'pro' | 'agency'
}

interface VariantStrings {
  linkedin_string: string
  indeed_string:   string
  volume_estimate?: string
}

interface GenerateResult {
  extracted_title?:  string
  extracted_skills?: string[]
  targeted:  VariantStrings
  balanced:  VariantStrings
  broad:     VariantStrings
}

// ─── Syntax-highlighted Boolean output ───────────────────

function HighlightedBoolean({ text }: { text: string }) {
  const segments: Array<{ type: 'operator' | 'quoted' | 'paren' | 'plain'; value: string }> = []
  let remaining = text

  while (remaining.length > 0) {
    const quotedMatch = remaining.match(/^("(?:[^"\\]|\\.)*")/)
    if (quotedMatch) {
      segments.push({ type: 'quoted', value: quotedMatch[1] })
      remaining = remaining.slice(quotedMatch[1].length)
      continue
    }
    const opMatch = remaining.match(/^(AND|OR|NOT)(?=\s|$|\()/)
    if (opMatch) {
      segments.push({ type: 'operator', value: opMatch[1] })
      remaining = remaining.slice(opMatch[1].length)
      continue
    }
    if (remaining[0] === '(' || remaining[0] === ')') {
      segments.push({ type: 'paren', value: remaining[0] })
      remaining = remaining.slice(1)
      continue
    }
    const plainMatch = remaining.match(/^[^"()A-Z]+|^[A-Z][^"()A-Z\s]*/)
    if (plainMatch) {
      segments.push({ type: 'plain', value: plainMatch[0] })
      remaining = remaining.slice(plainMatch[0].length)
      continue
    }
    segments.push({ type: 'plain', value: remaining[0] })
    remaining = remaining.slice(1)
  }

  return (
    <span className="font-mono text-sm leading-relaxed break-words">
      {segments.map((seg, i) => {
        if (seg.type === 'operator') return <span key={i} className="text-indigo-400 font-semibold">{seg.value}</span>
        if (seg.type === 'quoted')   return <span key={i} className="text-emerald-400">{seg.value}</span>
        if (seg.type === 'paren')    return <span key={i} className="text-slate-400">{seg.value}</span>
        return <span key={i} className="text-slate-200">{seg.value}</span>
      })}
    </span>
  )
}

// ─── Copy button ──────────────────────────────────────────

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }
  return (
    <button
      onClick={handleCopy}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
        'border border-white/10',
        copied
          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
          : 'bg-white/5 text-slate-300 hover:bg-white/8 hover:text-white hover:border-white/20',
      )}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : (label ?? 'Copy')}
    </button>
  )
}

// ─── String display card ──────────────────────────────────

function StringCard({ platform, emoji, string }: { platform: string; emoji: string; string: string }) {
  return (
    <div className="rounded-xl bg-white/3 border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <span className="text-xs font-semibold text-slate-300">{platform}</span>
        </div>
        <CopyBtn text={string} />
      </div>
      <div className="px-4 py-3 bg-[#0D0F1A]">
        <HighlightedBoolean text={string} />
      </div>
    </div>
  )
}

// ─── Feedback panel ───────────────────────────────────────

const FEEDBACK_OPTIONS: { label: string; value: FeedbackBucket; hint: string }[] = [
  { label: '< 100',      value: '< 100',    hint: 'Too few — needs loosening'    },
  { label: '100–500',    value: '100-500',  hint: 'Targeted sweet spot'          },
  { label: '500–2,000',  value: '500-2000', hint: 'Broad sweet spot'             },
  { label: '2,000+',     value: '2000+',    hint: 'Too many — needs tightening'  },
]

interface FeedbackPanelProps {
  variantType:      ActiveVariant
  currentLinkedin:  string
  currentIndeed:    string
  jobTitle:         string
  jdText:           string
  refinementCount:  number
  onRefined: (linkedin: string, indeed: string, newCount: number) => void
}

function FeedbackPanel({
  variantType, currentLinkedin, currentIndeed, jobTitle, jdText, refinementCount, onRefined,
}: FeedbackPanelProps) {
  const [selected,     setSelected]     = useState<FeedbackBucket | null>(null)
  const [refining,     setRefining]     = useState(false)
  const [explanation,  setExplanation]  = useState<string | null>(null)
  const [confirmed,    setConfirmed]    = useState(false)
  const [showPrev,     setShowPrev]     = useState(false)
  const [prevLinkedin, setPrevLinkedin] = useState<string | null>(null)

  async function handleFeedback(bucket: FeedbackBucket) {
    if (refining) return
    setSelected(bucket)
    setRefining(true)
    setExplanation(null)
    setConfirmed(false)

    try {
      const res = await fetch('/api/boolean/refine', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          variant_type:     variantType,
          feedback:         bucket,
          current_linkedin: currentLinkedin,
          current_indeed:   currentIndeed,
          job_title:        jobTitle,
          jd_text:          jdText,
          refinement_count: refinementCount,
        }),
      })
      const data = await res.json() as {
        limited?: boolean; message?: string
        confirmed?: boolean; explanation?: string
        linkedin_string?: string; indeed_string?: string; refinement_count?: number
        error?: string
      }

      if (data.limited) {
        toast.error(data.message ?? 'Max refinements reached.')
        setSelected(null)
        setRefining(false)
        return
      }
      if (data.confirmed) {
        setConfirmed(true)
        setExplanation(data.explanation ?? null)
        setRefining(false)
        return
      }
      if (data.linkedin_string && data.indeed_string) {
        setPrevLinkedin(currentLinkedin)
        onRefined(data.linkedin_string, data.indeed_string, data.refinement_count ?? refinementCount + 1)
        setExplanation(data.explanation ?? null)
      } else {
        toast.error(data.error ?? 'Refinement failed')
        setSelected(null)
      }
    } catch {
      toast.error('Network error. Please try again.')
      setSelected(null)
    } finally {
      setRefining(false)
    }
  }

  const maxed = refinementCount >= 3

  return (
    <div className="mt-4 pt-4 border-t border-white/8 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-400">
          How many results did this return?
        </p>
        {refinementCount > 0 && (
          <span className="text-xs text-slate-600">{refinementCount}/3 refinements used</span>
        )}
      </div>

      {maxed ? (
        <p className="text-xs text-amber-400/80">
          Maximum refinements reached. Generate a new search to start fresh.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleFeedback(opt.value)}
              disabled={refining}
              title={opt.hint}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                selected === opt.value && refining
                  ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/8 hover:text-slate-200 hover:border-white/20',
              )}
            >
              {selected === opt.value && refining ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {opt.label}
                </span>
              ) : opt.label}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {(explanation || confirmed) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'rounded-xl px-4 py-3 text-xs leading-relaxed',
              confirmed
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-200',
            )}
          >
            <span className="font-semibold">{confirmed ? 'Confirmed optimal. ' : 'Refined. '}</span>
            {explanation}
          </motion.div>
        )}
      </AnimatePresence>

      {prevLinkedin && (
        <button
          onClick={() => setShowPrev(v => !v)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400 transition-colors"
        >
          {showPrev ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showPrev ? 'Hide' : 'Show'} previous string
        </button>
      )}

      <AnimatePresence>
        {showPrev && prevLinkedin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl bg-white/3 border border-white/8 px-4 py-3 mt-1">
              <p className="text-xs text-slate-500 mb-1.5">Previous version:</p>
              <HighlightedBoolean text={prevLinkedin} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Variant output section ───────────────────────────────

interface VariantSectionProps {
  variantType:     ActiveVariant
  strings:         VariantStrings
  jobTitle:        string
  jdText:          string
  refinementCount: number
  onRefined:       (linkedin: string, indeed: string, newCount: number) => void
}

function VariantSection({ variantType, strings, jobTitle, jdText, refinementCount, onRefined }: VariantSectionProps) {
  return (
    <div className="space-y-3">
      <StringCard platform="LinkedIn Recruiter" emoji="💼" string={strings.linkedin_string} />
      <StringCard platform="Indeed"             emoji="🔍" string={strings.indeed_string}   />
      <FeedbackPanel
        variantType={variantType}
        currentLinkedin={strings.linkedin_string}
        currentIndeed={strings.indeed_string}
        jobTitle={jobTitle}
        jdText={jdText}
        refinementCount={refinementCount}
        onRefined={onRefined}
      />
    </div>
  )
}

// ─── Tag input component ──────────────────────────────────

interface TagInputProps {
  label:       string
  sublabel?:   string
  tags:        string[]
  onAdd:       (tag: string) => void
  onRemove:    (index: number) => void
  max:         number
  placeholder: string
  required?:   boolean
  error?:      string
}

function TagInput({ label, sublabel, tags, onAdd, onRemove, max, placeholder, required, error }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleAdd() {
    const trimmed = inputValue.trim()
    if (!trimmed || tags.length >= max) return
    if (tags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Skill already added')
      return
    }
    onAdd(trimmed)
    setInputValue('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-1.5">
        <label className="text-sm font-medium text-slate-300">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {sublabel && <span className="text-xs text-slate-500">{sublabel}</span>}
        <span className="ml-auto text-xs text-slate-500">{tags.length}/{max}</span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => (
            <span key={i} className="glass px-2 py-0.5 rounded-full text-xs text-indigo-300 flex items-center gap-1">
              {tag}
              <button type="button" onClick={() => onRemove(i)} className="hover:text-indigo-100 transition-colors" aria-label={`Remove ${tag}`}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length >= max ? `Max ${max} reached` : placeholder}
          disabled={tags.length >= max}
          className={cn(
            'flex-1 rounded-xl bg-white/5 border px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error ? 'border-red-500/60' : 'border-white/10',
          )}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!inputValue.trim() || tags.length >= max}
          className={cn(
            'flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium',
            'border border-white/10 text-slate-300 bg-white/5',
            'hover:bg-white/8 hover:text-white hover:border-white/20 transition-all duration-150',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────

export default function BooleanPage() {
  // ── Mode ───────────────────────────────────────────────────
  const [mode, setMode] = useState<InputMode>('jd')

  // ── JD mode state ──────────────────────────────────────────
  const [jdText,   setJdText]   = useState('')
  const [jdStatus, setJdStatus] = useState<GenerateStatus>('idle')

  // ── Manual mode state ──────────────────────────────────────
  const [jobTitle,       setJobTitle]       = useState('')
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])
  const [optionalSkills, setOptionalSkills] = useState<string[]>([])
  const [exclusions,     setExclusions]     = useState<string[]>([])
  const [manualStatus,   setManualStatus]   = useState<GenerateStatus>('idle')
  const [errors,         setErrors]         = useState<{ jobTitle?: string; requiredSkills?: string }>({})

  // ── Result state (shared) ──────────────────────────────────
  const [result,           setResult]           = useState<GenerateResult | null>(null)
  const [extractedTitle,   setExtractedTitle]   = useState('')
  const [extractedSkills,  setExtractedSkills]  = useState<string[]>([])
  const [activeVariant,     setActiveVariant]      = useState<ActiveVariant>('balanced')
  const [targetedStrings,   setTargetedStrings]   = useState<VariantStrings | null>(null)
  const [balancedStrings,   setBalancedStrings]   = useState<VariantStrings | null>(null)
  const [broadStrings,      setBroadStrings]      = useState<VariantStrings | null>(null)
  const [targetedRefCount,  setTargetedRefCount]  = useState(0)
  const [balancedRefCount,  setBalancedRefCount]  = useState(0)
  const [broadRefCount,     setBroadRefCount]     = useState(0)

  // ── Shared ─────────────────────────────────────────────────
  const [showUpgrade,   setShowUpgrade]   = useState(false)
  const [upgradeReason, setUpgradeReason] = useState<'limit_reached' | 'plan_required'>('limit_reached')

  // ── Word count ─────────────────────────────────────────────
  const wordCount     = jdText.trim() ? jdText.trim().split(/\s+/).length : 0
  const wordLimitOver = wordCount > 2000

  // ── Tag helpers ────────────────────────────────────────────
  function addTag(list: string[], setList: (v: string[]) => void, max: number) {
    return (tag: string) => { if (list.length < max) setList([...list, tag]) }
  }
  function removeTag(list: string[], setList: (v: string[]) => void) {
    return (index: number) => setList(list.filter((_, i) => i !== index))
  }

  // ── Gate error handler ─────────────────────────────────────
  async function handleGateError(res: Response) {
    const data = await res.json() as GateErrorBody
    if (data.reason === 'limit_reached') {
      setUpgradeReason('limit_reached')
      setShowUpgrade(true)
    } else if (data.reason === 'plan_required') {
      setUpgradeReason('plan_required')
      setShowUpgrade(true)
    } else {
      toast.error('Access denied. Please log in again.')
    }
  }

  function applyResult(data: GenerateResult) {
    setResult(data)
    setTargetedStrings(data.targeted)
    setBalancedStrings(data.balanced)
    setBroadStrings(data.broad)
    setTargetedRefCount(0)
    setBalancedRefCount(0)
    setBroadRefCount(0)
    setActiveVariant('balanced')
    if (data.extracted_title)  setExtractedTitle(data.extracted_title)
    if (data.extracted_skills) setExtractedSkills(data.extracted_skills)
  }

  // ── JD mode generate ──────────────────────────────────────
  async function handleJdGenerate() {
    if (!jdText.trim() || wordLimitOver) return
    setJdStatus('generating')
    setResult(null)
    setExtractedTitle('')
    setExtractedSkills([])
    try {
      const res = await fetch('/api/generate-boolean', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jd_text: jdText.trim() }),
      })

      if (res.status === 403) { setJdStatus('idle'); await handleGateError(res); return }

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        toast.error(data.error ?? 'Generation failed. Please try again.')
        setJdStatus('error')
        return
      }

      const data = await res.json() as GenerateResult
      applyResult(data)
      setJdStatus('complete')
    } catch {
      toast.error('Network error. Please try again.')
      setJdStatus('error')
    }
  }

  // ── Manual mode generate ───────────────────────────────────
  async function handleManualGenerate() {
    const newErrors: { jobTitle?: string; requiredSkills?: string } = {}
    if (!jobTitle.trim())            newErrors.jobTitle       = 'Job title is required'
    if (requiredSkills.length === 0) newErrors.requiredSkills = 'Add at least one required skill'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    setErrors({})
    setManualStatus('generating')
    setResult(null)

    try {
      const res = await fetch('/api/generate-boolean', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jobTitle: jobTitle.trim(), requiredSkills, optionalSkills, exclusions }),
      })

      if (res.status === 403) { setManualStatus('idle'); await handleGateError(res); return }

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        toast.error(data.error ?? 'Something went wrong. Please try again.')
        setManualStatus('error')
        return
      }

      const data = await res.json() as GenerateResult
      applyResult(data)
      setManualStatus('complete')
    } catch {
      toast.error('Network error. Please try again.')
      setManualStatus('error')
    }
  }

  const generating = mode === 'jd' ? jdStatus === 'generating' : manualStatus === 'generating'
  const hasResult  = !!result && !!targetedStrings && !!balancedStrings && !!broadStrings

  function handleReset() {
    setResult(null)
    setTargetedStrings(null)
    setBalancedStrings(null)
    setBroadStrings(null)
    setTargetedRefCount(0)
    setBalancedRefCount(0)
    setBroadRefCount(0)
    setExtractedTitle('')
    setExtractedSkills([])
    if (mode === 'jd') {
      setJdText(''); setJdStatus('idle')
    } else {
      setJobTitle(''); setRequiredSkills([]); setOptionalSkills([]); setExclusions([])
      setManualStatus('idle'); setErrors({})
    }
  }

  // The job title for refinement context
  const refinementJobTitle = extractedTitle || jobTitle
  const refinementJdText   = jdText

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-1">Boolean String Generator</h1>
          <p className="text-slate-400 text-sm">
            Generate targeted and broad Boolean search strings for sourcing candidates on LinkedIn and Indeed.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit mb-6">
          <button
            onClick={() => { setMode('jd'); handleReset() }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              mode === 'jd'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            Paste Job Description
          </button>
          <button
            onClick={() => { setMode('manual'); handleReset() }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              mode === 'manual'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <PenLine className="w-3.5 h-3.5" />
            Manual Entry
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ─── Left panel ──────────────────────────────────── */}

          {mode === 'jd' ? (
            <div className="glass-card rounded-2xl p-6 space-y-5">
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <label className="text-sm font-medium text-slate-300">
                    Job Description
                    <span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <span className={cn(
                    'text-xs tabular-nums',
                    wordLimitOver ? 'text-red-400' : wordCount > 1800 ? 'text-yellow-400' : 'text-slate-500',
                  )}>
                    {wordCount.toLocaleString()} / 2,000 words
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Paste or upload a job description and Cortex AI will extract the title, skills, and generate both a targeted and broad string.
                </p>
              </div>

              <FileDropTextarea
                value={jdText}
                onChange={setJdText}
                placeholder="Paste job description here, or drag and drop a PDF, DOCX, or TXT file…"
                minHeight="260px"
                rows={10}
              />

              {wordLimitOver && (
                <p className="text-xs text-red-400">
                  Job description exceeds 2,000 words. Please trim it before generating.
                </p>
              )}

              <button
                onClick={handleJdGenerate}
                disabled={!jdText.trim() || wordLimitOver || generating}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl',
                  'text-sm font-semibold text-white transition-all duration-150',
                  'bg-gradient-brand hover-glow',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                )}
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                ) : (
                  <><Sparkles className="w-4 h-4" />Generate from Job Description</>
                )}
              </button>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-6 space-y-6">
              {/* Job Title */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label htmlFor="job-title" className="text-sm font-medium text-slate-300">
                    Job Title<span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <span className="text-xs text-slate-500">{jobTitle.length}/100</span>
                </div>
                <input
                  id="job-title"
                  type="text"
                  value={jobTitle}
                  maxLength={100}
                  onChange={e => { setJobTitle(e.target.value); if (errors.jobTitle) setErrors(prev => ({ ...prev, jobTitle: undefined })) }}
                  placeholder="e.g. Senior Software Engineer"
                  className={cn(
                    'w-full rounded-xl bg-white/5 border px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
                    errors.jobTitle ? 'border-red-500/60' : 'border-white/10',
                  )}
                />
                {errors.jobTitle && <p className="text-xs text-red-400">{errors.jobTitle}</p>}
              </div>

              <TagInput
                label="Required Skills" sublabel="Uses AND"
                tags={requiredSkills} onAdd={addTag(requiredSkills, setRequiredSkills, 10)} onRemove={removeTag(requiredSkills, setRequiredSkills)}
                max={10} placeholder="e.g. React" required error={errors.requiredSkills}
              />
              <TagInput
                label="Optional Skills" sublabel="Will use OR grouping"
                tags={optionalSkills} onAdd={addTag(optionalSkills, setOptionalSkills, 10)} onRemove={removeTag(optionalSkills, setOptionalSkills)}
                max={10} placeholder="e.g. Vue.js"
              />
              <TagInput
                label="Exclusions" sublabel="Will use NOT operator"
                tags={exclusions} onAdd={addTag(exclusions, setExclusions, 10)} onRemove={removeTag(exclusions, setExclusions)}
                max={10} placeholder="e.g. Manager"
              />

              <button
                onClick={handleManualGenerate}
                disabled={generating}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl',
                  'text-sm font-semibold text-white transition-all duration-150',
                  'bg-gradient-brand hover-glow',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                )}
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                ) : (
                  <><Search className="w-4 h-4" />Generate Boolean Strings</>
                )}
              </button>
            </div>
          )}

          {/* ─── Right panel: Output ─────────────────────────── */}
          <div className="glass-card rounded-2xl p-6 min-h-[400px] flex flex-col">

            {/* Idle state */}
            {!hasResult && !generating && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  {mode === 'jd'
                    ? <FileText className="w-7 h-7 text-slate-500" />
                    : <Search className="w-7 h-7 text-slate-500" />
                  }
                </div>
                <p className="text-slate-500 text-sm">
                  {mode === 'jd'
                    ? <>Paste a job description and Cortex AI will generate<br />targeted and broad Boolean strings for you.</>
                    : 'Your Boolean strings will appear here.'
                  }
                </p>
              </div>
            )}

            {/* Generating state */}
            {generating && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                <p className="text-sm text-indigo-300">Generating targeted and broad strings…</p>
                <p className="text-xs text-slate-500">This takes 5–15 seconds</p>
              </div>
            )}

            {/* Result */}
            <AnimatePresence>
              {hasResult && targetedStrings && balancedStrings && broadStrings && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-4 flex-1"
                >
                  {/* Extracted summary */}
                  {extractedTitle && (
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                      <span className="text-xs font-semibold text-indigo-300">Detected:</span>
                      <span className="text-xs text-indigo-200 font-medium">{extractedTitle}</span>
                      {extractedSkills.length > 0 && (
                        <>
                          <span className="text-indigo-500">·</span>
                          <span className="text-xs text-slate-400">
                            Skills: {extractedSkills.join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Strict / Balanced / Broad toggle */}
                  <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
                    {([
                      { key: 'targeted' as const, label: 'Strict',   icon: Target,              color: 'indigo', recommended: false },
                      { key: 'balanced' as const, label: 'Balanced', icon: SlidersHorizontal,   color: 'violet', recommended: true },
                      { key: 'broad'    as const, label: 'Broad',    icon: Globe,               color: 'teal',   recommended: false },
                    ]).map(({ key, label, icon: Icon, color, recommended }) => {
                      const active = activeVariant === key
                      const strings = key === 'targeted' ? targetedStrings : key === 'balanced' ? balancedStrings : broadStrings
                      const activeCls = color === 'indigo' ? 'bg-indigo-600' : color === 'violet' ? 'bg-violet-600' : 'bg-teal-600'
                      return (
                        <button
                          key={key}
                          onClick={() => setActiveVariant(key)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                            active ? `${activeCls} text-white shadow-sm` : 'text-slate-400 hover:text-slate-200',
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                          {recommended && (
                            <span className={cn('text-[9px] px-1 py-0.5 rounded-full font-semibold', active ? 'bg-white/20 text-white' : 'bg-violet-500/20 text-violet-400')}>
                              REC
                            </span>
                          )}
                          {strings?.volume_estimate && (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', active ? 'bg-white/15 text-white/80' : 'bg-white/10 text-slate-500')}>
                              {strings.volume_estimate}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Variant content */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeVariant}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {activeVariant === 'targeted' && targetedStrings && (
                        <VariantSection
                          variantType="targeted"
                          strings={targetedStrings}
                          jobTitle={refinementJobTitle}
                          jdText={refinementJdText}
                          refinementCount={targetedRefCount}
                          onRefined={(li, in_, cnt) => {
                            setTargetedStrings({ ...targetedStrings, linkedin_string: li, indeed_string: in_ })
                            setTargetedRefCount(cnt)
                          }}
                        />
                      )}
                      {activeVariant === 'balanced' && balancedStrings && (
                        <VariantSection
                          variantType="balanced"
                          strings={balancedStrings}
                          jobTitle={refinementJobTitle}
                          jdText={refinementJdText}
                          refinementCount={balancedRefCount}
                          onRefined={(li, in_, cnt) => {
                            setBalancedStrings({ ...balancedStrings, linkedin_string: li, indeed_string: in_ })
                            setBalancedRefCount(cnt)
                          }}
                        />
                      )}
                      {activeVariant === 'broad' && broadStrings && (
                        <VariantSection
                          variantType="broad"
                          strings={broadStrings}
                          jobTitle={refinementJobTitle}
                          jdText={refinementJdText}
                          refinementCount={broadRefCount}
                          onRefined={(li, in_, cnt) => {
                            setBroadStrings({ ...broadStrings, linkedin_string: li, indeed_string: in_ })
                            setBroadRefCount(cnt)
                          }}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleReset}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium',
                        'border border-white/10 bg-white/5 text-slate-300',
                        'hover:bg-white/8 hover:text-white hover:border-white/20 transition-all duration-150',
                      )}
                    >
                      New Search
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason={upgradeReason}
      />
    </>
  )
}
