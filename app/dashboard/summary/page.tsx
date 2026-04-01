'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Loader2, Copy, Check, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { UpgradeModal } from '@/components/upgrade-modal'
import { FileDropTextarea } from '@/components/ui/file-drop-textarea'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────

type Status = 'idle' | 'generating' | 'complete' | 'error'

// ─── Helpers ──────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function CharCounter({ count, max }: { count: number; max: number }) {
  const pct      = count / max
  const colorCls = pct >= 1 ? 'text-red-400' : pct >= 0.85 ? 'text-yellow-400' : 'text-slate-500'
  return (
    <span className={cn('text-xs tabular-nums', colorCls)}>
      {count} / {max}
    </span>
  )
}

function WordCounter({ count, max }: { count: number; max: number }) {
  const pct      = count / max
  const colorCls = pct >= 1 ? 'text-red-400' : pct >= 0.85 ? 'text-yellow-400' : 'text-slate-500'
  return (
    <span className={cn('text-xs tabular-nums', colorCls)}>
      {count} / {max} words
    </span>
  )
}

// ─── Main component ───────────────────────────────────────

export default function SummaryPage() {
  const [jobTitle,     setJobTitle]     = useState('')
  const [companyName,  setCompanyName]  = useState('')
  const [notes,        setNotes]        = useState('')
  const [outputText,   setOutputText]   = useState('')
  const [status,       setStatus]       = useState<Status>('idle')
  const [errorMsg,     setErrorMsg]     = useState('')
  const [copied,       setCopied]       = useState(false)

  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeReason,    setUpgradeReason]    = useState<'limit_reached' | 'plan_required'>('plan_required')
  const [upgradePlan,      setUpgradePlan]      = useState<'pro' | 'agency' | undefined>('pro')

  const abortRef = useRef<AbortController | null>(null)

  const notesWords    = wordCount(notes)
  const jobTitleChars = jobTitle.length
  const companyChars  = companyName.length

  const handleGenerate = useCallback(async () => {
    // Client-side validation
    if (!jobTitle.trim()) {
      toast.error('Job title is required')
      return
    }
    if (!notes.trim()) {
      toast.error('Notes are required')
      return
    }
    if (notesWords > 500) {
      toast.error('Notes must be 500 words or fewer')
      return
    }

    // Cancel any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('generating')
    setOutputText('')
    setErrorMsg('')

    try {
      const res = await fetch('/api/generate-summary', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jobTitle, companyName, notes }),
        signal:  controller.signal,
      })

      // Handle 403 gating errors
      if (res.status === 403) {
        const data = await res.json() as { error: string; reason?: string; planTier?: string }
        setStatus('idle')
        if (data.reason === 'plan_required') {
          setUpgradeReason('plan_required')
          setUpgradePlan('pro')
          setShowUpgradeModal(true)
        } else if (data.reason === 'limit_reached') {
          setUpgradeReason('limit_reached')
          setUpgradePlan(undefined)
          setShowUpgradeModal(true)
        } else {
          toast.error('Access denied. Please check your plan.')
        }
        return
      }

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Something went wrong')
      }

      // Consume SSE stream
      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Split on double newline (SSE event boundary)
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''  // keep incomplete tail

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue

          const raw = line.slice('data:'.length).trim()

          if (raw === '[DONE]') {
            setStatus('complete')
            continue
          }

          try {
            const parsed = JSON.parse(raw) as { token?: string; error?: string }
            if (parsed.error) {
              throw new Error(parsed.error)
            }
            if (typeof parsed.token === 'string') {
              setOutputText(prev => prev + parsed.token)
            }
          } catch {
            // ignore malformed events
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setStatus('error')
      setErrorMsg(message)
      toast.error(message)
    }
  }, [jobTitle, companyName, notes, notesWords])

  function handleReset() {
    abortRef.current?.abort()
    setStatus('idle')
    setOutputText('')
    setErrorMsg('')
    setJobTitle('')
    setCompanyName('')
    setNotes('')
  }

  async function handleCopy() {
    if (!outputText) return
    try {
      await navigator.clipboard.writeText(outputText)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-1">Client Summary Generator</h1>
          <p className="text-slate-400 text-sm">
            Turn raw notes into polished client briefs
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── Left panel: Form ───────────────────────────── */}
          <div className="glass-card rounded-2xl p-6 space-y-5">

            {/* Job Title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="job-title" className="text-sm font-medium text-slate-300">
                  Job Title
                  <span className="text-red-400 ml-0.5">*</span>
                </label>
                <CharCounter count={jobTitleChars} max={100} />
              </div>
              <input
                id="job-title"
                type="text"
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value.slice(0, 100))}
                placeholder="e.g. Senior Software Engineer"
                maxLength={100}
                className={cn(
                  'w-full rounded-xl bg-white/5 border px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
                  jobTitleChars >= 100 ? 'border-red-500/40' : 'border-white/10',
                )}
              />
            </div>

            {/* Company Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="company-name" className="text-sm font-medium text-slate-300">
                  Company Name
                  <span className="text-xs text-slate-500 ml-1.5">(optional)</span>
                </label>
                <CharCounter count={companyChars} max={100} />
              </div>
              <input
                id="company-name"
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value.slice(0, 100))}
                placeholder="e.g. Acme Corp"
                maxLength={100}
                className={cn(
                  'w-full rounded-xl bg-white/5 border px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
                  companyChars >= 100 ? 'border-red-500/40' : 'border-white/10',
                )}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="notes" className="text-sm font-medium text-slate-300">
                  Notes / Intake
                  <span className="text-red-400 ml-0.5">*</span>
                </label>
                <WordCounter count={notesWords} max={500} />
              </div>
              <FileDropTextarea
                id="notes"
                value={notes}
                onChange={setNotes}
                placeholder="Paste or drag-and-drop raw intake notes, key requirements, culture fit details…"
                rows={8}
                minHeight="200px"
              />
            </div>

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
                  <FileText className="w-4 h-4" />
                  Generate Summary
                </>
              )}
            </button>

            {/* Tip */}
            <p className="text-xs text-slate-500 text-center">
              Pro plan feature — generates a professional client brief from your notes
            </p>
          </div>

          {/* ── Right panel: Output ────────────────────────── */}
          <div className="glass-card rounded-2xl p-6 min-h-[480px] flex flex-col">

            {/* Idle — placeholder */}
            {status === 'idle' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <FileText className="w-7 h-7 text-slate-500" />
                </div>
                <p className="text-slate-500 text-sm">
                  Your generated summary will appear here
                </p>
              </div>
            )}

            {/* Generating or complete — streaming text */}
            <AnimatePresence>
              {(status === 'generating' || status === 'complete') && (
                <motion.div
                  key="output"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="flex flex-col flex-1 gap-4"
                >
                  {/* Output header */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-300">
                      {status === 'generating' ? 'Generating…' : 'Client Brief'}
                    </h2>
                    {status === 'complete' && (
                      <button
                        onClick={handleCopy}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                          copied
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-200',
                        )}
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Summary text */}
                  <div className="flex-1 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                    {outputText}
                    {status === 'generating' && (
                      <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 align-text-bottom animate-[blink_0.9s_step-end_infinite]" />
                    )}
                  </div>

                  {/* Saved note + reset */}
                  {status === 'complete' && (
                    <div className="flex items-center justify-between pt-3 border-t border-white/8">
                      <span className="text-xs text-slate-500">
                        Saved to history automatically
                      </span>
                      <button
                        onClick={handleReset}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                          'text-xs font-medium text-slate-400 border border-white/10',
                          'hover:bg-white/5 hover:text-slate-200 hover:border-white/20 transition-all duration-150',
                        )}
                      >
                        <RefreshCw className="w-3 h-3" />
                        New summary
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error state */}
            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col items-center justify-center text-center py-12 gap-4"
              >
                <p className="text-sm text-red-400">{errorMsg || 'Something went wrong.'}</p>
                <button
                  onClick={() => setStatus('idle')}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-xl',
                    'text-sm font-medium text-slate-300 border border-white/10',
                    'hover:bg-white/5 hover:text-white transition-all duration-150',
                  )}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try again
                </button>
              </motion.div>
            )}
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

      {/* Blinking cursor keyframe */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </>
  )
}
