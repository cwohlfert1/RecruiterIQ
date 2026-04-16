'use client'

import { useState } from 'react'
import { AlertOctagon, CheckCircle2, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  trustScore:      number | null
  candidateName:   string
  candidateEmail:  string
}

export function AutoFlagBanner({ trustScore, candidateName, candidateEmail }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [reason,    setReason]    = useState('')
  const [flagging,  setFlagging]  = useState(false)
  const [flagged,   setFlagged]   = useState(false)

  const lowTrust = (trustScore ?? 100) < 35
  if (!lowTrust || dismissed) return null

  async function handleFlag() {
    if (!candidateEmail) return
    setFlagging(true)
    try {
      const res = await fetch('/api/flags', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          candidate_email: candidateEmail,
          candidate_name:  candidateName,
          flag_type:       'catfish',
          reason:          reason.trim() || `Trust score ${trustScore}/100 — potential academic dishonesty detected`,
        }),
      })
      if (res.ok) {
        setFlagged(true)
        toast.success(`${candidateName} flagged as Catfish in the DNU registry`)
      } else {
        toast.error('Failed to flag candidate')
      }
    } catch {
      toast.error('Failed to flag candidate')
    } finally {
      setFlagging(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertOctagon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-300">Low Trust Score Detected</p>
          <p className="text-xs text-amber-400/80 mt-0.5">
            Trust score of <strong>{trustScore}/100</strong> is below the 35-point threshold. This may indicate academic dishonesty. Consider flagging this candidate.
          </p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-300 transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!flagged ? (
        <div className="flex items-center gap-2 ml-8">
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Optional reason…"
            className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
          <button
            onClick={handleFlag}
            disabled={flagging}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {flagging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertOctagon className="w-3.5 h-3.5" />}
            Flag as Catfish
          </button>
        </div>
      ) : (
        <div className="ml-8 flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          Flagged in agency DNU registry
        </div>
      )}
    </div>
  )
}
