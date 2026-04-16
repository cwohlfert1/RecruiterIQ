'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, StickyNote } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Assessment, AssessmentSession } from '@/types/database'

type Decision = 'approve' | 'do_not_submit' | null

function getRecommendation(session: AssessmentSession): { label: string; detail: string; color: string } {
  const trust = session.trust_score ?? 0
  const skill = session.skill_score ?? 0
  if (trust >= 70 && skill >= 70) return { label: 'Strong Candidate',    detail: 'High trust and strong skill scores — recommend submitting.', color: 'emerald' }
  if (trust >= 70 && skill >= 40) return { label: 'Potential Candidate', detail: 'Good integrity, moderate skill. Consider additional screening.', color: 'blue' }
  if (trust < 40)                 return { label: 'Integrity Concern',   detail: 'Low trust score suggests potential academic dishonesty. Review events carefully.', color: 'red' }
  if (skill < 40)                 return { label: 'Skills Gap',          detail: 'Candidate did not demonstrate sufficient technical skills for this role.', color: 'yellow' }
  return                                 { label: 'Review Required',     detail: 'Mixed signals — review proctoring events and skill responses before deciding.', color: 'slate' }
}

interface Props {
  assessment: Assessment
  session:    AssessmentSession
}

export function DecisionCard({ assessment, session }: Props) {
  const initialDecision = (session as Record<string, unknown>).recruiter_decision as Decision ?? null
  const initialNotes    = (session as Record<string, unknown>).decision_notes as string ?? ''

  const [decision,  setDecision]  = useState<Decision>(initialDecision)
  const [notes,     setNotes]     = useState(initialNotes)
  const [saving,    setSaving]    = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  const rec = getRecommendation(session)

  async function submit(value: 'approve' | 'do_not_submit') {
    setSaving(true)
    try {
      const res = await fetch(`/api/assessments/${assessment.id}/sessions/${session.id}/decision`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ decision: value, notes }),
      })
      if (res.ok) {
        setDecision(value)
        toast.success(value === 'approve' ? 'Marked as Approved' : 'Marked as Do Not Submit')
      } else {
        toast.error('Failed to save decision')
      }
    } catch {
      toast.error('Failed to save decision')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn(
      'glass-card rounded-2xl p-6 space-y-4 border',
      decision === 'approve'       ? 'border-emerald-500/30 bg-emerald-500/5' :
      decision === 'do_not_submit' ? 'border-red-500/30 bg-red-500/5' :
      'border-white/8'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white mb-1">Recruiter Decision</h2>
          <div className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
            rec.color === 'emerald' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' :
            rec.color === 'blue'    ? 'bg-blue-500/15 text-blue-300 border-blue-500/25' :
            rec.color === 'red'     ? 'bg-red-500/15 text-red-300 border-red-500/25' :
            rec.color === 'yellow'  ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25' :
            'bg-slate-500/15 text-slate-300 border-slate-500/25'
          )}>
            {rec.label}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{rec.detail}</p>
        </div>

        {decision && (
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border',
            decision === 'approve' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
            'bg-red-500/20 text-red-300 border-red-500/30'
          )}>
            {decision === 'approve' ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
            {decision === 'approve' ? 'Approved' : 'Do Not Submit'}
          </div>
        )}
      </div>

      {!decision && (
        <div className="flex gap-3">
          <button onClick={() => submit('approve')} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <ThumbsUp className="w-4 h-4" /> Approve
          </button>
          <button onClick={() => submit('do_not_submit')} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-300 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <ThumbsDown className="w-4 h-4" /> Do Not Submit
          </button>
          <button onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-white/5 border border-white/10 hover:border-white/20 hover:text-white transition-colors">
            <StickyNote className="w-4 h-4" /> {showNotes ? 'Hide Notes' : 'Add Notes'}
          </button>
        </div>
      )}

      {decision && (
        <button onClick={() => setDecision(null)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          Change decision
        </button>
      )}

      {(showNotes || notes) && (
        <div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes about this decision..."
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors resize-none"
          />
          {decision && (
            <button onClick={() => submit(decision)} disabled={saving}
              className="mt-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-brand hover-glow transition-all disabled:opacity-40">
              Save Notes
            </button>
          )}
        </div>
      )}
    </div>
  )
}
