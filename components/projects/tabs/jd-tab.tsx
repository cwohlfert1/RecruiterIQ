'use client'

import { useState } from 'react'
import { Pencil, Save, X, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FileDropTextarea } from '@/components/ui/file-drop-textarea'
import { cn } from '@/lib/utils'

interface JdTabProps {
  projectId: string
  jdText:    string | null
  canEdit:   boolean
  onJdSaved: (newJd: string) => void
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function JdTab({ projectId, jdText, canEdit, onJdSaved }: JdTabProps) {
  const [editing,  setEditing]  = useState(!jdText)   // open editor if no JD yet
  const [draft,    setDraft]    = useState(jdText ?? '')
  const [saving,   setSaving]   = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  async function handleSave() {
    if (!draft.trim()) {
      toast.error('Job description cannot be empty')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/update`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jd_text: draft.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to save job description')
        return
      }
      onJdSaved(draft.trim())
      setEditing(false)
      setShowBanner(!!jdText)   // show rescore banner if JD was already set
      toast.success('Job description saved')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setDraft(jdText ?? '')
    setEditing(false)
  }

  // ── No JD yet ────────────────────────────────────────────────

  if (!jdText && !editing) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/8 flex items-center justify-center mb-4">
          <FileText className="w-6 h-6 text-slate-600" />
        </div>
        <p className="text-sm font-semibold text-slate-300 mb-1">No job description yet</p>
        <p className="text-xs text-slate-500 max-w-sm mb-6">
          Adding a JD enables auto-scoring and Boolean variation generation for this project.
        </p>
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
          >
            Add Job Description
          </button>
        )}
      </div>
    )
  }

  // ── Edit mode (or first-time add) ────────────────────────────

  if (editing && canEdit) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">
            {jdText ? 'Edit job description' : 'Add job description'}
          </h3>
          {jdText && (
            <button onClick={handleCancel} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <FileDropTextarea
          value={draft}
          onChange={setDraft}
          placeholder="Paste or upload the job description (PDF, DOCX, or TXT)…"
          minHeight="280px"
          rows={14}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600">{wordCount(draft).toLocaleString()} words</span>
          <div className="flex gap-2">
            {jdText && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:text-slate-200 hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !draft.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-50"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
              ) : (
                <><Save className="w-4 h-4" />Save Job Description</>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Read mode ─────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Rescore banner */}
      {showBanner && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-sm">
          <span className="text-yellow-300 flex-1">
            Job description updated — rescore candidates to reflect changes.
          </span>
          <button
            onClick={() => setShowBanner(false)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* JD display */}
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-sm font-semibold text-slate-200">Job Description</h3>
        {canEdit && (
          <button
            onClick={() => { setDraft(jdText ?? ''); setEditing(true) }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </div>

      <div className="relative rounded-xl bg-white/3 border border-white/8 p-5">
        <pre className={cn(
          'whitespace-pre-wrap text-sm text-slate-300 font-sans leading-relaxed',
          'max-h-[600px] overflow-y-auto'
        )}>
          {jdText}
        </pre>
      </div>

      <p className="text-xs text-slate-600 text-right">
        {wordCount(jdText ?? '').toLocaleString()} words
      </p>
    </div>
  )
}
