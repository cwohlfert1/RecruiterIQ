'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { PipelineStage } from '@/types/database'
import { STAGES } from './constants'

interface Props {
  candidateId:       string
  projectId:         string
  stage:             PipelineStage
  canEdit:           boolean
  onChange:          (s: PipelineStage) => void
  onSubmittalPrompt?: (type: 'internal' | 'client') => void
  onRejected?:       () => void
  onPlacedOutcome?:  () => void
}

export function StageDropdown({
  candidateId, projectId, stage, canEdit,
  onChange, onSubmittalPrompt, onRejected, onPlacedOutcome,
}: Props) {
  const [saving, setSaving] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as PipelineStage
    if (next === stage) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/candidates/${candidateId}/stage`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stage: next }),
      })
      if (!res.ok) { toast.error('Failed to update stage'); return }
      const data = await res.json().catch(() => ({}))
      onChange(next)
      if (next === 'placed' && data.spreadCreated) {
        toast.success(`Marked as Placed — added to Spread Tracker as Locked Up`, {
          action: { label: 'Add spread details →', onClick: () => window.location.href = '/dashboard/spread-tracker' },
        })
      } else if (next === 'internal_submittal' && onSubmittalPrompt) {
        toast.success(`Moved to Internal Submittal`, {
          action: { label: 'Generate Submittal', onClick: () => onSubmittalPrompt('internal') },
        })
      } else if (next === 'client_submittal' && onSubmittalPrompt) {
        toast.success(`Moved to Client Submittal`, {
          action: { label: 'Generate Submittal', onClick: () => onSubmittalPrompt('client') },
        })
      } else if (next === 'rejected' && onRejected) {
        toast.success(`Moved to Rejected`)
        setTimeout(() => onRejected(), 500)
      } else if (next === 'placed' && onPlacedOutcome) {
        onPlacedOutcome()
        if (!data.spreadCreated) toast.success(`Moved to Placed`)
      } else {
        toast.success(`Moved to ${STAGES.find(s => s.key === next)?.label}`)
      }
    } catch {
      toast.error('Failed to update stage')
    } finally { setSaving(false) }
  }

  if (!canEdit) {
    const label = STAGES.find(s => s.key === stage)?.label ?? stage
    return (
      <span className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
        {label}
      </span>
    )
  }

  return (
    <div className="relative flex items-center gap-1">
      {saving && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />}
      <select
        value={stage}
        onChange={handleChange}
        disabled={saving}
        className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
      >
        {STAGES.map(s => (
          <option key={s.key} value={s.key} className="bg-[#1A1D2E] text-white">
            {s.label}
          </option>
        ))}
      </select>
    </div>
  )
}
