'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertOctagon, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type FlagType = 'catfish' | 'dnu' | 'watch'

interface FlagOption {
  type:        FlagType
  label:       string
  description: string
  color:       string
  bg:          string
  border:      string
}

const FLAG_OPTIONS: FlagOption[] = [
  {
    type:        'catfish',
    label:       'Catfish',
    description: 'Suspicious identity or fabricated credentials',
    color:       'text-rose-400',
    bg:          'bg-rose-500/10',
    border:      'border-rose-500/30',
  },
  {
    type:        'dnu',
    label:       'Do Not Use',
    description: 'Previously placed and rejected, or known bad actor',
    color:       'text-orange-400',
    bg:          'bg-orange-500/10',
    border:      'border-orange-500/30',
  },
  {
    type:        'watch',
    label:       'Watch List',
    description: 'Proceed with caution — needs further vetting',
    color:       'text-yellow-400',
    bg:          'bg-yellow-500/10',
    border:      'border-yellow-500/30',
  },
]

interface Props {
  isOpen:          boolean
  candidateId:     string
  candidateName:   string
  candidateEmail:  string
  projectId:       string
  preselectedType?: FlagType | null
  onClose:         () => void
  onFlagged:       (flagType: FlagType) => void
}

export function FlagCandidateModal({
  isOpen,
  candidateId,
  candidateName,
  candidateEmail,
  projectId,
  preselectedType,
  onClose,
  onFlagged,
}: Props) {
  const [flagType, setFlagType] = useState<FlagType>(preselectedType ?? 'dnu')
  const [reason,   setReason]   = useState('')
  const [saving,   setSaving]   = useState(false)

  async function handleSubmit() {
    if (!flagType) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/candidates/${candidateId}/flag`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ flag_type: flagType, reason: reason.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to flag candidate'); return }
      onFlagged(flagType)
      toast.success(`${candidateName} flagged as ${FLAG_OPTIONS.find(o => o.type === flagType)?.label}`)
      onClose()
    } catch {
      toast.error('Failed to flag candidate')
    } finally { setSaving(false) }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          >
            <div className="bg-[#12141F] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">

              {/* Header */}
              <div className="flex items-start gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                  <AlertOctagon className="w-5 h-5 text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-white">Flag Candidate</h2>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{candidateName} · {candidateEmail}</p>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Flag type radio cards */}
              <div className="space-y-2 mb-4">
                {FLAG_OPTIONS.map(opt => (
                  <button
                    key={opt.type}
                    onClick={() => setFlagType(opt.type)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl border transition-all',
                      flagType === opt.type
                        ? `${opt.bg} ${opt.border} ${opt.color}`
                        : 'bg-white/3 border-white/8 text-slate-400 hover:border-white/15'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        flagType === opt.type ? `border-current` : 'border-slate-600'
                      )}>
                        {flagType === opt.type && (
                          <div className="w-1.5 h-1.5 rounded-full bg-current" />
                        )}
                      </div>
                      <p className="text-xs font-semibold">{opt.label}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 ml-5.5">{opt.description}</p>
                  </button>
                ))}
              </div>

              {/* Reason */}
              <div className="mb-5">
                <label className="text-xs text-slate-500 mb-1.5 block">Reason (optional)</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Describe why you're flagging this candidate…"
                  rows={3}
                  maxLength={500}
                  className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition-colors"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:text-white hover:border-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertOctagon className="w-4 h-4" />}
                  Flag Candidate
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
