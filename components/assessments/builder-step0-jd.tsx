'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, FileText, Plus, ArrowLeft, RefreshCw, CheckCircle2, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { FileDropTextarea } from '@/components/ui/file-drop-textarea'
import { cn } from '@/lib/utils'
import type { AssessmentDraft, QuestionDraft } from './assessment-builder'
import type { ProctoringConfig, TestCase, MCOption } from '@/types/database'

type Phase = 'entry' | 'input' | 'loading' | 'preview'

type JDResult = {
  title:                string
  role:                 string
  difficulty:           'junior' | 'mid' | 'senior'
  time_limit_minutes:   number
  detected_skills:      string[]
  suggested_questions:  unknown[]
  suggested_proctoring: ProctoringConfig
}

const DIFFICULTY_COLORS: Record<string, string> = {
  junior: 'bg-green-500/15 text-green-300 border-green-500/25',
  mid:    'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  senior: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
}

function genId() {
  return Math.random().toString(36).slice(2)
}

function mapToQuestionDraft(raw: Record<string, unknown>, sortOrder: number): QuestionDraft {
  const type = raw.type as QuestionDraft['type']
  const base: QuestionDraft = {
    id:         genId(),
    type,
    prompt:     (raw.prompt as string) ?? '',
    points:     100,
    sort_order: sortOrder,
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
  onSkip:    () => void
  onConfirm: (patch: Partial<AssessmentDraft>, jumpToQuestions: boolean) => void
}

export function BuilderStep0JD({ onSkip, onConfirm }: Props) {
  const [phase, setPhase]   = useState<Phase>('entry')
  const [jdText, setJdText] = useState('')
  const [result, setResult] = useState<JDResult | null>(null)
  const [error, setError]   = useState<string | null>(null)

  async function analyze() {
    if (jdText.trim().length < 50) return
    setPhase('loading')
    setError(null)
    try {
      const res  = await fetch('/api/assessments/analyze-jd', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jd_text: jdText }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to analyze')
      setResult(json as JDResult)
      setPhase('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('input')
    }
  }

  function handleConfirm(jumpToQuestions: boolean) {
    if (!result) return
    const questions = (result.suggested_questions ?? []).map(
      (q, i) => mapToQuestionDraft(q as Record<string, unknown>, i + 1)
    )
    const patch: Partial<AssessmentDraft> = {
      title:              result.title,
      role:               result.role,
      time_limit_enabled: true,
      time_limit_minutes: result.time_limit_minutes,
      questions,
      proctoring:         result.suggested_proctoring,
    }
    onConfirm(patch, jumpToQuestions)
  }

  const questionTypeCounts = (result?.suggested_questions ?? []).reduce<Record<string, number>>(
    (acc, q) => {
      const type = (q as Record<string, unknown>).type as string
      acc[type] = (acc[type] ?? 0) + 1
      return acc
    },
    {}
  )

  return (
    <AnimatePresence mode="wait">
      {/* ── ENTRY ── */}
      {phase === 'entry' && (
        <motion.div
          key="entry"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="glass-card rounded-2xl p-6 space-y-6"
        >
          <div>
            <h2 className="text-base font-semibold text-white mb-0.5">How do you want to start?</h2>
            <p className="text-sm text-slate-400">Choose your starting point for this assessment</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Generate from JD */}
            <button
              onClick={() => setPhase('input')}
              className="group flex flex-col items-start gap-3 p-5 rounded-xl bg-indigo-500/8 border border-indigo-500/25 hover:border-indigo-500/50 hover:bg-indigo-500/12 transition-all duration-150 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-0.5">Generate from Job Description</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Paste a JD and Cortex AI will create your entire assessment — questions, settings, and proctoring — automatically.
                </p>
              </div>
              <span className="text-xs font-medium text-indigo-400 group-hover:text-indigo-300 transition-colors">
                Paste JD →
              </span>
            </button>

            {/* Browse Templates */}
            <Link
              href="/dashboard/assessments/library"
              className="group flex flex-col items-start gap-3 p-5 rounded-xl bg-violet-500/8 border border-violet-500/25 hover:border-violet-500/50 hover:bg-violet-500/12 transition-all duration-150 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-0.5">Browse Templates</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pick from 15 role-specific templates. Cortex AI generates starter questions tailored to the position.
                </p>
              </div>
              <span className="text-xs font-medium text-violet-400 group-hover:text-violet-300 transition-colors">
                View library →
              </span>
            </Link>

            {/* Start from scratch */}
            <button
              onClick={onSkip}
              className="group flex flex-col items-start gap-3 p-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/8 transition-all duration-150 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                <Plus className="w-5 h-5 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-0.5">Start from Scratch</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Build your assessment step by step. Fill in details, add questions, and configure proctoring manually.
                </p>
              </div>
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                Open builder →
              </span>
            </button>
          </div>
        </motion.div>
      )}

      {/* ── INPUT ── */}
      {phase === 'input' && (
        <motion.div
          key="input"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="glass-card rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPhase('entry')}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-base font-semibold text-white mb-0.5">Paste Job Description</h2>
              <p className="text-sm text-slate-400">Cortex AI will analyze it and build your assessment</p>
            </div>
          </div>

          <div>
            <FileDropTextarea
              value={jdText}
              onChange={setJdText}
              rows={12}
              placeholder="Paste or drag-and-drop the full job description here — including responsibilities, requirements, and nice-to-haves."
              minHeight="240px"
            />
            <p className="text-xs text-slate-600 mt-1">
              {jdText.length < 50
                ? `${50 - jdText.length} more characters needed`
                : `${jdText.length} characters`}
            </p>
          </div>

          {error && (
            <div className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setPhase('entry')}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={analyze}
              disabled={jdText.trim().length < 50}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              <Sparkles className="w-4 h-4" />
              Analyze with Cortex AI →
            </button>
          </div>
        </motion.div>
      )}

      {/* ── LOADING ── */}
      {phase === 'loading' && (
        <motion.div
          key="loading"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="glass-card rounded-2xl p-12 flex flex-col items-center gap-5"
        >
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-indigo-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 animate-ping opacity-75" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-white mb-1">Analyzing job description</p>
            <p className="text-sm text-slate-400">Cortex AI is building your assessment...</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* ── PREVIEW ── */}
      {phase === 'preview' && result && (
        <motion.div
          key="preview"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="glass-card rounded-2xl p-6 space-y-5"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <h2 className="text-base font-semibold text-white">Assessment Ready</h2>
              </div>
              <p className="text-sm text-slate-400">Cortex AI built an assessment from your job description</p>
            </div>
            <button
              onClick={() => setPhase('input')}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Re-analyze
            </button>
          </div>

          {/* Assessment summary */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/8 space-y-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Title</p>
              <p className="text-sm font-medium text-white">{result.title}</p>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Role</p>
                <p className="text-sm text-slate-300">{result.role}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Level</p>
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize',
                  DIFFICULTY_COLORS[result.difficulty]
                )}>
                  {result.difficulty}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Time Limit</p>
                <p className="text-sm text-slate-300">{result.time_limit_minutes} min</p>
              </div>
            </div>
          </div>

          {/* Detected skills */}
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              Detected Skills ({result.detected_skills.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {result.detected_skills.map(skill => (
                <span
                  key={skill}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/8 border border-white/10 text-slate-300"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Suggested questions */}
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              Suggested Questions ({result.suggested_questions.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(questionTypeCounts).map(([type, count]) => (
                <span
                  key={type}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border',
                    type === 'coding'          ? 'bg-violet-500/15 text-violet-300 border-violet-500/25' :
                    type === 'multiple_choice' ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25' :
                                                 'bg-green-500/15 text-green-300 border-green-500/25'
                  )}
                >
                  {count}× {type === 'multiple_choice' ? 'Multiple Choice' : type === 'coding' ? 'Coding' : 'Written'}
                </span>
              ))}
            </div>
          </div>

          {/* Proctoring preview */}
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Proctoring</p>
            <div className="flex flex-wrap gap-1.5">
              {result.suggested_proctoring.tab_switching        && <span className="px-2.5 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-slate-400">Tab Switching</span>}
              {result.suggested_proctoring.paste_detection      && <span className="px-2.5 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-slate-400">Paste Detection</span>}
              {result.suggested_proctoring.eye_tracking         && <span className="px-2.5 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-slate-400">Eye Tracking</span>}
              {result.suggested_proctoring.keystroke_dynamics   && <span className="px-2.5 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-slate-400">Keystroke Dynamics</span>}
              {result.suggested_proctoring.presence_challenges  && <span className="px-2.5 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-slate-400">Presence Challenges</span>}
              {result.suggested_proctoring.snapshots            && <span className="px-2.5 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-slate-400">Snapshots</span>}
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => handleConfirm(true)}
              className="flex-1 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 text-center"
            >
              Use This Assessment →
            </button>
            <button
              onClick={() => handleConfirm(false)}
              className="flex-1 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-white/5 border border-white/10 hover:border-white/20 hover:text-white transition-colors text-center"
            >
              <FileText className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Review Details First
            </button>
          </div>
          <p className="text-xs text-slate-500 text-center">
            You can edit any details in the builder — questions, settings, and proctoring can all be customized.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
