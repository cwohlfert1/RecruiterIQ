'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, UserPlus, Loader2, Sparkles, Plus, AlertOctagon } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { FileDropTextarea } from '@/components/ui/file-drop-textarea'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'
import type { PipelineStage } from '@/types/database'

interface FlagWarning {
  flag_type:      string
  reason:         string | null
  candidate_name: string
}

interface Props {
  open:          boolean
  projectId:     string
  hasJd:         boolean
  isManager?:      boolean
  initialStage?:   PipelineStage
  initialResume?:  string | null
  onClose:         () => void
  onAdded:       (candidate: CandidateRow) => void
}

interface ParsedFields {
  name:             string | null
  email:            string | null
  phone:            string | null
  current_title:    string | null
  years_experience: number | null
  location:         string | null
}

function emptyParsed(): ParsedFields {
  return { name: null, email: null, phone: null, current_title: null, years_experience: null, location: null }
}

export function AddCandidateSlideover({ open, projectId, hasJd, isManager = false, initialStage, initialResume, onClose, onAdded }: Props) {
  const [resume,       setResume]       = useState('')
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [parsing,      setParsing]      = useState(false)
  const [parsed,       setParsed]       = useState<ParsedFields | null>(null)
  const [name,         setName]         = useState('')
  const [email,        setEmail]        = useState('')
  const [payMin,       setPayMin]       = useState('')
  const [payMax,       setPayMax]       = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [addedCount,   setAddedCount]   = useState(0)
  const [linkedinUrl,  setLinkedinUrl]  = useState('')
  const [linkedinError, setLinkedinError] = useState(false)
  const [nameError,    setNameError]    = useState(false)
  const [emailError,   setEmailError]   = useState(false)
  const [flagWarning,  setFlagWarning]  = useState<FlagWarning | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setResume(initialResume ?? ''); setOriginalFile(null); setParsed(null); setName(''); setEmail(''); setLinkedinUrl('')
      setPayMin(''); setPayMax('')
      setSubmitting(false); setParsing(false); setAddedCount(0)
      setNameError(false); setEmailError(false); setLinkedinError(false)
    }
  }, [open])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Auto-parse on resume change (500ms debounce)
  const parseResume = useCallback(async (text: string) => {
    if (text.trim().length < 100) {
      setParsed(null); setName(''); setEmail('')
      return
    }
    setParsing(true)
    try {
      const res  = await fetch('/api/projects/candidates/parse-resume', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ resume_text: text }),
      })
      const data: ParsedFields = await res.json()
      if (res.ok) {
        setParsed(data)
        setName(data.name  ?? '')
        setEmail(data.email ?? '')
      } else {
        setParsed(emptyParsed())
      }
    } catch {
      setParsed(emptyParsed())
    } finally {
      setParsing(false)
    }
  }, [])

  function handleResumeChange(text: string) {
    setResume(text)
    setParsed(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => parseResume(text), 500)
  }

  const emailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const linkedinValid = !linkedinUrl.trim() || linkedinUrl.trim().includes('linkedin.com/in/')
  const needsResume = !!hasJd
  const canSubmit  = name.trim() && emailValid && linkedinValid && (needsResume ? resume.trim() : true) && !parsing && !submitting

  async function submitCandidate(override = false) {
    setNameError(!name.trim())
    setEmailError(!!email.trim() && !emailValid)
    setLinkedinError(!!linkedinUrl.trim() && !linkedinValid)
    if (!name.trim() || !emailValid || !linkedinValid || (needsResume && !resume.trim())) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/candidates`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          candidate_name:  name.trim(),
          candidate_email: email.trim(),
          resume_text:     resume.trim(),
          ...(initialStage ? { pipeline_stage: initialStage } : {}),
          ...(override ? { override: true } : {}),
          ...(payMin ? { pay_rate_min: Number(payMin) } : {}),
          ...(payMax ? { pay_rate_max: Number(payMax) } : {}),
          ...(payMin || payMax ? { pay_rate_type: 'hourly' } : {}),
          ...(linkedinUrl.trim() ? { linkedin_url: linkedinUrl.trim() } : {}),
        }),
      })

      const data = await res.json()

      if (res.status === 409) {
        toast.error('This candidate is already in this project.')
        setSubmitting(false)
        return
      }
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to add candidate')
        setSubmitting(false)
        return
      }

      // Flag warning returned — show warning modal, don't complete
      if (data.flag_warning) {
        setFlagWarning(data.flag_warning as FlagWarning)
        setSubmitting(false)
        return
      }

      const candidate = data.candidate as CandidateRow

      // Upload original file to Supabase Storage if one was dropped
      if (originalFile && candidate?.id) {
        const ext    = originalFile.name.split('.').pop()?.toLowerCase() ?? 'bin'
        const path   = `${projectId}/${candidate.id}.${ext}`
        const supabase = createClient()
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(path, originalFile, { upsert: true })

        if (!uploadError) {
          await fetch(`/api/projects/${projectId}/candidates/${candidate.id}`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ resume_file_url: path }),
          })
          candidate.resume_file_url = path
        }
      }

      const cqi = candidate?.cqi_score
      toast.success(`${name.trim()} added${cqi != null ? ` — CQI: ${cqi}/100` : ''}`)
      onAdded(candidate)
      setFlagWarning(null)
      return candidate
    } catch {
      toast.error('Something went wrong. Please try again.')
      setSubmitting(false)
      return null
    }
  }

  async function handleSubmit() {
    const result = await submitCandidate()
    if (result) onClose()
  }

  async function handleAddAnother() {
    const result = await submitCandidate()
    if (result) {
      setAddedCount(c => c + 1)
      setResume(''); setOriginalFile(null); setParsed(null); setName(''); setEmail('')
      setPayMin(''); setPayMax('')
      setParsing(false); setSubmitting(false)
      setNameError(false); setEmailError(false)
    }
  }

  const showFields = parsed !== null || parsing

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-[480px] bg-[#12141F] border-l border-white/10 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">Add Candidate</h2>
                {addedCount > 0 && (
                  <span className="text-xs text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 rounded-full">
                    {addedCount} added
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Flag warning modal */}
            {flagWarning && (
              <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                <div className="bg-[#12141F] border border-rose-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                      <AlertOctagon className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Flagged Candidate</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        This email is in the agency DNU registry as <span className="font-semibold text-rose-400 uppercase">{flagWarning.flag_type}</span>.
                      </p>
                    </div>
                  </div>
                  {flagWarning.reason && (
                    <p className="text-xs text-slate-500 bg-white/3 border border-white/8 rounded-xl p-3">
                      {flagWarning.reason}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFlagWarning(null)}
                      className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 border border-white/10 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    {isManager ? (
                      <button
                        onClick={async () => {
                          setFlagWarning(null)
                          const result = await submitCandidate(true)
                          if (result) onClose()
                        }}
                        className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors"
                      >
                        Override &amp; Add
                      </button>
                    ) : (
                      <p className="flex-1 text-center text-xs text-slate-500 self-center">Manager access required to override</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Resume textarea */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Resume</label>
                <FileDropTextarea
                  value={resume}
                  onChange={handleResumeChange}
                  onFile={setOriginalFile}
                  placeholder="Paste or drag and drop the candidate's resume here..."
                  minHeight="220px"
                  rows={10}
                />
                <p className="text-xs text-slate-600">
                  Cortex AI will automatically extract candidate contact details
                </p>
              </div>

              {/* Parsing indicator */}
              {parsing && (
                <div className="flex items-center gap-2 text-sm text-indigo-300">
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  Cortex is reading this resume...
                </div>
              )}

              {/* Auto-populated fields */}
              <AnimatePresence>
                {showFields && !parsing && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4"
                  >
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-300">
                        Candidate Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => { setName(e.target.value); setNameError(false) }}
                        placeholder="Jane Smith"
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl bg-white/5 border text-sm text-slate-200 placeholder:text-slate-600',
                          'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
                          nameError ? 'border-red-500/60' : 'border-white/10 hover:border-white/20',
                        )}
                      />
                      {nameError && <p className="text-xs text-red-400">Name is required</p>}
                    </div>

                    {/* LinkedIn URL */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-300">
                        LinkedIn URL <span className="text-xs text-slate-500 ml-1">(optional)</span>
                      </label>
                      <input
                        type="url"
                        value={linkedinUrl}
                        onChange={e => { setLinkedinUrl(e.target.value); setLinkedinError(false) }}
                        placeholder="https://linkedin.com/in/username"
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl bg-white/5 border text-sm text-slate-200 placeholder:text-slate-600',
                          'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
                          linkedinError ? 'border-amber-500/60' : 'border-white/10 hover:border-white/20',
                        )}
                      />
                      {linkedinError && <p className="text-xs text-red-400">Please enter a valid LinkedIn profile URL</p>}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-300">
                        Email Address <span className="text-xs text-slate-500 ml-1">(optional)</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setEmailError(false) }}
                        placeholder="Add email to send assessments and notifications"
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl bg-white/5 border text-sm text-slate-200 placeholder:text-slate-600',
                          'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
                          emailError
                            ? 'border-amber-500/60'
                            : 'border-white/10 hover:border-white/20',
                        )}
                      />
                      {emailError && <p className="text-xs text-red-400">Invalid email format</p>}
                    </div>

                    {/* Pay Rate */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-300">
                        Pay Rate (W2/hr) <span className="text-slate-600 font-normal text-xs">optional</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                          <input
                            type="number"
                            value={payMin}
                            onChange={e => setPayMin(e.target.value)}
                            placeholder="75"
                            min={0}
                            className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
                          />
                        </div>
                        <span className="text-slate-600 text-sm">to</span>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                          <input
                            type="number"
                            value={payMax}
                            onChange={e => setPayMax(e.target.value)}
                            placeholder="90"
                            min={0}
                            className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">Helps compare candidates at similar CQI scores</p>
                    </div>

                    {/* Optional fields */}
                    {(parsed?.phone || parsed?.current_title) && (
                      <div className="grid grid-cols-2 gap-3">
                        {parsed.phone && (
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">Phone</label>
                            <p className="text-sm text-slate-400">{parsed.phone}</p>
                          </div>
                        )}
                        {parsed.current_title && (
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">Current Title</label>
                            <p className="text-sm text-slate-400">{parsed.current_title}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Scoring notice */}
                    {hasJd && (
                      <div className="px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                        This project has a job description — Cortex will auto-score the resume on add.
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/8 flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:text-slate-200 hover:border-white/20 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              {showFields && !parsing && (
                <button
                  onClick={handleAddAnother}
                  disabled={!canSubmit}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 border border-white/15 hover:border-white/25 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add Another
                </button>
              )}

              <button
                onClick={showFields && !parsing ? handleSubmit : undefined}
                disabled={showFields ? !canSubmit : true}
                className={cn(
                  'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-150',
                  showFields && !parsing
                    ? 'bg-gradient-brand hover-glow disabled:opacity-50 disabled:cursor-not-allowed'
                    : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed opacity-50',
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {hasJd ? 'Cortex is scoring resume...' : 'Adding...'}
                  </>
                ) : parsing ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Reading...
                  </>
                ) : (
                  <><UserPlus className="w-4 h-4" />Add Candidate</>
                )}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
