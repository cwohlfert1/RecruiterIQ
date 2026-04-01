'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Code2,
  CheckSquare,
  FileText,
  X,
  Plus as PlusIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssessmentDraft, QuestionDraft } from './assessment-builder'
import type { TestCase, MCOption } from '@/types/database'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

type QuestionType = 'coding' | 'multiple_choice' | 'written'

const LANGUAGES = [
  { value: 'javascript',  label: 'JavaScript'   },
  { value: 'typescript',  label: 'TypeScript'   },
  { value: 'react_jsx',   label: 'React JSX'    },
  { value: 'react_tsx',   label: 'React TSX'    },
  { value: 'python',      label: 'Python'       },
] as const

const MONACO_LANG: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  react_jsx:  'javascript',
  react_tsx:  'typescript',
  python:     'python',
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

function genId() {
  return Math.random().toString(36).slice(2)
}

function defaultQuestion(type: QuestionType, sortOrder: number): QuestionDraft {
  const base = { id: genId(), type, prompt: '', points: 100, sort_order: sortOrder }
  if (type === 'coding') return {
    ...base,
    language: 'javascript',
    starter_code: '',
    test_cases: [{ input: '', expectedOutput: '' }],
    instructions: '',
  }
  if (type === 'multiple_choice') return {
    ...base,
    options: [
      { id: 'a', text: '', is_correct: false },
      { id: 'b', text: '', is_correct: false },
    ],
    correct_option: '',
  }
  return { ...base, length_hint: 'medium', rubric_hints: '' }
}

// ── Sortable question row ──────────────────────────────────

function SortableQuestionRow({
  question,
  onEdit,
  onDelete,
}: {
  question: QuestionDraft
  onEdit:   () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/8 group">
      <div {...attributes} {...listeners} className="cursor-grab text-slate-600 hover:text-slate-400 flex-shrink-0">
        <GripVertical className="w-4 h-4" />
      </div>

      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border flex-shrink-0',
        typeBadge[question.type]
      )}>
        {typeIcon[question.type]}
        {typeLabel[question.type]}
      </span>

      <p className="flex-1 text-sm text-slate-300 truncate">
        {question.prompt || <span className="text-slate-500 italic">No prompt yet</span>}
      </p>

      <span className="text-xs text-slate-500 flex-shrink-0">{question.points} pts</span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/8 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Question editor modal ──────────────────────────────────

