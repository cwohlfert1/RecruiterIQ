'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, CheckCircle2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { AssessmentDraft } from './assessment-builder'
import type { UserProfile } from '@/types/database'

const typeLabel: Record<string, string> = {
  coding:          'Coding',
  multiple_choice: 'Multiple Choice',
  written:         'Written',
}

const typeBadge: Record<string, string> = {
  coding:          'bg-violet-500/15 text-violet-300 border-violet-500/25',
  multiple_choice: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  written:         'bg-green-500/15 text-green-300 border-green-500/25',
}

const PROCTORING_LABELS: Record<string, string> = {
  tab_switching:       'Tab Switching Detection',
  paste_detection:     'Copy / Paste Detection',
  eye_tracking:        'Eye Tracking',
  keystroke_dynamics:  'Keystroke Dynamics',
  presence_challenges: 'Human Presence Challenges',
  snapshots:           'Periodic Snapshots',
}

interface Props {
  draft:          AssessmentDraft
  profile:        UserProfile
  saving:         boolean
  publishedId:    string | null
  publishedToken: string | null
  onBack:         () => void
  onSaveDraft:    () => void
  onPublish:      () => void
}

export function BuilderStep4Review({
  draft,
  saving,
  publishedId,
  publishedToken,
  onBack,
  onSaveDraft,
  onPublish,
}: Props) {
  const [copied, setCopied]             = useState(false)
  const [inviteName, setInviteName]     = useState('')
  const [inviteEmail, setInviteEmail]   = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  const candidateLink = publishedToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/assess/${publishedToken}`
    : null

  function copyLink() {
    if (!candidateLink) return
    navigator.clipboard.writeText(candidateLink)
    setCopied(true)
    toast.success('Link copied')
    setTimeout(() => setCopied(false), 2000)
  }

  async function sendInvite() {
    if (!publishedId || !inviteName.trim() || !inviteEmail.trim()) return
    setSendingInvite(true)
    try {
      const res = await fetch('/api/assessments/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId:   publishedId,
          candidateName:  inviteName.trim(),
          candidateEmail: inviteEmail.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to send')
      toast.success(`Invite sent to ${inviteEmail}`)
      setInviteName('')
      setInviteEmail('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setSendingInvite(false)
    }
  }

  const enabledProctoring = Object.entries(draft.proctoring)
    .filter(([key, val]) => key !== 'presence_challenge_frequency' && val === true)
    .map(([key]) => key)

  const totalPoints = draft.questions.reduce((sum, q) => sum + q.points, 0)

  if (publishedId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-8 space-y-6"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-500/15 border border-green-500/25 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-1">Assessment Published!</h2>
          <p className="text-sm text-slate-400">Share the link below with your candidates.</p>
        </div>

        {/* Candidate link */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
            Candidate Link
          </label>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="flex-1 text-sm text-indigo-300 truncate font-mono">{candidateLink}</p>
            <button
              onClick={copyLink}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Send invite */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
            Send to a Candidate
          </label>
          <div className="space-y-2">
            <input
              type="text"
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              placeholder="Candidate name"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
            />
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="candidate@email.com"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
              <button
                onClick={sendInvite}
                disabled={sendingInvite || !inviteName.trim() || !inviteEmail.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {sendingInvite ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        <a
          href="/dashboard/assessments"
          className="block text-center text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          View all assessments →
        </a>
      </motion.div>
    )
  }

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-0.5">Review & Publish</h2>
        <p className="text-sm text-slate-400">Confirm everything looks right before publishing</p>
      </div>

      {/* Details summary */}
      <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Details</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-slate-500">Title</span>
          <span className="text-white font-medium">{draft.title}</span>
          <span className="text-slate-500">Role</span>
          <span className="text-white">{draft.role}</span>
          <span className="text-slate-500">Time Limit</span>
          <span className="text-white">
            {draft.time_limit_enabled ? `${draft.time_limit_minutes} minutes` : 'No limit'}
          </span>
          <span className="text-slate-500">Question Order</span>
          <span className="text-white capitalize">{draft.question_order}</span>
          <span className="text-slate-500">Total Points</span>
          <span className="text-white">{totalPoints}</span>
        </div>
      </div>

      {/* Questions summary */}
      <div className="p-4 rounded-xl bg-white/3 border border-white/8">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
          Questions ({draft.questions.length})
        </h3>
        <div className="space-y-2">
          {draft.questions.map((q, i) => (
            <div key={q.id} className="flex items-center gap-3">
              <span className="text-xs text-slate-600 w-4">{i + 1}.</span>
              <span className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border',
                typeBadge[q.type]
              )}>
                {typeLabel[q.type]}
              </span>
              <span className="flex-1 text-sm text-slate-300 truncate">{q.prompt}</span>
              <span className="text-xs text-slate-500">{q.points} pts</span>
            </div>
          ))}
        </div>
      </div>

      {/* Proctoring summary */}
      <div className="p-4 rounded-xl bg-white/3 border border-white/8">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Proctoring</h3>
        {enabledProctoring.length === 0 ? (
          <p className="text-sm text-slate-500">No proctoring features enabled.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {enabledProctoring.map(key => (
              <span key={key} className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 px-2 py-0.5 rounded-full">
                {PROCTORING_LABELS[key] ?? key}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-2">
        <button
          onClick={onBack}
          disabled={saving}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors disabled:opacity-40"
        >
          ← Back
        </button>
        <div className="flex gap-3">
          <button
            onClick={onSaveDraft}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:border-white/20 hover:text-white transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            onClick={onPublish}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-40"
          >
            {saving ? 'Publishing…' : 'Publish Assessment'}
          </button>
        </div>
      </div>
    </div>
  )
}
