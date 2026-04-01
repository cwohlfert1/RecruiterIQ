'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  UserPlus,
  Copy,
  ExternalLink,
  Send,
  Trash2,
  Archive,
  X,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Assessment, AssessmentQuestion, AssessmentInvite, AssessmentSession } from '@/types/database'

const statusBadge: Record<string, string> = {
  draft:     'bg-slate-700/60 text-slate-300 border-slate-600/40',
  published: 'bg-green-500/15 text-green-400 border-green-500/25',
  archived:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
}

const inviteStatusBadge: Record<string, string> = {
  pending:   'bg-slate-700/60 text-slate-300 border-slate-600/40',
  started:   'bg-blue-500/15 text-blue-400 border-blue-500/25',
  completed: 'bg-green-500/15 text-green-400 border-green-500/25',
  expired:   'bg-red-500/15 text-red-400 border-red-500/25',
}

function ScorePill({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-500 text-sm">—</span>
  const color = value >= 70 ? 'text-green-400' : value >= 40 ? 'text-yellow-400' : 'text-red-400'
  return <span className={cn('text-sm font-semibold tabular-nums', color)}>{value}</span>
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card rounded-2xl p-5 text-center">
      <p className="text-2xl font-semibold text-white tabular-nums">{value}</p>
      <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{label}</p>
    </div>
  )
}

interface Props {
  assessment:      Assessment
  questions:       AssessmentQuestion[]
  invites:         AssessmentInvite[]
  sessionByInvite: Record<string, AssessmentSession>
  stats: {
    inviteCount:    number
    completedCount: number
    avgTrust:       number | null
    avgSkill:       number | null
  }
}

export function AssessmentDetail({ assessment, questions, invites, sessionByInvite, stats }: Props) {
  const router  = useRouter()
  const [tab, setTab]               = useState<'candidates' | 'settings'>('candidates')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteName, setInviteName]   = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [sending, setSending]         = useState(false)
  const [copied, setCopied]           = useState<string | null>(null)
  const [deleting, setDeleting]       = useState(false)
  const [archiving, setArchiving]     = useState(false)

  const candidateBase = typeof window !== 'undefined' ? window.location.origin : ''

  async function sendInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/assessments/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId:   assessment.id,
          candidateName:  inviteName.trim(),
          candidateEmail: inviteEmail.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to send')
      toast.success(`Invite sent to ${inviteEmail}`)
      setInviteName('')
      setInviteEmail('')
      setShowInviteModal(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setSending(false)
    }
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${candidateBase}/assess/${token}`)
    setCopied(token)
    toast.success('Link copied')
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleArchive() {
    setArchiving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    await supabase.from('assessments').update({ status: 'archived' }).eq('id', assessment.id)
    toast.success('Assessment archived')
    router.refresh()
    setArchiving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this draft? This cannot be undone.')) return
    setDeleting(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    await supabase.from('assessments').delete().eq('id', assessment.id)
    toast.success('Assessment deleted')
    router.push('/dashboard/assessments')
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-white">{assessment.title}</h1>
            <span className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize',
              statusBadge[assessment.status]
            )}>
              {assessment.status}
            </span>
          </div>
          <p className="text-sm text-slate-400">{assessment.role}</p>
          <p className="text-xs text-slate-600 mt-0.5">
            Created {new Date(assessment.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {assessment.status === 'published' && (
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400 border border-white/10 hover:border-yellow-500/30 hover:text-yellow-400 transition-colors disabled:opacity-40"
            >
              <Archive className="w-4 h-4" />
              Archive
            </button>
          )}
          {assessment.status === 'draft' && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400 border border-white/10 hover:border-red-500/30 hover:text-red-400 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          {assessment.status === 'published' && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
            >
              <UserPlus className="w-4 h-4" />
              Invite Candidate
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Invites Sent"  value={stats.inviteCount} />
        <StatBox label="Completed"     value={stats.completedCount} />
        <StatBox label="Avg Trust"     value={stats.avgTrust  ?? '—'} />
        <StatBox label="Avg Skill"     value={stats.avgSkill  ?? '—'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/8 w-fit">
        {(['candidates', 'settings'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 capitalize',
              tab === t
                ? 'bg-indigo-500/20 text-indigo-300 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Candidates tab */}
      {tab === 'candidates' && (
        <div className="glass-card rounded-2xl overflow-hidden">
          {invites.length === 0 ? (
            <div className="py-14 flex flex-col items-center text-center">
              <p className="text-sm text-slate-500 mb-3">No candidates invited yet.</p>
              {assessment.status === 'published' && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  + Invite your first candidate
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Candidate</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Email</th>
                    <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Status</th>
                    <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Trust</th>
                    <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Skill</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Sent</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite, i) => {
                    const session = sessionByInvite[invite.id]
                    return (
                      <motion.tr
                        key={invite.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-white/5 hover:bg-white/3 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-medium text-white">{invite.candidate_name}</td>
                        <td className="px-4 py-3.5 text-slate-400 text-xs">{invite.candidate_email}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize',
                            inviteStatusBadge[invite.status]
                          )}>
                            {invite.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <ScorePill value={session?.trust_score ?? null} />
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <ScorePill value={session?.skill_score ?? null} />
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs">
                          {invite.sent_at ? formatRelativeTime(invite.sent_at) : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {invite.status === 'completed' && session && (
                              <Link
                                href={`/dashboard/assessments/${assessment.id}/report/${session.id}`}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
                                title="View report"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            )}
                            <button
                              onClick={() => copyLink(invite.token)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
                              title="Copy link"
                            >
                              {copied === invite.token
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                : <Copy className="w-3.5 h-3.5" />
                              }
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Settings tab */}
      {tab === 'settings' && (
        <div className="glass-card rounded-2xl p-6 space-y-5">
          <h3 className="text-sm font-semibold text-white">Assessment Settings</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Time Limit</p>
                <p className="text-white">{assessment.time_limit_minutes} minutes</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Question Order</p>
                <p className="text-white capitalize">{assessment.question_order}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Presentation</p>
                <p className="text-white capitalize">{assessment.presentation_mode.replace('_', ' ')}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Questions ({questions.length})</p>
              <div className="space-y-1.5">
                {questions.map((q, i) => (
                  <div key={q.id} className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">{i + 1}.</span>
                    <span className="text-xs text-slate-400 truncate">{q.prompt}</span>
                    <span className="text-xs text-slate-600 flex-shrink-0">{q.points}pt</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {assessment.status === 'draft' && (
            <div className="pt-2 border-t border-white/8">
              <Link
                href={`/dashboard/assessments/create`}
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Edit in builder →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInviteModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-[#1A1D2E] border border-white/10 rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white">Invite Candidate</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Full name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="Email address"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendInvite}
                disabled={sending || !inviteName.trim() || !inviteEmail.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
