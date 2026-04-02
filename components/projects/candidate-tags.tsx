'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const PRESET_TAGS = ['Top Pick', 'Strong Tech', 'Culture Fit', 'Follow Up', 'Not Qualified', 'On Hold']

const TAG_COLORS = [
  'bg-indigo-500/15 border-indigo-500/25 text-indigo-300',
  'bg-emerald-500/15 border-emerald-500/25 text-emerald-300',
  'bg-purple-500/15 border-purple-500/25 text-purple-300',
  'bg-cyan-500/15 border-cyan-500/25 text-cyan-300',
  'bg-rose-500/15 border-rose-500/25 text-rose-300',
  'bg-amber-500/15 border-amber-500/25 text-amber-300',
]

function tagColor(tag: string) {
  const code = tag.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return TAG_COLORS[code % TAG_COLORS.length]
}

interface Props {
  candidateId:   string
  projectId:     string
  initialTags:   string[]
  canEdit:       boolean
  onTagsChange?: (tags: string[]) => void
}

export function CandidateTags({ candidateId, projectId, initialTags, canEdit, onTagsChange }: Props) {
  const [tags,     setTags]     = useState<string[]>(initialTags)
  const [input,    setInput]    = useState('')
  const [showSugg, setShowSugg] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const inputRef               = useRef<HTMLInputElement>(null)

  const suggestions = PRESET_TAGS.filter(
    p => !tags.includes(p) && p.toLowerCase().includes(input.toLowerCase())
  )

  async function saveTags(nextTags: string[]) {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/candidates/${candidateId}/tags`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tags: nextTags }),
      })
      if (!res.ok) { toast.error('Failed to save tags'); return false }
      setTags(nextTags)
      onTagsChange?.(nextTags)
      return true
    } catch {
      toast.error('Failed to save tags')
      return false
    } finally { setSaving(false) }
  }

  async function addTag(tag: string) {
    const cleaned = tag.trim()
    if (!cleaned || tags.includes(cleaned)) return
    await saveTags([...tags, cleaned])
    setInput('')
    setShowSugg(false)
  }

  async function removeTag(tag: string) {
    await saveTags(tags.filter(t => t !== tag))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addTag(input) }
    if (e.key === 'Escape') { setShowSugg(false); setInput('') }
  }

  return (
    <div className="space-y-2">
      {/* Existing tags */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <span
            key={tag}
            className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border', tagColor(tag))}
          >
            {tag}
            {canEdit && (
              <button
                onClick={() => removeTag(tag)}
                disabled={saving}
                className="opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </span>
        ))}
        {tags.length === 0 && (
          <span className="text-xs text-slate-600 italic">No tags yet</span>
        )}
      </div>

      {/* Tag input (edit mode only) */}
      {canEdit && (
        <div className="relative">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 focus-within:border-indigo-500/40 transition-colors">
            <Plus className="w-3 h-3 text-slate-600 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); setShowSugg(true) }}
              onFocus={() => setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              onKeyDown={onKeyDown}
              placeholder="Add tag (Enter to save)"
              disabled={saving}
              className="flex-1 bg-transparent text-xs text-slate-300 placeholder:text-slate-600 outline-none disabled:opacity-50"
            />
          </div>

          {/* Suggestions dropdown */}
          {showSugg && (suggestions.length > 0 || input.trim().length > 0) && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-[#1A1D2E] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
              {input.trim() && !tags.includes(input.trim()) && !PRESET_TAGS.includes(input.trim()) && (
                <button
                  onMouseDown={() => addTag(input)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-3 h-3 text-indigo-400" />
                  Add &ldquo;{input.trim()}&rdquo;
                </button>
              )}
              {suggestions.map(s => (
                <button
                  key={s}
                  onMouseDown={() => addTag(s)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
