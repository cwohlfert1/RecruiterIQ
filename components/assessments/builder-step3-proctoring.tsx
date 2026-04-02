'use client'

import { useState } from 'react'
import { Eye, Shield, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react'
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

type ProctoringIntensity = 'light' | 'standard' | 'full' | 'custom'
type FeatureKey = keyof Omit<ProctoringConfig, 'presence_challenge_frequency'>

const PRESETS: Record<Exclude<ProctoringIntensity, 'custom'>, ProctoringConfig> = {
  light: {
    tab_switching:                true,
    paste_detection:              true,
    eye_tracking:                 false,
    keystroke_dynamics:           false,
    presence_challenges:          false,
    presence_challenge_frequency: 2,
    snapshots:                    false,
  },
  standard: {
    tab_switching:                true,
    paste_detection:              true,
    eye_tracking:                 false,
    keystroke_dynamics:           true,
    presence_challenges:          true,
    presence_challenge_frequency: 2,
    snapshots:                    false,
  },
  full: {
    tab_switching:                true,
    paste_detection:              true,
    eye_tracking:                 true,
    keystroke_dynamics:           true,
    presence_challenges:          true,
    presence_challenge_frequency: 3,
    snapshots:                    true,
  },
}

function detectIntensity(config: ProctoringConfig): ProctoringIntensity {
  for (const [key, preset] of Object.entries(PRESETS) as [Exclude<ProctoringIntensity, 'custom'>, ProctoringConfig][]) {
    const matches = (Object.keys(preset) as (keyof ProctoringConfig)[])
      .filter(k => k !== 'presence_challenge_frequency')
      .every(k => config[k] === preset[k])
    if (matches) return key
  }
  return 'custom'
}

const FEATURES: {
  key:        FeatureKey
  label:      string
  desc:       string
  webcam?:    boolean
  agencyOnly: boolean
}[] = [
  { key: 'tab_switching',    label: 'Tab Switching Detection',   desc: 'Logs every time the candidate leaves the assessment tab.', agencyOnly: false },
  { key: 'paste_detection',  label: 'Copy / Paste Detection',    desc: 'Flags paste events with character count and preview.', agencyOnly: false },
  { key: 'eye_tracking',     label: 'Eye Tracking',              desc: 'Tracks when the candidate looks away via webcam.', webcam: true, agencyOnly: true },
  { key: 'keystroke_dynamics', label: 'Keystroke Dynamics',      desc: 'Flags significant typing rhythm anomalies.', agencyOnly: true },
  { key: 'presence_challenges', label: 'Human Presence Challenges', desc: 'Random word challenges 2–3 times per session.', agencyOnly: true },
  { key: 'snapshots',        label: 'Periodic Snapshots',        desc: 'Webcam photo every 5 minutes. Retained 90 days.', webcam: true, agencyOnly: true },
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
  const isAgency   = profile.plan_tier === 'agency'
  const [showCustom, setShowCustom] = useState(false)

  const currentIntensity = detectIntensity(draft.proctoring)

  function applyPreset(intensity: Exclude<ProctoringIntensity, 'custom'>) {
    onChange({
      proctoring:          PRESETS[intensity],
      proctoring_intensity: intensity,
    })
    setShowCustom(false)
  }

  function toggleFeature(key: FeatureKey) {
    const updated = { ...draft.proctoring, [key]: !draft.proctoring[key] }
    onChange({
      proctoring:           updated,
      proctoring_intensity: detectIntensity(updated),
    })
  }

  function setFrequency(val: 2 | 3) {
    onChange({ proctoring: { ...draft.proctoring, presence_challenge_frequency: val } })
  }

  const CARDS: {
    key:   Exclude<ProctoringIntensity, 'custom'>
    label: string
    icon:  React.ReactNode
    badge?: string
    desc:  string
    items: string[]
  }[] = [
    {
      key:   'light',
      label: 'Light',
      icon:  <Eye className="w-5 h-5 text-slate-400" />,
      desc:  'Quick knowledge checks — no webcam required',
      items: ['Tab switching detection', 'Copy/paste detection'],
    },
    {
      key:   'standard',
      label: 'Standard',
      icon:  <Shield className="w-5 h-5 text-indigo-400" />,
      badge: 'Recommended',
      desc:  'Best for most technical roles',
      items: ['Tab switching detection', 'Copy/paste detection', 'Keystroke dynamics', 'Human presence challenges'],
    },
    {
      key:   'full',
      label: 'Full',
      icon:  <ShieldCheck className="w-5 h-5 text-violet-400" />,
      desc:  'Maximum security for high-stakes roles',
      items: ['Everything in Standard', 'Eye tracking (webcam)', 'Periodic snapshots (consent required)'],
    },
  ]

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-0.5">Proctoring Settings</h2>
        <p className="text-sm text-slate-400">Choose how closely this assessment is monitored</p>
      </div>

      {!isAgency && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/8 border border-yellow-500/20">
          <div className="text-yellow-400 mt-0.5">⚠</div>
          <p className="text-sm text-yellow-300">
            You&apos;re on the <strong>Pro plan</strong>. Upgrade to <strong>Agency</strong> for Full proctoring with eye tracking and snapshots.
          </p>
        </div>
      )}

      {/* Preset cards */}
      <div className="grid grid-cols-3 gap-3">
        {CARDS.map(card => {
          const selected = currentIntensity === card.key
          const locked   = card.key === 'full' && !isAgency
          return (
            <button
              key={card.key}
              onClick={() => !locked && applyPreset(card.key)}
              disabled={locked}
              className={cn(
                'relative flex flex-col items-start p-4 rounded-xl border text-left transition-all duration-150',
                selected
                  ? 'bg-indigo-500/12 border-indigo-500/50 shadow-[0_0_0_1px_rgba(99,102,241,0.3)]'
                  : locked
                    ? 'bg-white/3 border-white/8 opacity-50 cursor-not-allowed'
                    : 'bg-white/5 border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/5'
              )}
            >
              {card.badge && (
                <span className="absolute top-3 right-3 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {card.badge}
                </span>
              )}
              <div className="mb-2">{card.icon}</div>
              <p className={cn('text-sm font-semibold mb-1', selected ? 'text-white' : 'text-slate-200')}>
                {card.label}
              </p>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">{card.desc}</p>
              <ul className="space-y-1">
                {card.items.map(item => (
                  <li key={item} className="flex items-start gap-1.5 text-xs text-slate-400">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      {/* Custom badge */}
      {currentIntensity === 'custom' && (
        <p className="text-xs text-amber-400 text-center">
          Custom configuration active — presets above will override your current settings
        </p>
      )}

      {/* Customize toggle */}
      <button
        onClick={() => setShowCustom(!showCustom)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        {showCustom ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Customize individual settings
      </button>

      {/* Individual toggles */}
      {showCustom && (
        <div className="space-y-3 pt-1">
          {FEATURES.map(feature => {
            const locked  = feature.agencyOnly && !isAgency
            const enabled = draft.proctoring[feature.key]
            return (
              <div
                key={feature.key}
                className={cn(
                  'p-4 rounded-xl border transition-colors',
                  enabled && !locked ? 'bg-indigo-500/8 border-indigo-500/25' : 'bg-white/3 border-white/8'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-white">{feature.label}</span>
                      {feature.webcam && (
                        <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">Webcam</span>
                      )}
                      {locked && (
                        <span className="text-[10px] text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">Agency plan</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{feature.desc}</p>
                  </div>
                  <Toggle on={enabled} onToggle={() => !locked && toggleFeature(feature.key)} disabled={locked} />
                </div>
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
                {feature.key === 'snapshots' && enabled && !locked && (
                  <p className="mt-2 text-xs text-slate-500">Stored for 90 days then automatically deleted.</p>
                )}
              </div>
            )
          })}
        </div>
      )}

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
