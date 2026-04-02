'use client'

import { useState, useEffect } from 'react'
import { Trash2, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface Note {
  id:         string
  user_id:    string
  content:    string
  created_at: string
  user_email: string | null
}

interface Props {
  candidateId: string
  projectId:   string
  userId:      string
  canEdit:     boolean
}

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-purple-500',
  'bg-cyan-500',   'bg-rose-500',    'bg-amber-500',
]

function NoteAvatar({ email }: { email: string | null }) {
  const char  = email ? email[0].toUpperCase() : '?'
  const color = email ? AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length] : 'bg-slate-600'
  return (
    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0', color)}>
      {char}
    </div>
  )
}

export function CandidateNotes({ candidateId, projectId, userId, canEdit }: Props) {
  const [notes,     setNotes]     = useState<Note[]>([])
  const [loading,   setLoading]   = useState(true)
  const [content,   setContent]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/projects/${projectId}/candidates/${candidateId}/notes`)
      .then(r => r.json())
      .then(json => { if (json.notes) setNotes(json.notes) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [candidateId, projectId])

  async function addNote() {
    const text = content.trim()
    if (!text) return
    setSaving(true)
    try {
      const res  = await fetch(`/api/projects/${projectId}/candidates/${candidateId}/notes`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: text }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to add note'); return }
      setNotes(prev => [data.note, ...prev])
      setContent('')
    } catch {
      toast.error('Failed to add note')
    } finally { setSaving(false) }
  }

  async function deleteNote(noteId: string) {
    if (!confirm('Delete this note?')) return
    setDeletingId(noteId)
    try {
      const res = await fetch(`/api/projects/${projectId}/candidates/${candidateId}/notes/${noteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) { toast.error('Failed to delete note'); return }
      setNotes(prev => prev.filter(n => n.id !== noteId))
    } catch {
      toast.error('Failed to delete note')
    } finally { setDeletingId(null) }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-slate-600">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading notes…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Add note */}
      {canEdit && (
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault(); addNote()
              }
            }}
            placeholder="Add a note… (⌘+Enter to save)"
            rows={2}
            disabled={saving}
            className="flex-1 text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors disabled:opacity-50"
          />
          <button
            onClick={addNote}
            disabled={saving || !content.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-xs text-slate-600 italic">No notes yet</p>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="flex gap-2.5">
              <NoteAvatar email={note.user_email} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-medium text-slate-400">
                    {note.user_email?.split('@')[0] ?? 'Unknown'}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </span>
                  {note.user_id === userId && (
                    <button
                      onClick={() => deleteNote(note.id)}
                      disabled={deletingId === note.id}
                      className="ml-auto text-slate-700 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {deletingId === note.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />
                      }
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap break-words">
                  {note.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
