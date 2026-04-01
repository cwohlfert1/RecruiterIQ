'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Code2, CheckSquare, FileText, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssessmentDraft, QuestionDraft } from './assessment-builder'

const SKILL_FOCUSES = [
  'React', 'JavaScript', 'TypeScript', 'Python', 'SQL',
  'System Design', 'CSS/HTML', 'Node.js', 'Git/DevOps', 'Behavioral/Soft Skills',
] as const

type SkillFocus   = typeof SKILL_FOCUSES[number]
type Difficulty   = 'junior' | 'mid' | 'senior'
type QuestionType = 'coding' | 'multiple_choice' | 'written'

function genId() {
  return Math.random().toString(36).slice(2)
}

function mapToQuestionDraft(raw: Record<string, unknown>, sortOrder: number): QuestionDraft {
  const type = raw.type as QuestionType
  const base: QuestionDraft = {
    id:         genId(),
    type,
    prompt:     (raw.prompt as string) ?? '',
    points:     100,
    sort_order: sortOrder,
  }
  if (type === 'coding') {
    return {
      ...base,
      language:     (raw.language as QuestionDraft['language']) ?? 'javascript',
      starter_code: (raw.starter_code as string) ?? '',
      test_cases:   (raw.test_cases as QuestionDraft['test_cases']) ?? [],
      instructions: (raw.instructions as string) ?? '',
      rubric_hints: (raw.rubric_hints as string) ?? '',
    }
  }
  if (type === 'multiple_choice') {
    return {
      ...base,
      options:        (raw.options as QuestionDraft['options']) ?? [],
      correct_option: (raw.correct_option as string) ?? '',
      rubric_hints:   (raw.rubric_hints as string) ?? '',
    }
  }
  // written
  return {
    ...base,
    length_hint:  (raw.length_hint as QuestionDraft['length_hint']) ?? 'medium',
    rubric_hints: (raw.rubric_hints as string) ?? '',
  }
}

const typeIcon: Record<QuestionType, React.ReactNode> = {
  coding:          <Code2 className="w-3.5 h-3.5" />,
  multiple_choice: <CheckSquare className="w-3.5 h-3.5" />,
  written:         <FileText className="w-3.5 h-3.5" />,
}

const typeLabel: Record<QuestionType, string> = {
  coding:          'Coding',
  multiple_choice: 'Multiple Choice',
  written:         'Written',
}

const typeBadge: Record<QuestionType, string> = {
  coding:          'bg-violet-500/15 text-violet-300 border-violet-500/25',
  multiple_choice: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  written:         'bg-green-500/15 text-green-300 border-green-500/25',
}

interface Props {
  draft:   AssessmentDraft
  onAdd:   (questions: QuestionDraft[]) => void
  onClose: () => void
}

