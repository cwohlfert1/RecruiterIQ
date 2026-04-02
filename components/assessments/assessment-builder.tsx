'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { UserProfile, ProctoringConfig, TestCase, MCOption, NotificationRecipient } from '@/types/database'

import { BuilderStep0JD } from './builder-step0-jd'
import { BuilderStep1Details } from './builder-step1-details'
import { BuilderStep2Questions } from './builder-step2-questions'
import { BuilderStep3Proctoring } from './builder-step3-proctoring'
import { BuilderStep4Review } from './builder-step4-review'

export type QuestionDraft = {
  id:              string
  type:            'coding' | 'multiple_choice' | 'written'
  prompt:          string
  points:          number
  sort_order:      number
  // coding
  language?:       'javascript' | 'typescript' | 'react_jsx' | 'react_tsx' | 'python'
  starter_code?:   string
  test_cases?:     TestCase[]
  instructions?:   string
  // mc
  options?:        MCOption[]
  correct_option?: string
  // written
  length_hint?:    'short' | 'medium' | 'long'
  rubric_hints?:   string
}

export type AssessmentDraft = {
  title:                   string
  description:             string
  role:                    string
  time_limit_enabled:      boolean
  time_limit_minutes:      number
  question_order:          'sequential' | 'random'
  presentation_mode:       'one_at_a_time' | 'all_at_once'
  questions:               QuestionDraft[]
  proctoring:              ProctoringConfig
  expiry_hours:            number
  notification_recipients: NotificationRecipient[]
  template_type:           string | null
  proctoring_intensity:    'light' | 'standard' | 'full' | 'custom'
  allow_retakes:           boolean
}

const defaultDraft: AssessmentDraft = {
  title:                   '',
  description:             '',
  role:                    '',
  time_limit_enabled:      true,
  time_limit_minutes:      60,
  question_order:          'sequential',
  presentation_mode:       'one_at_a_time',
  questions:               [],
  expiry_hours:            48,
  notification_recipients: [],
  template_type:           null,
  proctoring_intensity:    'standard',
  allow_retakes:           false,
  proctoring: {
    tab_switching:                true,
    paste_detection:              true,
    eye_tracking:                 false,
    keystroke_dynamics:           true,
    presence_challenges:          true,
    presence_challenge_frequency: 2,
    snapshots:                    false,
  },
}

const STEPS = ['Details', 'Questions', 'Proctoring', 'Review']

function genId() { return Math.random().toString(36).slice(2) }

function mapRawQuestion(raw: Record<string, unknown>, sortOrder: number): QuestionDraft {
  const type = raw.type as QuestionDraft['type']
  const base: QuestionDraft = {
    id:           genId(),
    type,
    prompt:       (raw.prompt as string) ?? '',
    points:       100,
    sort_order:   sortOrder,
    rubric_hints: (raw.rubric_hints as string) ?? '',
  }
  if (type === 'coding') {
    return {
      ...base,
      language:     (raw.language as QuestionDraft['language']) ?? 'javascript',
      starter_code: (raw.starter_code as string) ?? '',
      test_cases:   (raw.test_cases as TestCase[]) ?? [],
      instructions: (raw.instructions as string) ?? '',
    }
  }
  if (type === 'multiple_choice') {
    return {
      ...base,
      options:        (raw.options as MCOption[]) ?? [],
      correct_option: (raw.correct_option as string) ?? '',
    }
  }
  return {
    ...base,
    length_hint: (raw.length_hint as QuestionDraft['length_hint']) ?? 'medium',
  }
}

interface Props {
  profile: UserProfile
}

export function AssessmentBuilder({ profile }: Props) {
  const router = useRouter()
  const [showEntry, setShowEntry]     = useState(true)
  const [step, setStep]               = useState(0)
  const [draft, setDraft]             = useState<AssessmentDraft>(defaultDraft)
  const [saving, setSaving]           = useState(false)
  const [publishedId, setPublishedId]         = useState<string | null>(null)
  const [publishedToken, setPublishedToken]   = useState<string | null>(null)

  // Pre-fill from template library
  useEffect(() => {
    const stored = sessionStorage.getItem('assessmentTemplate')
    if (!stored) return
    sessionStorage.removeItem('assessmentTemplate')
    try {
      const data = JSON.parse(stored) as {
        template_type: string
        title:         string
        role:          string
        questions:     unknown[]
      }
      const mapped = data.questions.map((q, i) =>
        mapRawQuestion(q as Record<string, unknown>, i + 1)
      )
      setDraft(prev => ({
        ...prev,
        title:         data.title,
        role:          data.role,
        template_type: data.template_type,
        questions:     mapped,
      }))
      setShowEntry(false)
      setStep(1) // jump straight to questions
    } catch {
      // ignore parse errors
    }
  }, [])

  function updateDraft(patch: Partial<AssessmentDraft>) {
    setDraft(prev => ({ ...prev, ...patch }))
  }

  function handleJDConfirm(patch: Partial<AssessmentDraft>, jumpToQuestions: boolean) {
    setDraft(prev => ({ ...prev, ...patch }))
    setShowEntry(false)
    setStep(jumpToQuestions ? 1 : 0)
  }

  async function handleSave(status: 'draft' | 'published') {
    setSaving(true)
    try {
      const res = await fetch('/api/assessments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')

      if (status === 'published') {
        setPublishedId(json.id)
        setPublishedToken(json.token)
        toast.success('Assessment published!')
      } else {
        toast.success('Draft saved')
        router.push('/dashboard/assessments')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Create Assessment</h1>
        <p className="text-sm text-slate-400 mt-0.5">Build a proctored skill assessment for candidates</p>
      </div>

      {/* Step 0 — JD Import entry point */}
      {showEntry && (
        <BuilderStep0JD
          onSkip={() => setShowEntry(false)}
          onConfirm={handleJDConfirm}
        />
      )}

      {/* Step indicator — only shown after entry */}
      {!showEntry && <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-200',
                i < step
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : i === step
                    ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300'
                    : 'bg-transparent border-white/20 text-slate-500'
              )}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={cn(
                'text-[11px] font-medium mt-1 whitespace-nowrap',
                i === step ? 'text-indigo-300' : i < step ? 'text-slate-400' : 'text-slate-600'
              )}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'h-0.5 flex-1 mb-5 transition-colors duration-200',
                i < step ? 'bg-indigo-500' : 'bg-white/10'
              )} />
            )}
          </div>
        ))}
      </div>}

      {/* Step content — only shown after entry */}
      {!showEntry && <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 0 && (
            <BuilderStep1Details
              draft={draft}
              onChange={updateDraft}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <BuilderStep2Questions
              draft={draft}
              onChange={updateDraft}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <BuilderStep3Proctoring
              draft={draft}
              profile={profile}
              onChange={updateDraft}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <BuilderStep4Review
              draft={draft}
              profile={profile}
              saving={saving}
              publishedId={publishedId}
              publishedToken={publishedToken}
              onBack={() => setStep(2)}
              onSaveDraft={() => handleSave('draft')}
              onPublish={() => handleSave('published')}
            />
          )}
        </motion.div>
      </AnimatePresence>}
    </div>
  )
}
