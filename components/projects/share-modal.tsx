'use client'

import { useState, useEffect } from 'react'
import { X, UserPlus, Check, AlertTriangle, Crown } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────

interface AvailableMember {
  user_id: string
  email:   string
}

interface SelectedMember {
  user_id: string
  email:   string
  role:    'collaborator' | 'viewer'
}

interface Props {
  projectId: string
  planTier:  'free' | 'pro' | 'agency'
  onClose:   () => void
  onShared?: () => void
}

const PLAN_LIMITS: Record<string, number> = {
  free:   0,
  pro:    2,
  agency: Infinity,
}

const PLAN_LABELS: Record<string, string> = {
  free:   'Free',
  pro:    'Pro',
  agency: 'Agency',
}

// ─── Component ───────────────────────────────────────────────

export function ShareModal({ projectId, planTier, onClose, onShared }: Props) {
  const [available, setAvailable] = useState<AvailableMember[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<SelectedMember[]>([])
  const [sharing,   setSharing]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState(false)

  const limit     = PLAN_LIMITS[planTier] ?? 0
  const canShare  = limit > 0

  useEffect(() => {
    if (!canShare) { setLoading(false); return }
    fetch(`/api/projects/${projectId}/share`)
      .then(r => r.json())
      .then(json => {
        setAvailable(json.members ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [projectId, canShare])

  function toggleMember(member: AvailableMember) {
    setSelected(prev => {
      const exists = prev.find(s => s.user_id === member.user_id)
      if (exists) return prev.filter(s => s.user_id !== member.user_id)
      return [...prev, { ...member, role: 'collaborator' }]
    })
    setError(null)
  }

  function setRole(userId: string, role: 'collaborator' | 'viewer') {
    setSelected(prev => prev.map(s => s.user_id === userId ? { ...s, role } : s))
  }

  async function handleShare() {
    if (selected.length === 0) return
    setSharing(true)
    setError(null)
    try {
      const res  = await fetch(`/api/projects/${projectId}/share`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          members: selected.map(s => ({ user_id: s.user_id, role: s.role }))
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.code === 'plan_required') {
          setError('Upgrade your plan to share projects with team members.')
        } else if (json.code === 'limit_reached') {
          setError(json.error ?? 'Member limit reached for your plan.')
        } else {
          setError(json.error ?? 'Something went wrong.')
        }
        return
      }
      setSuccess(true)
      setTimeout(() => {
        onShared?.()
        onClose()
      }, 1200)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSharing(false)
    }
  }

  // ── Plan gate screen ──────────────────────────────────────

  if (!canShare) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl bg-[#1A1D2E] border border-white/10 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Share Project</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Crown className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-white mb-1">Upgrade to share projects</p>
              <p className="text-sm text-slate-400 max-w-xs">
                The <strong className="text-white">{PLAN_LABELS[planTier]}</strong> plan doesn&apos;t include project sharing.
                Upgrade to Pro or Agency to collaborate with your team.
              </p>
            </div>
            <a
              href="/dashboard/billing"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90 transition-opacity"
            >
              View Plans
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Main share UI ─────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-[#1A1D2E] border border-white/10 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/8 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Share Project</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {planTier === 'pro'
                ? 'Pro plan — up to 2 team members per project'
                : 'Agency plan — unlimited team members'
              }
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : available.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <UserPlus className="w-8 h-8 text-slate-600" />
              <div>
                <p className="text-sm font-medium text-slate-400">No team members available</p>
                <p className="text-xs text-slate-600 mt-1">
                  Add team members in your{' '}
                  <a href="/dashboard/settings" className="text-indigo-400 hover:underline">account settings</a>
                  {' '}to share projects with them.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Select team members to add
              </p>
              {available.map(member => {
                const sel = selected.find(s => s.user_id === member.user_id)
                return (
                  <div
                    key={member.user_id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      sel
                        ? 'bg-indigo-500/10 border-indigo-500/30'
                        : 'bg-white/3 border-white/6 hover:border-white/12'
                    }`}
                    onClick={() => toggleMember(member)}
                  >
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: `hsl(${member.email.charCodeAt(0) * 47 % 360}, 50%, 40%)` }}
                    >
                      {member.email[0].toUpperCase()}
                    </div>

                    {/* Email */}
                    <span className="flex-1 text-sm text-white truncate">{member.email}</span>

                    {/* Role picker (only when selected) */}
                    {sel && (
                      <div
                        className="flex gap-1"
                        onClick={e => e.stopPropagation()}
                      >
                        {(['collaborator', 'viewer'] as const).map(role => (
                          <button
                            key={role}
                            onClick={() => setRole(member.user_id, role)}
                            className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                              sel.role === role
                                ? 'bg-indigo-500 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Check indicator */}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      sel ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'
                    }`}>
                      {sel && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Selected summary */}
          {selected.length > 0 && (
            <div className="text-xs text-slate-400 bg-white/3 rounded-lg px-3 py-2 border border-white/6">
              {selected.length} member{selected.length !== 1 ? 's' : ''} selected —
              they&apos;ll receive an email notification and in-app alert.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/8 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={selected.length === 0 || sharing || success}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {success ? (
              <><Check className="w-4 h-4" /> Shared!</>
            ) : sharing ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sharing...</>
            ) : (
              <><UserPlus className="w-4 h-4" /> Share with {selected.length > 0 ? selected.length : ''} member{selected.length !== 1 ? 's' : ''}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
