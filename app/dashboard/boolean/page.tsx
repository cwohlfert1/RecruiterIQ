'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Loader2, Copy, Check, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { UpgradeModal } from '@/components/upgrade-modal'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────

type GenerateStatus = 'idle' | 'generating' | 'complete' | 'error'

interface GateErrorBody {
  error:     string
  reason:    'unauthenticated' | 'limit_reached' | 'plan_required'
  planTier?: 'free' | 'pro' | 'agency'
}

// ─── Syntax-highlighted Boolean output ───────────────────

function HighlightedBoolean({ text }: { text: string }) {
  // Tokenise the boolean string into segments for colouring
  const segments: Array<{ type: 'operator' | 'quoted' | 'paren' | 'plain'; value: string }> = []
  let remaining = text

  while (remaining.length > 0) {
    // Quoted phrase — "exact phrase"
    const quotedMatch = remaining.match(/^("(?:[^"\\]|\\.)*")/)
    if (quotedMatch) {
      segments.push({ type: 'quoted', value: quotedMatch[1] })
      remaining = remaining.slice(quotedMatch[1].length)
      continue
    }

    // Boolean operators — AND, OR, NOT (word boundary)
    const opMatch = remaining.match(/^(AND|OR|NOT)(?=\s|$|\()/)
    if (opMatch) {
      segments.push({ type: 'operator', value: opMatch[1] })
      remaining = remaining.slice(opMatch[1].length)
      continue
    }

    // Parentheses
    if (remaining[0] === '(' || remaining[0] === ')') {
      segments.push({ type: 'paren', value: remaining[0] })
      remaining = remaining.slice(1)
      continue
    }

    // Accumulate plain text up to the next special token
    const plainMatch = remaining.match(/^[^"()A-Z]+|^[A-Z][^"()A-Z\s]*/)
    if (plainMatch) {
      segments.push({ type: 'plain', value: plainMatch[0] })
      remaining = remaining.slice(plainMatch[0].length)
      continue
    }

    // Fallback — consume one character
    segments.push({ type: 'plain', value: remaining[0] })
    remaining = remaining.slice(1)
  }

  return (
    <span className="font-mono text-sm leading-relaxed break-words">
      {segments.map((seg, i) => {
        if (seg.type === 'operator') {
          return <span key={i} className="text-indigo-400 font-semibold">{seg.value}</span>
        }
        if (seg.type === 'quoted') {
          return <span key={i} className="text-emerald-400">{seg.value}</span>
        }
        if (seg.type === 'paren') {
          return <span key={i} className="text-slate-400">{seg.value}</span>
        }
        return <span key={i} className="text-slate-200">{seg.value}</span>
      })}
    </span>
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

function TagInput({
  label,
  sublabel,
  tags,
  onAdd,
  onRemove,
  max,
  placeholder,
  required,
  error,
}: TagInputProps) {
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
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-1.5">
        <label className="text-sm font-medium text-slate-300">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {sublabel && (
          <span className="text-xs text-slate-500">{sublabel}</span>
        )}
        <span className="ml-auto text-xs text-slate-500">{tags.length}/{max}</span>
      </div>

      {/* Tag chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="glass px-2 py-0.5 rounded-full text-xs text-indigo-300 flex items-center gap-1"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="hover:text-indigo-100 transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
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
  const [jobTitle,        setJobTitle]        = useState('')
  const [requiredSkills,  setRequiredSkills]  = useState<string[]>([])
  const [optionalSkills,  setOptionalSkills]  = useState<string[]>([])
  const [exclusions,      setExclusions]      = useState<string[]>([])
  const [status,          setStatus]          = useState<GenerateStatus>('idle')
  const [streamedText,    setStreamedText]    = useState('')
  const [copied,          setCopied]          = useState(false)
  const [showUpgrade,     setShowUpgrade]     = useState(false)
  const [upgradeReason,   setUpgradeReason]   = useState<'limit_reached' | 'plan_required'>('limit_reached')
  const [errors,          setErrors]          = useState<{ jobTitle?: string; requiredSkills?: string }>({})

  // ── Tag helpers ──────────────────────────────────────────

  function addTag(list: string[], setList: (v: string[]) => void, max: number) {
    return (tag: string) => {
      if (list.length < max) setList([...list, tag])
    }
  }

  function removeTag(list: string[], setList: (v: string[]) => void) {
    return (index: number) => setList(list.filter((_, i) => i !== index))
  }

  // ── Submit ───────────────────────────────────────────────

  async function handleGenerate() {
    const newErrors: { jobTitle?: string; requiredSkills?: string } = {}
    if (!jobTitle.trim())        newErrors.jobTitle       = 'Job title is required'
    if (requiredSkills.length === 0) newErrors.requiredSkills = 'Add at least one required skill'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    setStatus('generating')
    setStreamedText('')

    try {
      const res = await fetch('/api/generate-boolean', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          jobTitle:       jobTitle.trim(),
          requiredSkills,
          optionalSkills,
          exclusions,
        }),
      })

      if (res.status === 403) {
        const data = await res.json() as GateErrorBody
        setStatus('idle')
        if (data.reason === 'limit_reached') {
          setUpgradeReason('limit_reached')
          setShowUpgrade(true)
        } else if (data.reason === 'plan_required') {
          setUpgradeReason('plan_required')
          setShowUpgrade(true)
        } else {
          toast.error('Access denied. Please log in again.')
        }
        return
      }

      if (!res.ok || !res.body) {
        const data = await res.json() as { error?: string }
        toast.error(data.error ?? 'Something went wrong. Please try again.')
        setStatus('error')
        return
      }

      // Read SSE stream
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          const payload = trimmed.slice(5).trim()

          if (payload === '[DONE]') {
            setStatus('complete')
            continue
          }

          try {
            const parsed = JSON.parse(payload) as { token?: string; error?: string }
            if (parsed.error) {
              toast.error('Generation failed. Please try again.')
              setStatus('error')
              return
            }
            if (parsed.token) {
              setStreamedText(prev => prev + parsed.token)
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch {
      toast.error('Network error. Please try again.')
      setStatus('error')
    }
  }

  async function handleCopy() {
    if (!streamedText) return
    try {
      await navigator.clipboard.writeText(streamedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  function handleReset() {
    setJobTitle('')
    setRequiredSkills([])
    setOptionalSkills([])
    setExclusions([])
    setStreamedText('')
    setStatus('idle')
    setErrors({})
  }

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-1">Boolean String Generator</h1>
          <p className="text-slate-400 text-sm">
            Generate Boolean search strings for sourcing candidates on LinkedIn and Indeed.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ── Left panel: Inputs ─────────────────────────── */}
          <div className="glass-card rounded-2xl p-6 space-y-6">
            {/* Job Title */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor="job-title" className="text-sm font-medium text-slate-300">
                  Job Title
                  <span className="text-red-400 ml-0.5">*</span>
                </label>
                <span className="text-xs text-slate-500">{jobTitle.length}/100</span>
              </div>
              <input
                id="job-title"
                type="text"
                value={jobTitle}
                maxLength={100}
                onChange={e => {
                  setJobTitle(e.target.value)
                  if (errors.jobTitle) setErrors(prev => ({ ...prev, jobTitle: undefined }))
                }}
                placeholder="e.g. Senior Software Engineer"
                className={cn(
                  'w-full rounded-xl bg-white/5 border px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
                  errors.jobTitle ? 'border-red-500/60' : 'border-white/10',
                )}
              />
              {errors.jobTitle && (
                <p className="text-xs text-red-400">{errors.jobTitle}</p>
              )}
            </div>

            {/* Required Skills */}
            <TagInput
              label="Required Skills"
              sublabel="Uses AND"
              tags={requiredSkills}
              onAdd={addTag(requiredSkills, setRequiredSkills, 10)}
              onRemove={removeTag(requiredSkills, setRequiredSkills)}
              max={10}
              placeholder="e.g. React"
              required
              error={errors.requiredSkills}
            />

            {/* Optional Skills */}
            <TagInput
              label="Optional Skills"
              sublabel="Will use OR grouping"
              tags={optionalSkills}
              onAdd={addTag(optionalSkills, setOptionalSkills, 10)}
              onRemove={removeTag(optionalSkills, setOptionalSkills)}
              max={10}
              placeholder="e.g. Vue.js"
            />

            {/* Exclusions */}
            <TagInput
              label="Exclusions"
              sublabel="Will use NOT operator"
              tags={exclusions}
              onAdd={addTag(exclusions, setExclusions, 10)}
              onRemove={removeTag(exclusions, setExclusions)}
              max={10}
              placeholder="e.g. Manager"
            />

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={status === 'generating'}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl',
                'text-sm font-semibold text-white transition-all duration-150',
                'bg-gradient-brand hover-glow',
                'disabled:opacity-60 disabled:cursor-not-allowed',
              )}
            >
              {status === 'generating' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Generate Boolean String
                </>
              )}
            </button>
          </div>

          {/* ── Right panel: Output ────────────────────────── */}
          <div className="glass-card rounded-2xl p-6 min-h-[400px] flex flex-col">
            {/* Empty state */}
            {status === 'idle' && !streamedText && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <Search className="w-7 h-7 text-slate-500" />
                </div>
                <p className="text-slate-500 text-sm">
                  Your Boolean string will appear here.
                </p>
              </div>
            )}

            {/* Streaming / complete */}
            <AnimatePresence>
              {(status === 'generating' || status === 'complete') && (
                <motion.div
                  key="output"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-4 flex-1"
                >
                  {/* Output card */}
                  <div className="glass rounded-xl p-4 flex-1">
                    <div className="leading-relaxed">
                      {status === 'complete' ? (
                        <HighlightedBoolean text={streamedText} />
                      ) : (
                        <span className="font-mono text-sm text-slate-200 leading-relaxed break-words">
                          {streamedText}
                          <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 align-middle animate-pulse" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions — only when complete */}
                  {status === 'complete' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.15 }}
                      className="space-y-3"
                    >
                      <div className="flex gap-2">
                        <button
                          onClick={handleCopy}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium',
                            'border border-white/10 transition-all duration-150',
                            copied
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : 'bg-white/5 text-slate-300 hover:bg-white/8 hover:text-white hover:border-white/20',
                          )}
                        >
                          {copied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy
                            </>
                          )}
                        </button>

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

                      <p className="text-xs text-slate-500">
                        Paste directly into LinkedIn Recruiter or Indeed search.
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error state */}
            {status === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                <p className="text-red-400 text-sm mb-3">Generation failed. Please try again.</p>
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade modal */}
      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason={upgradeReason}
      />
    </>
  )
}
