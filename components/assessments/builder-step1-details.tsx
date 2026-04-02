'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssessmentDraft } from './assessment-builder'
import type { NotificationRecipient } from '@/types/database'

interface Props {
  draft:    AssessmentDraft
  onChange: (patch: Partial<AssessmentDraft>) => void
  onNext:   () => void
}

const EXPIRY_OPTIONS: { label: string; value: number }[] = [
  { label: '24 hrs',  value: 24 },
  { label: '48 hrs',  value: 48 },
  { label: '72 hrs',  value: 72 },
  { label: '7 days',  value: 168 },
]

export function BuilderStep1Details({ draft, onChange, onNext }: Props) {
  const canProceed = draft.title.trim().length > 0 && draft.role.trim().length > 0

  // Notification recipients state
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName,  setRecipientName]  = useState('')

  function addRecipient() {
    const email = recipientEmail.trim().toLowerCase()
    const name  = recipientName.trim()
    if (!email || !name) return
    if (draft.notification_recipients.some(r => r.email === email)) return
    onChange({
      notification_recipients: [
        ...draft.notification_recipients,
        { email, name },
      ],
    })
    setRecipientEmail('')
    setRecipientName('')
  }

  function removeRecipient(email: string) {
    onChange({
      notification_recipients: draft.notification_recipients.filter(r => r.email !== email),
    })
  }

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

        {/* Link expiry */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Invite Link Expiry
          </label>
          <div className="flex gap-2">
            {EXPIRY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => onChange({ expiry_hours: opt.value })}
                className={cn(
                  'flex-1 py-2 rounded-xl text-sm font-medium border transition-all duration-150',
                  draft.expiry_hours === opt.value
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Candidate invite links expire after this time
          </p>
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

        {/* Notification recipients */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Notify When Completed <span className="text-slate-500 text-xs font-normal">(optional)</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">
            These people will receive an email + in-app notification when a candidate submits.
          </p>

          {/* Existing recipients */}
          {draft.notification_recipients.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {draft.notification_recipients.map((r: NotificationRecipient) => (
                <div
                  key={r.email}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-xs font-medium text-indigo-300"
                >
                  <span>{r.name} ({r.email})</span>
                  <button
                    onClick={() => removeRecipient(r.email)}
                    className="text-indigo-400 hover:text-red-400 transition-colors ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add recipient form */}
          <div className="flex gap-2">
            <input
              type="text"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              placeholder="Name"
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
            />
            <input
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRecipient()}
              placeholder="Email"
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
            />
            <button
              onClick={addRecipient}
              disabled={!recipientEmail.trim() || !recipientName.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
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
