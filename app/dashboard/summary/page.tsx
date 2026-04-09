'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Loader2, Copy, Check, RefreshCw, ClipboardCheck, ChevronDown, Plus, Info } from 'lucide-react'
import { toast } from 'sonner'
import { UpgradeModal } from '@/components/upgrade-modal'
import { FileDropTextarea } from '@/components/ui/file-drop-textarea'
import { cn } from '@/lib/utils'

type AssessmentSessionOption = {
  id:            string
  candidateName: string
  role:          string
  skillScore:    number | null
  trustScore:    number | null
  completedAt:   string
}

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Main component ───────────────────────────────────────

export default function SummaryPage() {
  const [jobTitle,       setJobTitle]       = useState('')
  const [companyName,    setCompanyName]    = useState('')
  const [notes,          setNotes]          = useState('')
  const [jdText,         setJdText]         = useState('')
  const [recruiterNotes, setRecruiterNotes] = useState('')
  const [showJd,         setShowJd]         = useState(false)
  const [outputText,     setOutputText]     = useState('')
  const [status,         setStatus]         = useState<Status>('idle')
  const [errorMsg,       setErrorMsg]       = useState('')
  const [copied,         setCopied]         = useState(false)

  const [sessions,         setSessions]         = useState<AssessmentSessionOption[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [sessionsLoading,  setSessionsLoading]  = useState(false)

  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeReason,    setUpgradeReason]    = useState<'limit_reached' | 'plan_required'>('plan_required')
  const [upgradePlan,      setUpgradePlan]      = useState<'pro' | 'agency' | undefined>('pro')

  const abortRef = useRef<AbortController | null>(null)

  const notesWords         = wordCount(notes)
  const jdWords            = wordCount(jdText)
  const recruiterNoteWords = wordCount(recruiterNotes)
  const jobTitleChars      = jobTitle.length
  const companyChars       = companyName.length

  // Fetch completed assessment sessions on mount
  useEffect(() => {
    setSessionsLoading(true)
    fetch('/api/assessments/completed-sessions')
      .then(r => r.ok ? r.json() : { sessions: [] })
      .then(data => setSessions(data.sessions ?? []))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false))
  }, [])

  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? null

  const handleGenerate = useCallback(async () => {
    // Client-side validation
    if (!jobTitle.trim()) {
      toast.error('Job title is required')
      return
    }
    if (!notes.trim()) {
      toast.error('Resume text is required')
      return
    }
    if (notesWords > 5000) {
      toast.error('Resume must be 5000 words or fewer')
      return
    }
    if (jdWords > 2000) {
      toast.error('Job description must be 2000 words or fewer')
      return
    }
    if (recruiterNoteWords > 500) {
      toast.error('Recruiter notes must be 500 words or fewer')
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
        body:    JSON.stringify({
          jobTitle,
          companyName,
          notes,
          jdText: jdText.trim() || undefined,
          recruiterNotes: recruiterNotes.trim() || undefined,
          assessmentSessionId: selectedSessionId || undefined,
        }),
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
  }, [jobTitle, companyName, notes, notesWords, jdText, jdWords, recruiterNotes, recruiterNoteWords, selectedSessionId])

  function handleReset() {
    abortRef.current?.abort()
    setStatus('idle')
    setOutputText('')
    setErrorMsg('')
    setJobTitle('')
    setCompanyName('')
    setNotes('')
    setJdText('')
    setRecruiterNotes('')
    setShowJd(false)
    setSelectedSessionId('')
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
            Generate a client-ready 4-bullet summary tailored to the role
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

            {/* Job Description (collapsible) */}
            {!showJd ? (
              <button
                type="button"
                onClick={() => setShowJd(true)}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Job Description
                <span className="inline-flex items-center gap-1 ml-1 text-slate-600">
                  <Info className="w-3 h-3" />
                  improves relevance 10x
                </span>
              </button>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="jd-text" className="text-sm font-medium text-slate-300">
                    Job Description
                    <span className="text-xs text-slate-500 ml-1.5">(optional)</span>
                  </label>
                  <WordCounter count={jdWords} max={2000} />
                </div>
                <FileDropTextarea
                  id="jd-text"
                  value={jdText}
                  onChange={setJdText}
                  placeholder="Paste the JD to tailor the summary to this specific role (optional but recommended)"
                  rows={6}
                  minHeight="140px"
                />
              </div>
            )}

            {/* Recruiter Notes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="recruiter-notes" className="text-sm font-medium text-slate-300">
                  Your Notes
                  <span className="text-xs text-slate-500 ml-1.5">(optional)</span>
                </label>
                <WordCounter count={recruiterNoteWords} max={500} />
              </div>
              <textarea
                id="recruiter-notes"
                value={recruiterNotes}
                onChange={e => setRecruiterNotes(e.target.value)}
                placeholder="Add any context, talking points, or observations about this candidate (optional)"
                rows={3}
                className={cn(
                  'w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
                )}
              />
            </div>

            {/* Resume */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="notes" className="text-sm font-medium text-slate-300">
                  Resume
                  <span className="text-red-400 ml-0.5">*</span>
                </label>
                <WordCounter count={notesWords} max={5000} />
              </div>
              <FileDropTextarea
                id="notes"
                value={notes}
                onChange={setNotes}
                placeholder="Paste or drag-and-drop the candidate's resume…"
                rows={8}
                minHeight="200px"
              />
            </div>

            {/* Assessment results (optional) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="assessment-session" className="text-sm font-medium text-slate-300">
                  Assessment results
                  <span className="text-xs text-slate-500 ml-1.5">(optional)</span>
                </label>
                {selectedSession && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <ClipboardCheck className="w-3 h-3" />
                    Results included
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Include a candidate&apos;s assessment results to strengthen your client submittal
              </p>
              <div className="relative">
                <select
                  id="assessment-session"
                  value={selectedSessionId}
                  onChange={e => setSelectedSessionId(e.target.value)}
                  disabled={sessionsLoading}
                  className={cn(
                    'w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 pr-10',
                    'text-sm text-slate-200 appearance-none',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    selectedSessionId ? 'border-emerald-500/30' : '',
                  )}
                >
                  <option value="" className="bg-slate-900 text-slate-400">
                    {sessionsLoading ? 'Loading sessions…' : sessions.length === 0 ? 'No completed assessments' : 'Select completed assessment…'}
                  </option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                      {s.candidateName} · {s.role}
                      {s.skillScore !== null ? ` · Skill ${s.skillScore}/100` : ''}
                      {' · '}{formatDate(s.completedAt)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
              {selectedSession && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                  <ClipboardCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="text-xs text-emerald-300 leading-relaxed">
                    <span className="font-medium">{selectedSession.candidateName}</span>
                    {' — '}Skill {selectedSession.skillScore ?? 'N/A'}/100
                    {selectedSession.trustScore !== null && `, Trust ${selectedSession.trustScore}/100`}
                    {' · Completed '}{formatDate(selectedSession.completedAt)}
                  </div>
                </div>
              )}
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
