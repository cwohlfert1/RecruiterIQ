'use client'

import { cn } from '@/lib/utils'
import type { AssessmentDraft } from './assessment-builder'

interface Props {
  draft:    AssessmentDraft
  onChange: (patch: Partial<AssessmentDraft>) => void
  onNext:   () => void
}

export function BuilderStep1Details({ draft, onChange, onNext }: Props) {
  const canProceed = draft.title.trim().length > 0 && draft.role.trim().length > 0

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-0.5">Assessment Details</h2>
        <p className="text-sm text-slate-400">Basic information about this assessment</p>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={draft.title}
            onChange={e => onChange({ title: e.target.value })}
            placeholder="e.g. Senior React Developer Assessment"
            maxLength={100}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Description <span className="text-slate-500 text-xs font-normal">(optional)</span>
          </label>
          <textarea
            value={draft.description}
            onChange={e => onChange({ description: e.target.value })}
            placeholder="Briefly describe what this assessment covers..."
            maxLength={500}
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors resize-none"
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Role / Position <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={draft.role}
            onChange={e => onChange({ role: e.target.value })}
            placeholder="e.g. Senior Software Engineer"
            maxLength={100}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
          />
        </div>

        {/* Time limit */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">Time Limit</label>
            <button
              onClick={() => onChange({ time_limit_enabled: !draft.time_limit_enabled })}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors duration-200',
                draft.time_limit_enabled ? 'bg-indigo-500' : 'bg-white/15'
              )}
            >
              <div className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
                draft.time_limit_enabled ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </button>
          </div>
          {draft.time_limit_enabled && (
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={draft.time_limit_minutes}
                onChange={e => onChange({ time_limit_minutes: Math.max(10, Math.min(180, parseInt(e.target.value) || 60)) })}
                min={10}
                max={180}
                className="w-24 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors text-center"
              />
              <span className="text-sm text-slate-400">minutes (10–180)</span>
            </div>
          )}
        </div>

        {/* Question order */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Question Order</label>
          <div className="flex gap-3">
            {(['sequential', 'random'] as const).map(val => (
              <button
                key={val}
                onClick={() => onChange({ question_order: val })}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all duration-150 capitalize',
                  draft.question_order === val
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                )}
              >
                {val}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            {draft.question_order === 'sequential'
              ? 'Questions shown in the order you define.'
              : 'Questions shuffled uniquely for each candidate.'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
        >
          Next: Add Questions →
        </button>
      </div>
    </div>
  )
}
