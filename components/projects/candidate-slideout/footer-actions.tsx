import { AlertOctagon, FileText, Loader2, Send, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'

interface Props {
  candidate:     CandidateRow
  projectId:     string
  canEdit:       boolean
  isManager:     boolean
  flagType:      string | null
  removing:      boolean
  onOpenAssess:     () => void
  onOpenSummary:    () => void
  onOpenSubmittal:  () => void
  onOpenFlagModal:  () => void
  onRemove:         () => void
}

export function FooterActions({
  candidate, projectId, canEdit, isManager, flagType, removing,
  onOpenAssess, onOpenSummary, onOpenSubmittal, onOpenFlagModal, onRemove,
}: Props) {
  async function downloadResume() {
    if (candidate.resume_file_url) {
      const res = await fetch(`/api/projects/${projectId}/candidates/${candidate.id}/resume`)
      if (res.ok) {
        const { url } = await res.json()
        const a = document.createElement('a')
        a.href = url
        a.target = '_blank'
        a.click()
        return
      }
    }
    if (!candidate.resume_text) return
    const blob = new Blob([candidate.resume_text], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${candidate.candidate_name.replace(/\s+/g, '_')}_resume.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-5 py-4 border-t border-white/8 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {isManager && !candidate.assessment_invite_id && (
          candidate.candidate_email ? (
            <button
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
              onClick={onOpenAssess}
            >
              <Send className="w-3.5 h-3.5" />
              Send Assessment
            </button>
          ) : (
            <p className="text-[10px] text-slate-500 px-3 py-2">
              Add this candidate&apos;s email to send them an assessment
            </p>
          )
        )}
        <button
          onClick={onOpenSummary}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors col-span-1"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Summary
        </button>
        <button
          onClick={onOpenSubmittal}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-indigo-300 bg-transparent border border-indigo-500/30 hover:bg-indigo-500/10 transition-colors col-span-1"
        >
          <FileText className="w-3.5 h-3.5" />
          Internal Submittal
        </button>
        <button
          onClick={downloadResume}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 bg-white/5 border border-white/10 hover:bg-white/8 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          Resume
        </button>
      </div>

      <button
        onClick={onOpenFlagModal}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors',
          flagType
            ? 'text-rose-300 bg-rose-500/15 border-rose-500/30 hover:bg-rose-500/20'
            : 'text-rose-400 bg-transparent border-rose-500/30 hover:bg-rose-500/10'
        )}
      >
        <AlertOctagon className="w-3.5 h-3.5" />
        {flagType ? `Flagged: ${flagType.toUpperCase()}` : 'Flag Candidate'}
      </button>

      {canEdit && (
        <button
          onClick={onRemove}
          disabled={removing}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Remove from Project
        </button>
      )}
    </div>
  )
}
