'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Trash2, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/ui/user-avatar'

interface Note {
  id:         string
  user_id:    string
  content:    string
  created_at: string
  user_email: string | null
}

interface MemberOption {
  user_id: string
  email:   string | null
}

interface Props {
  candidateId: string
  projectId:   string
  userId:      string
  canEdit:     boolean
  members?:    MemberOption[]
}


// Render note content, turning @[userId:Name] tokens into indigo badges
function NoteContent({ content }: { content: string }) {
  const parts = content.split(/(@\[[^\]]+\])/g)
  return (
    <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        const match = part.match(/^@\[([^\]:]+):([^\]]+)\]$/)
        if (match) {
          return (
            <span key={i} className="inline-flex items-center text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-1 py-0.5 rounded text-[10px] font-medium mx-0.5">
              @{match[2]}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

export function CandidateNotes({ candidateId, projectId, userId, canEdit, members = [] }: Props) {
  const [notes,      setNotes]      = useState<Note[]>([])
  const [loading,    setLoading]    = useState(true)
  const [content,    setContent]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // @mention state
  const [mentionQuery,    setMentionQuery]    = useState<string | null>(null)
  const [mentionStart,    setMentionStart]    = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/projects/${projectId}/candidates/${candidateId}/notes`)
      .then(r => r.json())
      .then(json => { if (json.notes) setNotes(json.notes) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [candidateId, projectId])

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val    = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setContent(val)

    // Check if we're inside an @mention (look back from cursor for @)
    const before = val.slice(0, cursor)
    const atIdx  = before.lastIndexOf('@')

    if (atIdx !== -1) {
      const fragment = before.slice(atIdx + 1)
      // Only trigger if no space after the @
      if (!fragment.includes(' ') && !fragment.includes('\n')) {
        setMentionQuery(fragment.toLowerCase())
        setMentionStart(atIdx)
        return
      }
    }
    setMentionQuery(null)
  }, [])

  function insertMention(member: MemberOption) {
    const name   = member.email ? member.email.split('@')[0] : member.user_id.slice(0, 8)
    const token  = `@[${member.user_id}:${name}]`
    const cursor = textareaRef.current?.selectionStart ?? content.length
    const before = content.slice(0, mentionStart)
    const after  = content.slice(cursor)
    const next   = before + token + ' ' + after
    setContent(next)
    setMentionQuery(null)
    // Re-focus textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = before.length + token.length + 1
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  const filteredMembers = mentionQuery !== null
    ? members.filter(m => {
        const name = m.email ? m.email.split('@')[0].toLowerCase() : ''
        return name.includes(mentionQuery) || m.user_id.includes(mentionQuery)
      })
    : []

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
      setMentionQuery(null)
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
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={e => {
                if (e.key === 'Escape') { setMentionQuery(null); return }
                if (mentionQuery !== null && filteredMembers.length > 0 && e.key === 'Enter') {
                  e.preventDefault()
                  insertMention(filteredMembers[0])
                  return
                }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault(); addNote()
                }
              }}
              placeholder={members.length > 0 ? 'Add a note… Type @ to mention a team member' : 'Add a note… (⌘+Enter to save)'}
              rows={2}
              disabled={saving}
              className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors disabled:opacity-50"
            />

            {/* @mention dropdown */}
            {mentionQuery !== null && filteredMembers.length > 0 && (
              <div className="absolute left-0 bottom-full mb-1 w-48 bg-[#1A1D2E] border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden">
                {filteredMembers.slice(0, 5).map(m => {
                  const name = m.email ? m.email.split('@')[0] : m.user_id.slice(0, 8)
                  return (
                    <button
                      key={m.user_id}
                      onMouseDown={e => { e.preventDefault(); insertMention(m) }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
                    >
                      <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                        {name[0]?.toUpperCase() ?? '?'}
                      </div>
                      @{name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
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
              <UserAvatar
                userId={note.user_id}
                email={note.user_email}
                size={24}
              />
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
                <NoteContent content={note.content} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
