'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, Trash2, Crown, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { TeamMember } from '@/types/database'

const MAX_SEATS = 5

interface TeamClientProps {
  ownerEmail: string
  members: TeamMember[]
  callsByUser: Record<string, number>
}

export function TeamClient({ ownerEmail, members: initialMembers, callsByUser }: TeamClientProps) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  // owner = 1 seat; active+pending invites use the rest
  const seatsUsed = 1 + members.length
  const seatsAvailable = MAX_SEATS - seatsUsed
  const atLimit = seatsUsed >= MAX_SEATS

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || inviting) return

    if (atLimit) {
      toast.error("You've reached your 5-seat limit. Contact us to discuss enterprise pricing.")
      return
    }

    setInviting(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'seat_limit') {
          toast.error(data.message)
        } else {
          toast.error(data.error ?? 'Invite failed')
        }
        return
      }
      toast.success(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(memberId: string) {
    setRemovingId(memberId)
    try {
      const res = await fetch('/api/team/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Remove failed')
        return
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      toast.success('Member removed')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setRemovingId(null)
      setConfirmRemoveId(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Team Management</h1>
        <p className="text-slate-400 mt-1 text-sm">Invite and manage your recruiting team.</p>
      </div>

      {/* Seat counter */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-white">Seats</span>
          </div>
          <span className="text-sm text-slate-400">
            {seatsUsed} of {MAX_SEATS} used
          </span>
        </div>
        <div className="h-2 bg-white/8 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              atLimit ? 'bg-amber-500' : 'bg-indigo-500'
            )}
            style={{ width: `${(seatsUsed / MAX_SEATS) * 100}%` }}
          />
        </div>
        {atLimit && (
          <p className="text-xs text-amber-400 mt-2">
            Seat limit reached. Contact us for enterprise pricing.
          </p>
        )}
      </div>

      {/* Invite form */}
      <form onSubmit={handleInvite} className="glass-card p-5 space-y-3">
        <label className="block text-sm font-medium text-white">Invite team member</label>
        <div className="flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            disabled={atLimit || inviting}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inviteEmail.trim() || inviting || atLimit}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0"
          >
            {inviting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {inviting ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </form>

      {/* Members table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-semibold text-white">Team members</h2>
        </div>

        <div className="divide-y divide-white/5">
          {/* Owner row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-4 px-5 py-4"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {ownerEmail.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white truncate">{ownerEmail}</p>
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  <Crown className="w-2.5 h-2.5" />
                  Owner
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Full access · all features</p>
            </div>
            <span className="text-xs text-slate-400 flex-shrink-0">
              {callsByUser['owner'] ?? '—'} calls/mo
            </span>
          </motion.div>

          {/* Member rows */}
          <AnimatePresence>
            {members.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  'flex items-center gap-4 px-5 py-4',
                  m.status === 'pending' && 'opacity-60'
                )}
              >
                <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                  {m.invited_email.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{m.invited_email}</p>
                    {m.status === 'pending' && (
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {m.status === 'active' && m.joined_at
                      ? `Joined ${new Date(m.joined_at).toLocaleDateString()}`
                      : 'Invite sent'}
                  </p>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {m.member_user_id ? `${callsByUser[m.member_user_id] ?? 0} calls/mo` : '—'}
                </span>

                {/* Remove button / confirm */}
                {confirmRemoveId === m.id ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRemove(m.id)}
                      disabled={removingId === m.id}
                      className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-50"
                    >
                      {removingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmRemoveId(null)}
                      className="text-xs text-slate-500 hover:text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemoveId(m.id)}
                    className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {members.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-500">
              No team members yet. Send an invite above.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