function QuestionModal({
  question,
  onSave,
  onClose,
}: {
  question: QuestionDraft
  onSave:   (q: QuestionDraft) => void
  onClose:  () => void
}) {
  const [q, setQ] = useState<QuestionDraft>(question)

  function updateQ(patch: Partial<QuestionDraft>) {
    setQ(prev => ({ ...prev, ...patch }))
  }

  function addTestCase() {
    updateQ({ test_cases: [...(q.test_cases ?? []), { input: '', expectedOutput: '' }] })
  }

  function removeTestCase(i: number) {
    updateQ({ test_cases: (q.test_cases ?? []).filter((_, idx) => idx !== i) })
  }

  function updateTestCase(i: number, patch: Partial<TestCase>) {
    const updated = (q.test_cases ?? []).map((tc, idx) => idx === i ? { ...tc, ...patch } : tc)
    updateQ({ test_cases: updated })
  }

  function addOption() {
    const existing = q.options ?? []
    const nextId = String.fromCharCode(97 + existing.length) // a, b, c...
    updateQ({ options: [...existing, { id: nextId, text: '', is_correct: false }] })
  }

  function removeOption(i: number) {
    const updated = (q.options ?? []).filter((_, idx) => idx !== i)
    updateQ({ options: updated })
  }

  function updateOption(i: number, patch: Partial<MCOption>) {
    const updated = (q.options ?? []).map((opt, idx) => idx === i ? { ...opt, ...patch } : opt)
    updateQ({ options: updated })
  }

  function setCorrectOption(optId: string) {
    const updated = (q.options ?? []).map(opt => ({ ...opt, is_correct: opt.id === optId }))
    updateQ({ options: updated, correct_option: optId })
  }

  const canSave = q.prompt.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1A1D2E] border border-white/10 rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
              typeBadge[q.type]
            )}>
              {typeIcon[q.type]}
              {typeLabel[q.type]}
            </span>
            <h3 className="text-base font-semibold text-white">
              {question.prompt ? 'Edit Question' : 'New Question'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Question Prompt <span className="text-red-400">*</span>
            </label>
            <textarea
              value={q.prompt}
              onChange={e => updateQ({ prompt: e.target.value })}
              rows={3}
              placeholder="Enter the question..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors resize-none"
            />
          </div>

          {/* Points */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Points</label>
            <input
              type="number"
              value={q.points}
              onChange={e => updateQ({ points: Math.max(1, parseInt(e.target.value) || 100) })}
              min={1}
              className="w-24 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors text-center"
            />
          </div>

          {/* ── Coding fields ── */}
          {q.type === 'coding' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Language</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.value}
                      onClick={() => updateQ({ language: lang.value })}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm border transition-all duration-150',
                        q.language === lang.value
                          ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      )}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Instructions</label>
                <textarea
                  value={q.instructions ?? ''}
                  onChange={e => updateQ({ instructions: e.target.value })}
                  rows={2}
                  placeholder="Additional instructions shown to the candidate..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Starter Code</label>
                <div className="rounded-xl overflow-hidden border border-white/10" style={{ height: 200 }}>
                  <MonacoEditor
                    language={MONACO_LANG[q.language ?? 'javascript']}
                    value={q.starter_code ?? ''}
                    onChange={val => updateQ({ starter_code: val ?? '' })}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      padding: { top: 8, bottom: 8 },
                    }}
                  />
                </div>
              </div>

              {/* Test cases (not for React) */}
              {q.language !== 'react_jsx' && q.language !== 'react_tsx' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-300">Test Cases</label>
                    <button
                      onClick={addTestCase}
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <PlusIcon className="w-3.5 h-3.5" /> Add case
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(q.test_cases ?? []).map((tc, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          value={tc.input}
                          onChange={e => updateTestCase(i, { input: e.target.value })}
                          placeholder="Input"
                          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-xs focus:outline-none focus:border-indigo-500/50 transition-colors"
                        />
                        <span className="text-slate-600 text-xs">→</span>
                        <input
                          value={tc.expectedOutput}
                          onChange={e => updateTestCase(i, { expectedOutput: e.target.value })}
                          placeholder="Expected output"
                          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-xs focus:outline-none focus:border-indigo-500/50 transition-colors"
                        />
                        <button
                          onClick={() => removeTestCase(i)}
                          className="text-slate-600 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Multiple choice fields ── */}
          {q.type === 'multiple_choice' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">
                  Answer Options <span className="text-xs text-slate-500">(select correct)</span>
                </label>
                {(q.options ?? []).length < 6 && (
                  <button
                    onClick={addOption}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <PlusIcon className="w-3.5 h-3.5" /> Add option
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {(q.options ?? []).map((opt, i) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={q.correct_option === opt.id}
                      onChange={() => setCorrectOption(opt.id)}
                      className="accent-indigo-500 flex-shrink-0"
                    />
                    <span className="text-xs text-slate-500 w-5 flex-shrink-0 uppercase">{opt.id}.</span>
                    <input
                      value={opt.text}
                      onChange={e => updateOption(i, { text: e.target.value })}
                      placeholder={`Option ${opt.id.toUpperCase()}`}
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                    {(q.options ?? []).length > 2 && (
                      <button
                        onClick={() => removeOption(i)}
                        className="text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Written fields ── */}
          {q.type === 'written' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Expected Length</label>
                <div className="flex gap-3">
                  {(['short', 'medium', 'long'] as const).map(val => (
                    <button
                      key={val}
                      onClick={() => updateQ({ length_hint: val })}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-sm font-medium border transition-all duration-150 capitalize',
                        q.length_hint === val
                          ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      )}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Grading Guidance <span className="text-slate-500 text-xs font-normal">(not shown to candidate)</span>
                </label>
                <textarea
                  value={q.rubric_hints ?? ''}
                  onChange={e => updateQ({ rubric_hints: e.target.value })}
                  rows={3}
                  placeholder="What should a strong answer include? This guides the AI grader."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors resize-none"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/8">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(q); onClose() }}
            disabled={!canSave}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Question
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Step 2 main ────────────────────────────────────────────

interface Props {
  draft:    AssessmentDraft
  onChange: (patch: Partial<AssessmentDraft>) => void
  onBack:   () => void
  onNext:   () => void
}

export function BuilderStep2Questions({ draft, onChange, onBack, onNext }: Props) {
  const [showTypeModal, setShowTypeModal]       = useState(false)
  const [editingQuestion, setEditingQuestion]   = useState<QuestionDraft | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const questions = draft.questions
    const oldIndex  = questions.findIndex(q => q.id === active.id)
    const newIndex  = questions.findIndex(q => q.id === over.id)
    const reordered = arrayMove(questions, oldIndex, newIndex).map((q, i) => ({ ...q, sort_order: i + 1 }))
    onChange({ questions: reordered })
  }

  function addQuestion(type: QuestionType) {
    setShowTypeModal(false)
    const q = defaultQuestion(type, draft.questions.length + 1)
    setEditingQuestion(q)
  }

  function saveQuestion(q: QuestionDraft) {
    const existing = draft.questions.find(x => x.id === q.id)
    if (existing) {
      onChange({ questions: draft.questions.map(x => x.id === q.id ? q : x) })
    } else {
      onChange({ questions: [...draft.questions, q] })
    }
  }

  function deleteQuestion(id: string) {
    onChange({
      questions: draft.questions
        .filter(q => q.id !== id)
        .map((q, i) => ({ ...q, sort_order: i + 1 }))
    })
  }

  const canProceed = draft.questions.length >= 1

  return (
    <>
      <div className="glass-card rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white mb-0.5">Questions</h2>
            <p className="text-sm text-slate-400">Add at least one question</p>
          </div>
          <button
            onClick={() => setShowTypeModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>

        {draft.questions.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-center border border-dashed border-white/10 rounded-xl">
            <p className="text-sm text-slate-500">No questions added yet.</p>
            <button
              onClick={() => setShowTypeModal(true)}
              className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              + Add your first question
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={draft.questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {draft.questions.map(q => (
                  <SortableQuestionRow
                    key={q.id}
                    question={q}
                    onEdit={() => setEditingQuestion(q)}
                    onDelete={() => deleteQuestion(q.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
            disabled={!canProceed}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            Next: Proctoring →
          </button>
        </div>
      </div>

      {/* Type picker modal */}
      <AnimatePresence>
        {showTypeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTypeModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[#1A1D2E] border border-white/10 rounded-2xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Choose Question Type</h3>
                <button onClick={() => setShowTypeModal(false)} className="text-slate-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                {(['coding', 'multiple_choice', 'written'] as QuestionType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => addQuestion(type)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/8 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all duration-150 text-left"
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center border',
                      typeBadge[type]
                    )}>
                      {typeIcon[type]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{typeLabel[type]}</p>
                      <p className="text-xs text-slate-500">
                        {type === 'coding' && 'Monaco Editor with test cases'}
                        {type === 'multiple_choice' && 'Auto-scored radio options'}
                        {type === 'written' && 'AI-graded open response'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Question editor modal */}
      <AnimatePresence>
        {editingQuestion && (
          <QuestionModal
            question={editingQuestion}
            onSave={saveQuestion}
            onClose={() => setEditingQuestion(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
