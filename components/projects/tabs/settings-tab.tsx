'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, UserMinus, AlertTriangle, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────

interface Member {
  id:        string
  user_id:   string
  role:      string
  email:     string | null
  added_at?: string | null
}

interface Props {
  projectId:   string
  projectTitle: string
  canEdit:     boolean
  isOwner:     boolean
  members:     Member[]
  onMembersChange?: (members: Member[]) => void
  onShareClick?: () => void
}

// ─── Role badge ───────────────────────────────────────────────

const ROLE_STYLES: Record<string, string> = {
  owner:        'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  collaborator: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  viewer:       'bg-slate-500/15 text-slate-400 border-slate-500/20',
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={cn(
      'text-xs font-semibold px-2 py-0.5 rounded-full border capitalize',
      ROLE_STYLES[role] ?? ROLE_STYLES.viewer
    )}>
      {role}
    </span>
  )
}

// ─── Section wrapper ──────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────

export function SettingsTab({
  projectId,
  projectTitle,
  canEdit,
  isOwner,
  members,
  onMembersChange,
  onShareClick,
}: Props) {
  const router = useRouter()

  // Delete project state
  const [deletePhase,  setDeletePhase]  = useState<'idle' | 'confirm'>('idle')
  const [deleteInput,  setDeleteInput]  = useState('')
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState<string | null>(null)

  // Remove member state
  const [removingId,   setRemovingId]   = useState<string | null>(null)
  const [removeError,  setRemoveError]  = useState<string | null>(null)

  // ── Delete project ────────────────────────────────────────

  async function handleDelete() {
    if (deleteInput.trim() !== projectTitle.trim()) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        setDeleteError(json.error ?? 'Delete failed')
        setDeleting(false)
        return
      }
      router.push('/dashboard/projects')
    } catch {
      setDeleteError('Something went wrong. Please try again.')
      setDeleting(false)
    }
  }

  // ── Remove member ─────────────────────────────────────────

  async function handleRemoveMember(memberId: string) {
    if (!isOwner) return
    setRemovingId(memberId)
    setRemoveError(null)
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members/${memberId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const json = await res.json()
        setRemoveError(json.error ?? 'Failed to remove member')
        setRemovingId(null)
        return
      }
      onMembersChange?.(members.filter(m => m.id !== memberId))
    } catch {
      setRemoveError('Something went wrong. Please try again.')
    } finally {
      setRemovingId(null)
    }
  }

  const nonOwnerMembers = members.filter(m => m.role !== 'owner')
  const ownerMember     = members.find(m => m.role === 'owner')

  return (
    <div className="space-y-8 max-w-2xl">

      {/* ── Team Members ──────────────────────────────────── */}
      <Section title="Team Members">
        <div className="space-y-2">

          {/* Owner row */}
          {ownerMember && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/6">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {ownerMember.email ? ownerMember.email[0].toUpperCase() : 'O'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {ownerMember.email ?? 'Owner'}
                </p>
              </div>
              <RoleBadge role="owner" />
            </div>
          )}

          {/* Non-owner members */}
          {nonOwnerMembers.map(member => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/6"
            >
              <div
                className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{
                  background: member.email
                    ? `hsl(${(member.email.charCodeAt(0) * 47) % 360}, 50%, 40%)`
                    : undefined
                }}
              >
                {member.email ? member.email[0].toUpperCase() : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {member.email ?? member.user_id}
                </p>
              </div>
              <RoleBadge role={member.role} />
              {isOwner && (
                <button
                  onClick={() => handleRemoveMember(member.id)}
                  disabled={removingId === member.id}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                  title="Remove member"
                >
                  {removingId === member.id
                    ? <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                    : <UserMinus className="w-4 h-4" />
                  }
                </button>
              )}
            </div>
          ))}

          {nonOwnerMembers.length === 0 && !ownerMember && (
            <p className="text-sm text-slate-500 py-2">No members yet.</p>
          )}

          {removeError && (
            <p className="text-xs text-rose-400 mt-1">{removeError}</p>
          )}
        </div>

        {isOwner && onShareClick && (
          <button
            onClick={onShareClick}
            className="mt-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/25 transition-colors"
          >
            + Add team members
          </button>
        )}
      </Section>

      {/* ── Danger Zone ───────────────────────────────────── */}
      {isOwner && (
        <Section title="Danger Zone">
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-rose-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Delete project</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Permanently delete this project and all associated data. This cannot be undone.
                </p>
              </div>
            </div>

            {deletePhase === 'idle' ? (
              <button
                onClick={() => setDeletePhase('confirm')}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20 hover:bg-rose-500/25 transition-colors"
              >
                Delete this project
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Type <strong className="font-mono">{projectTitle}</strong> to confirm deletion</span>
                </div>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder={projectTitle}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
                />
                {deleteError && (
                  <p className="text-xs text-rose-400">{deleteError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleteInput.trim() !== projectTitle.trim() || deleting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {deleting
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Check className="w-4 h-4" />
                    }
                    Confirm delete
                  </button>
                  <button
                    onClick={() => { setDeletePhase('idle'); setDeleteInput(''); setDeleteError(null) }}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {!canEdit && !isOwner && (
        <p className="text-sm text-slate-500">
          You have view-only access to this project.
        </p>
      )}
    </div>
  )
}
