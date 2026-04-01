'use client'

import { cn } from '@/lib/utils'
import type { AssessmentDraft } from './assessment-builder'
import type { UserProfile, ProctoringConfig } from '@/types/database'

interface Props {
  draft:    AssessmentDraft
  profile:  UserProfile
  onChange: (patch: Partial<AssessmentDraft>) => void
  onBack:   () => void
  onNext:   () => void
}

type FeatureKey = keyof Omit<ProctoringConfig, 'presence_challenge_frequency'>

const FEATURES: {
  key:        FeatureKey
  label:      string
  desc:       string
  webcam?:    boolean
  consent?:   boolean
  agencyOnly: boolean
}[] = [
  {
    key:        'tab_switching',
    label:      'Tab Switching Detection',
    desc:       'Logs every time the candidate leaves the assessment tab, with timestamps and duration.',
    agencyOnly: false,
  },
  {
    key:        'paste_detection',
    label:      'Copy / Paste Detection',
    desc:       'Flags paste events with character count and a content preview.',
    agencyOnly: false,
  },
  {
    key:        'eye_tracking',
    label:      'Eye Tracking',
    desc:       'Tracks when the candidate looks away from the screen using their webcam.',
    webcam:     true,
    agencyOnly: true,
  },
  {
    key:        'keystroke_dynamics',
    label:      'Keystroke Dynamics',
    desc:       'Establishes a typing rhythm baseline and flags significant anomalies.',
    agencyOnly: true,
  },
  {
    key:        'presence_challenges',
    label:      'Human Presence Challenges',
    desc:       'Pops a random word the candidate must type within 5 seconds, 2–3 times.',
    agencyOnly: true,
  },
  {
    key:        'snapshots',
    label:      'Periodic Snapshots',
    desc:       'Captures a webcam photo every 5 minutes. Retained for 90 days.',
    webcam:     true,
    consent:    true,
    agencyOnly: true,
  },
]

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0',
        on && !disabled ? 'bg-indigo-500' : 'bg-white/15',
        disabled && 'cursor-not-allowed opacity-40'
      )}
    >
      <div className={cn(
        'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
        on ? 'translate-x-5' : 'translate-x-0.5'
      )} />
    </button>
  )
}

export function BuilderStep3Proctoring({ draft, profile, onChange, onBack, onNext }: Props) {
  const isAgency = profile.plan_tier === 'agency'

  function toggleFeature(key: FeatureKey) {
    onChange({
      proctoring: {
        ...draft.proctoring,
        [key]: !draft.proctoring[key],
      },
    })
  }

  function setFrequency(val: 2 | 3) {
    onChange({
      proctoring: { ...draft.proctoring, presence_challenge_frequency: val },
    })
  }

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-0.5">Proctoring Settings</h2>
        <p className="text-sm text-slate-400">Configure what monitoring runs during the assessment</p>
      </div>

      {!isAgency && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/8 border border-yellow-500/20">
          <div className="text-yellow-400 mt-0.5">⚠</div>
          <p className="text-sm text-yellow-300">
            You&apos;re on the <strong>Pro plan</strong>. Tab switching and paste detection are available.
            Upgrade to <strong>Agency</strong> for full proctoring.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {FEATURES.map(feature => {
          const locked   = feature.agencyOnly && !isAgency
          const enabled  = draft.proctoring[feature.key]

          return (
            <div
              key={feature.key}
              className={cn(
                'p-4 rounded-xl border transition-colors',
                enabled && !locked
                  ? 'bg-indigo-500/8 border-indigo-500/25'
                  : 'bg-white/3 border-white/8'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white">{feature.label}</span>
                    {feature.webcam && (
                      <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
                        Webcam
                      </span>
                    )}
                    {feature.consent && (
                      <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
                        Consent
                      </span>
                    )}
                    {locked && (
                      <span className="text-[10px] text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">
                        Agency plan
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{feature.desc}</p>
                </div>
                <Toggle
                  on={enabled}
                  onToggle={() => !locked && toggleFeature(feature.key)}
                  disabled={locked}
                />
              </div>

              {/* Presence challenge frequency */}
              {feature.key === 'presence_challenges' && enabled && !locked && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs text-slate-400">Frequency:</span>
                  {([2, 3] as const).map(n => (
                    <button
                      key={n}
                      onClick={() => setFrequency(n)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-medium border transition-all duration-150',
                        draft.proctoring.presence_challenge_frequency === n
                          ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      )}
                    >
                      {n}× per session
                    </button>
                  ))}
                </div>
              )}

              {/* Snapshot note */}
              {feature.key === 'snapshots' && enabled && !locked && (
                <p className="mt-2 text-xs text-slate-500">
                  Snapshots stored for 90 days then automatically deleted.
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
        >
          Next: Review →
        </button>
      </div>
    </div>
  )
}