export function GenerateQuestionsModal({ draft, onAdd, onClose }: Props) {
  const [phase, setPhase]                 = useState<'form' | 'loading' | 'preview' | 'error'>('form')
  const [role, setRole]                   = useState(draft.role || '')
  const [skillFocus, setSkillFocus]       = useState<SkillFocus>('React')
  const [difficulty, setDifficulty]       = useState<Difficulty>('mid')
  const [questionTypes, setQuestionTypes] = useState<Set<QuestionType>>(new Set<QuestionType>(['written']))
  const [count, setCount]                 = useState(3)
  const [generated, setGenerated]         = useState<QuestionDraft[]>([])
  const [selected, setSelected]           = useState<Set<string>>(new Set())
  const [errorMsg, setErrorMsg]           = useState('')

  function toggleType(t: QuestionType) {
    setQuestionTypes(prev => {
      const next = new Set(prev)
      if (next.has(t)) {
        if (next.size === 1) return prev // keep at least one selected
        next.delete(t)
      } else {
        next.add(t)
      }
      return next
    })
  }

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleGenerate() {
    if (!role.trim() || questionTypes.size === 0) return
    setPhase('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/assessments/generate-questions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          role:           role.trim(),
          skill_focus:    skillFocus,
          difficulty,
          question_types: Array.from(questionTypes),
          count,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generation failed')

      const startOrder = draft.questions.length + 1
      const drafts = (json.questions as Record<string, unknown>[]).map((q, i) =>
        mapToQuestionDraft(q, startOrder + i)
      )
      setGenerated(drafts)
      setSelected(new Set(drafts.map(q => q.id)))
      setPhase('preview')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('error')
    }
  }

  function handleAddSelected() {
    const toAdd = generated.filter(q => selected.has(q.id))
    if (toAdd.length === 0) return
    const offset = draft.questions.length
    const reordered = toAdd.map((q, i) => ({ ...q, sort_order: offset + i + 1 }))
    onAdd(reordered)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#1A1D2E] border border-white/10 rounded-2xl shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 sticky top-0 bg-[#1A1D2E] z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="text-base font-semibold text-white">Generate with AI</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">

            {/* ── Form ── */}
            {phase === 'form' && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-5"
              >
                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Role / Position
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                  />
                </div>

                {/* Skill Focus */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Skill Focus
                  </label>
                  <select
                    value={skillFocus}
                    onChange={e => setSkillFocus(e.target.value as SkillFocus)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1A1D2E] border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                  >
                    {SKILL_FOCUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Difficulty
                  </label>
                  <div className="flex gap-2">
                    {(['junior', 'mid', 'senior'] as Difficulty[]).map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-sm font-medium border transition-all duration-150 capitalize',
                          difficulty === d
                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Types */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Question Types
                  </label>
                  <div className="space-y-2">
                    {([
                      { type: 'coding'          as QuestionType, label: 'Coding Challenge',  desc: 'Monaco editor with test cases'  },
                      { type: 'multiple_choice' as QuestionType, label: 'Multiple Choice',   desc: 'Auto-scored 4-option question'  },
                      { type: 'written'         as QuestionType, label: 'Written Response',  desc: 'AI-graded open-ended answer'    },
                    ]).map(({ type, label, desc }) => (
                      <label
                        key={type}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150',
                          questionTypes.has(type)
                            ? 'bg-indigo-500/10 border-indigo-500/40'
                            : 'bg-white/3 border-white/8 hover:border-white/15'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={questionTypes.has(type)}
                          onChange={() => toggleType(type)}
                          className="accent-indigo-500 w-4 h-4 flex-shrink-0"
                        />
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0',
                          typeBadge[type]
                        )}>
                          {typeIcon[type]}
                          {typeLabel[type]}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">{label}</p>
                          <p className="text-xs text-slate-500">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Count */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Number of Questions: <span className="text-indigo-400 font-semibold">{count}</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={count}
                    onChange={e => setCount(parseInt(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-xs text-slate-600 mt-1 px-0.5">
                    {[1, 2, 3, 4, 5].map(n => <span key={n}>{n}</span>)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!role.trim() || questionTypes.size === 0}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Questions
                </button>
              </motion.div>
            )}

            {/* ── Loading ── */}
            {phase === 'loading' && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-16 flex flex-col items-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">Claude is thinking...</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Generating {count} question{count !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Preview ── */}
            {phase === 'preview' && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">
                    <span className="text-white font-medium">{selected.size}</span> of {generated.length} selected
                  </p>
                  <button
                    type="button"
                    onClick={() => setPhase('form')}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Regenerate
                  </button>
                </div>

                <div className="space-y-2">
                  {generated.map(q => (
                    <label
                      key={q.id}
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-150',
                        selected.has(q.id)
                          ? 'bg-indigo-500/10 border-indigo-500/40'
                          : 'bg-white/3 border-white/8 hover:border-white/15'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(q.id)}
                        onChange={() => toggleSelected(q.id)}
                        className="accent-indigo-500 w-4 h-4 flex-shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0',
                            typeBadge[q.type]
                          )}>
                            {typeIcon[q.type]}
                            {typeLabel[q.type]}
                          </span>
                          {q.type === 'coding' && q.language && (
                            <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                              {q.language.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 line-clamp-3">{q.prompt}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={selected.size === 0}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add {selected.size} Selected Question{selected.size !== 1 ? 's' : ''}
                </button>
              </motion.div>
            )}

            {/* ── Error ── */}
            {phase === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-12 flex flex-col items-center gap-4 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                  <X className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Generation failed</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {errorMsg || 'Something went wrong. Please try again.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPhase('form')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white border border-white/10 hover:border-white/20 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
