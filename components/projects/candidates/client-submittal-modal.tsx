'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Copy, Check, RefreshCw, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'

interface Props {
  open: boolean
  candidate: CandidateRow | null
  project: { id: string; title: string; client_name: string; jd_text: string | null }
  onClose: () => void
}

export function ClientSubmittalModal({ open, candidate, project, onClose }: Props) {
  const [submittal, setSubmittal] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [billRate, setBillRate] = useState('')
  const [interviewAvail, setInterviewAvail] = useState('')
  const [startDate, setStartDate] = useState('')

  useEffect(() => {
    if (open && candidate) {
      setSubmittal('')
      setCopied(false)
      setBillRate('')
      setInterviewAvail('')
      setStartDate('')
      generate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidate?.id])

  async function generate() {
    if (!candidate) return
    setLoading(true)
    try {
      const res = await fetch('/api/generate-client-submittal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_text: candidate.resume_text,
          jd_text: project.jd_text,
          cqi_score: candidate.cqi_score,
          cqi_breakdown: candidate.cqi_breakdown_json,
          candidate_name: candidate.candidate_name,
          job_title: project.title,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSubmittal(data.submittal ?? '')
    } catch {
      toast.error('Failed to generate submittal')
    } finally {
      setLoading(false)
    }
  }

  function buildCopyText(): string {
    let text = submittal + '\n\n'
    text += `Name:             ${candidate?.candidate_name ?? ''}\n`
    text += `Position:         ${project.title}\n`
    text += `Bill Rate:        ${billRate || ''}\n`
    text += `Interview Avail:  ${interviewAvail || ''}\n`
    text += `Start Date:       ${startDate || ''}\n`
    return text
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildCopyText())
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  function handleExportWord() {
    const html = `<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px">
      <h2>${candidate?.candidate_name} — Client Submittal</h2>
      <p style="color:#64748b">${project.title} — ${project.client_name}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">
      ${submittal.split('\n').map(l => `<p>${l}</p>`).join('')}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">
      <table style="font-size:14px">
        <tr><td style="padding:4px 16px 4px 0;color:#64748b">Name:</td><td>${candidate?.candidate_name ?? ''}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#64748b">Position:</td><td>${project.title}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#64748b">Bill Rate:</td><td>${billRate}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#64748b">Interview Avail:</td><td>${interviewAvail}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#64748b">Start Date:</td><td>${startDate}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:11px;margin-top:24px">Prepared by Candid.ai — Confidential</p>
    </body></html>`
    const blob = new Blob([html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${candidate?.candidate_name?.replace(/\s+/g, '-') ?? 'submittal'}-client-submittal.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/50 z-50" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full max-w-lg bg-[#12141F] border border-white/10 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
                <div>
                  <h2 className="text-sm font-semibold text-white">Client Submittal</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">{candidate?.candidate_name} — {project.title}</p>
                </div>
                <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {loading ? (
                  <div className="flex flex-col items-center py-12 gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                    <p className="text-xs text-slate-500">Cortex is writing your submittal...</p>
                  </div>
                ) : submittal ? (
                  <>
                    {/* Bullets */}
                    <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {submittal}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-white/8" />

                    {/* Candidate Details */}
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Candidate Details</p>
                      <DetailRow label="Name" value={candidate?.candidate_name ?? ''} readOnly />
                      <DetailRow label="Position" value={project.title} readOnly />
                      <DetailRow label="Bill Rate" value={billRate} onChange={setBillRate} placeholder="e.g. $85/hr" />
                      <DetailRow label="Interview Avail" value={interviewAvail} onChange={setInterviewAvail} placeholder="e.g. Available this week" />
                      <DetailRow label="Start Date" value={startDate} onChange={setStartDate} placeholder="e.g. 2 weeks notice" />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">No submittal generated yet.</p>
                )}
              </div>

              {/* Footer */}
              {submittal && !loading && (
                <div className="px-6 py-4 border-t border-white/8 flex gap-2 flex-shrink-0">
                  <button
                    onClick={handleCopy}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all',
                      copied
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400',
                    )}
                  >
                    {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                  <button
                    onClick={generate}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-slate-300 border border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                  </button>
                  <button
                    onClick={handleExportWord}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-slate-300 border border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Word Doc
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function DetailRow({ label, value, readOnly, onChange, placeholder }: {
  label: string; value: string; readOnly?: boolean; onChange?: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-28 flex-shrink-0">{label}:</span>
      {readOnly ? (
        <span className="text-xs text-white">{value}</span>
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
        />
      )}
    </div>
  )
}
