'use client'

import { useState, useEffect } from 'react'
import { X, UserPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { FileDropTextarea } from '@/components/ui/file-drop-textarea'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'

interface Props {
  open:       boolean
  projectId:  string
  hasJd:      boolean
  onClose:    () => void
  onAdded:    (candidate: CandidateRow) => void
}

export function AddCandidateSlideover({ open, projectId, hasJd, onClose, onAdded }: Props) {
  const [name,       setName]       = useState('')
  const [email,      setEmail]      = useState('')
  const [resume,     setResume]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [touched,    setTouched]    = useState({ name: false, email: false, resume: false })

  // Reset on open
  useEffect(() => {
    if (open) {
      setName(''); setEmail(''); setResume('')
      setTouched({ name: false, email: false, resume: false })
      setSubmitting(false)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const nameError   = touched.name   && !name.trim()  ? 'Name is required' : null
  const emailError  = touched.email  && (
    !email.trim() ? 'Email is required' :
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Invalid email' : null
  )
  const resumeError = touched.resume && !resume.trim() ? 'Resume is required' : null

  async function handleSubmit() {
    setTouched({ name: true, email: true, resume: true })
    if (!name.trim() || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !resume.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/candidates`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          candidate_name:  name.trim(),
          candidate_email: email.trim(),
          resume_text:     resume.trim(),
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

      if (!data.scored && hasJd) {
        toast.warning('Candidate added — scoring failed. You can score them manually.')
      } else if (!data.scored) {
        toast.warning('Candidate added without score — add a JD to enable auto-scoring.')
      } else {
        toast.success(`Candidate added — CQI: ${data.candidate.cqi_score}`)
      }

      onAdded(data.candidate as CandidateRow)
      onClose()
    } catch {
      toast.error('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

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
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Scoring notice */}
              {hasJd && (
                <div className="px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                  This project has a job description — the resume will be automatically scored on add.
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">
                  Candidate Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, name: true }))}
                  placeholder="Jane Smith"
                  className={cn(
                    'w-full px-4 py-2.5 rounded-xl bg-white/5 border text-sm text-slate-200 placeholder:text-slate-600',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
                    nameError ? 'border-red-500/60' : 'border-white/10 hover:border-white/20',
                  )}
                />
                {nameError && <p className="text-xs text-red-400">{nameError}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, email: true }))}
                  placeholder="jane@example.com"
                  className={cn(
                    'w-full px-4 py-2.5 rounded-xl bg-white/5 border text-sm text-slate-200 placeholder:text-slate-600',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
                    emailError ? 'border-red-500/60' : 'border-white/10 hover:border-white/20',
                  )}
                />
                {emailError && <p className="text-xs text-red-400">{emailError}</p>}
              </div>

              {/* Resume */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">
                  Resume <span className="text-red-400">*</span>
                </label>
                <FileDropTextarea
                  value={resume}
                  onChange={setResume}
                  placeholder="Paste resume text, or upload a PDF, DOCX, or TXT file…"
                  minHeight="220px"
                  rows={10}
                  error={touched.resume && resumeError ? resumeError : undefined}
                />
              </div>
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
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {hasJd ? 'Scoring against JD…' : 'Adding…'}
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
