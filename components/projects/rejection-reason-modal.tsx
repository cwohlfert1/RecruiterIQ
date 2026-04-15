'use client'

import { useState } from 'react'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const REASONS = [
  'Not technical enough',
  'Overqualified',
  'Rate too high',
  'Client went another direction',
  'Candidate withdrew',
  'No response from client',
  'Failed assessment',
  'Cultural fit concern',
  'Catfish / Fake candidate',
  'Other',
]

interface Props {
  open: boolean
  candidateName: string
  candidateId: string
  projectId: string
  onClose: () => void
  onSaved: () => void
}

export function RejectionReasonModal({ open, candidateName, candidateId, projectId, onClose, onSaved }: Props) {
  const [reason, setReason] = useState('')
  const [otherText, setOtherText] = useState('')
  const [catfishNotes, setCatfishNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const isCatfish = reason === 'Catfish / Fake candidate'
  const isOther = reason === 'Other'
  const canSave = reason && (isOther ? otherText.trim() : true)

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/candidates/${candidateId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: 'rejected',
          rejection_reason: isOther ? otherText.trim() : reason,
          is_catfish: isCatfish,
          catfish_notes: isCatfish ? catfishNotes.trim() || null : null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Rejection reason saved')
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md bg-[#12141F] border border-white/10 rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
                <div>
                  <h2 className="text-sm font-semibold text-white">Why was {candidateName} rejected?</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">This helps Cortex learn your client&apos;s preferences</p>
                </div>
                <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-4 space-y-3 max-h-80 overflow-y-auto">
                {REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors',
                      reason === r
                        ? 'border-indigo-500/50 bg-indigo-500/10 text-white'
                        : 'border-white/8 bg-white/3 text-slate-300 hover:border-white/15',
                    )}
                  >
                    {r}
                  </button>
                ))}

                {isOther && (
                  <input
                    type="text"
                    value={otherText}
                    onChange={e => setOtherText(e.target.value)}
                    placeholder="Describe the reason..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                  />
                )}

                {isCatfish && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      <span>What tipped you off?</span>
                    </div>
                    <input
                      type="text"
                      value={catfishNotes}
                      onChange={e => setCatfishNotes(e.target.value.slice(0, 200))}
                      placeholder="e.g., Certifications listed but no employment to back them up"
                      maxLength={200}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                    />
                    <p className="text-[10px] text-slate-600 text-right">{catfishNotes.length}/200</p>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-white/8 flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-400 border border-white/10 hover:text-white hover:border-white/20 transition-colors">
                  Skip
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave || saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 transition-all"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
