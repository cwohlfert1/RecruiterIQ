'use client'

import { useState, useEffect } from 'react'
import { X, ClipboardList, Loader2, Check, AlertTriangle, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'

interface Assessment {
  id:     string
  title:  string
  role:   string
  status: string
}

interface Props {
  open:      boolean
  candidate: CandidateRow | null
  project:   { id: string; title: string; client_name?: string; jd_text?: string | null }
  onClose:   () => void
  onSent:    (candidateId: string, inviteId: string) => void
}

export function SendAssessmentModal({ open, candidate, project, onClose, onSent }: Props) {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading,     setLoading]     = useState(false)
  const [selected,    setSelected]    = useState<string | null>(null)
  const [sending,     setSending]     = useState(false)
  const [showJdEdit,  setShowJdEdit]  = useState(false)
  const [jdOverride,  setJdOverride]  = useState('')

  const hasProjectJd = !!project.jd_text?.trim()
  const effectiveJd = showJdEdit ? jdOverride : (project.jd_text ?? '')

  useEffect(() => {
    if (open) {
      setSelected(null)
      setShowJdEdit(false)
      setJdOverride('')
      setLoading(true)
      fetch('/api/assessments/list-published')
        .then(r => r.json())
        .then(data => setAssessments(data.assessments ?? []))
        .catch(() => setAssessments([]))
        .finally(() => setLoading(false))
    }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleSend() {
    if (!selected || !candidate) return
    setSending(true)

    try {
      const res = await fetch('/api/assessments/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          assessmentId:   selected,
          candidateName:  candidate.candidate_name,
          candidateEmail: candidate.candidate_email,
          projectId:      project.id,
          jdText:         effectiveJd.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 403) {
          toast.error('Only managers can send assessments.')
        } else {
          toast.error(data.error ?? 'Failed to send assessment')
        }
        return
      }

      // Link invite to project candidate
      await fetch(`/api/projects/${project.id}/candidates/${candidate.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ assessment_invite_id: data.id }),
      })

      toast.success('Assessment sent!')
      onSent(candidate.id, data.id)
      onClose()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSending(false)
    }
  }

  const jdPreview = project.jd_text?.slice(0, 150) ?? ''

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{   opacity: 0, scale: 0.96,  y: 8 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full max-w-md bg-[#12141F] border border-white/10 rounded-2xl shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-semibold text-white">
                    Send Assessment to {candidate?.candidate_name}
                  </h2>
                </div>
                <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* JD context */}
              <div className="px-5 pt-4 pb-2">
                {hasProjectJd && !showJdEdit ? (
                  <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/15 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-indigo-400" />
                        <span className="text-[11px] font-medium text-indigo-300">
                          Using JD from: {project.title}{project.client_name ? ` — ${project.client_name}` : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => { setShowJdEdit(true); setJdOverride(project.jd_text ?? '') }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Change
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                      {jdPreview}{jdPreview.length >= 150 ? '…' : ''}
                    </p>
                  </div>
                ) : !hasProjectJd && !showJdEdit ? (
                  <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-3 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] text-amber-300 font-medium">No JD on this project</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Add one in Project Settings or paste manually below</p>
                      <button
                        onClick={() => setShowJdEdit(true)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 mt-1 transition-colors"
                      >
                        Paste JD manually
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-slate-400">Job Description</label>
                      {hasProjectJd && (
                        <button
                          onClick={() => setShowJdEdit(false)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          Use project JD
                        </button>
                      )}
                    </div>
                    <textarea
                      value={jdOverride}
                      onChange={e => setJdOverride(e.target.value)}
                      rows={4}
                      placeholder="Paste job description here…"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                )}
              </div>

              {/* Assessment list */}
              <div className="px-5 py-3 space-y-2 max-h-56 overflow-y-auto">
                <p className="text-[11px] text-slate-500 font-medium mb-1">Select assessment to send:</p>

                {loading && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading assessments…
                  </div>
                )}

                {!loading && assessments.length === 0 && (
                  <div className="text-sm text-slate-500 py-4 text-center">
                    No published assessments found.{' '}
                    <a href="/dashboard/assessments/create" className="text-indigo-400 hover:underline">
                      Create one
                    </a>
                  </div>
                )}

                {assessments.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-center justify-between gap-3',
                      selected === a.id
                        ? 'border-indigo-500/50 bg-indigo-500/10'
                        : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5',
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{a.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{a.role}</p>
                    </div>
                    {selected === a.id && <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-white/8 flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:text-slate-200 hover:border-white/20 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={!selected || sending}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : 'Send Assessment'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
