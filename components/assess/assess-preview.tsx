'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { X, Clock, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

const MONACO_LANG: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  react_jsx:  'javascript',
  react_tsx:  'typescript',
  python:     'python',
}

interface Question {
  id:             string
  type:           'coding' | 'multiple_choice' | 'written'
  prompt:         string
  points:         number
  sort_order:     number
  language?:      string
  starter_code?:  string
  options_json?:  Array<{ id: string; text: string; is_correct: boolean }> | null
  length_hint?:   string
  instructions?:  string
}

interface Props {
  assessment: {
    id:                 string
    title:              string
    description:        string | null
    role:               string | null
    time_limit_minutes: number | null
    question_order:     string
    presentation_mode:  string
  }
  questions: Question[]
}

export function AssessPreview({ assessment, questions }: Props) {
  const [dismissed,  setDismissed]  = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers,    setAnswers]    = useState<Record<string, string>>({})

  const q = questions[currentIdx]

  const isOneAtATime = assessment.presentation_mode === 'one_at_a_time'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview banner */}
      {!dismissed && (
        <div className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-amber-400 px-6 py-3">
          <p className="text-sm font-semibold text-amber-900">
            PREVIEW MODE — This is exactly how your candidate will see this assessment. Proctoring is disabled.
          </p>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-900 hover:text-amber-700 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{assessment.title}</h1>
          {assessment.role && <p className="text-indigo-600 font-medium">{assessment.role}</p>}
          {assessment.description && (
            <p className="text-gray-500 text-sm mt-2">{assessment.description}</p>
          )}
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <FileText className="w-5 h-5 text-gray-400 mb-2" />
            <div className="text-2xl font-bold text-gray-900">{questions.length}</div>
            <div className="text-sm text-gray-500">Questions</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <Clock className="w-5 h-5 text-gray-400 mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {assessment.time_limit_minutes ?? '—'}
            </div>
            <div className="text-sm text-gray-500">
              {assessment.time_limit_minutes ? 'Minutes' : 'No time limit'}
            </div>
          </div>
        </div>

        {/* Questions */}
        {questions.length > 0 && (
          <div className="space-y-6">
            {isOneAtATime ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
                {/* Progress */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Question {currentIdx + 1} of {questions.length}</span>
                  <span className="capitalize">{q.type.replace('_', ' ')}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                  />
                </div>

                <QuestionBlock q={q} answer={answers[q.id] ?? ''} onAnswer={v => setAnswers(prev => ({ ...prev, [q.id]: v }))} />

                {/* Nav */}
                <div className="flex justify-between pt-2">
                  <button
                    onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                    disabled={currentIdx === 0}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:border-gray-300 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  {currentIdx < questions.length - 1 ? (
                    <button
                      onClick={() => setCurrentIdx(i => i + 1)}
                      className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 bg-gray-100 cursor-not-allowed"
                    >
                      Preview only — submit is disabled
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {questions.map((question, i) => (
                  <div key={question.id} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>Question {i + 1}</span>
                      <span className="capitalize">{question.type.replace('_', ' ')}</span>
                    </div>
                    <QuestionBlock
                      q={question}
                      answer={answers[question.id] ?? ''}
                      onAnswer={v => setAnswers(prev => ({ ...prev, [question.id]: v }))}
                    />
                  </div>
                ))}
                <button
                  disabled
                  className="w-full py-3 rounded-xl text-sm font-medium text-gray-400 bg-gray-100 cursor-not-allowed"
                >
                  Preview only — submit is disabled
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Powered by Candid.ai — Preview Mode (proctoring disabled)
        </p>
      </div>
    </div>
  )
}

function QuestionBlock({
  q,
  answer,
  onAnswer,
}: {
  q:        Question
  answer:   string
  onAnswer: (v: string) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-gray-900 font-medium leading-relaxed">{q.prompt}</p>

      {q.type === 'coding' && (
        <div className="space-y-3">
          {q.instructions && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">{q.instructions}</p>
          )}
          <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 280 }}>
            <MonacoEditor
              language={MONACO_LANG[q.language ?? 'javascript'] ?? 'javascript'}
              value={answer || q.starter_code || ''}
              onChange={v => onAnswer(v ?? '')}
              theme="vs-light"
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
      )}

      {q.type === 'multiple_choice' && q.options_json && (
        <div className="space-y-2">
          {q.options_json.map(opt => (
            <label
              key={opt.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors',
                answer === opt.id
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              )}
            >
              <input
                type="radio"
                name={`q-${q.id}`}
                value={opt.id}
                checked={answer === opt.id}
                onChange={() => onAnswer(opt.id)}
                className="text-indigo-600"
              />
              <span className="text-sm text-gray-800">{opt.text}</span>
            </label>
          ))}
        </div>
      )}

      {q.type === 'written' && (
        <textarea
          value={answer}
          onChange={e => onAnswer(e.target.value)}
          placeholder={
            q.length_hint === 'short'  ? 'Write 1–2 sentences...' :
            q.length_hint === 'medium' ? 'Write a paragraph...' :
            'Write a detailed response...'
          }
          rows={q.length_hint === 'long' ? 8 : q.length_hint === 'medium' ? 5 : 3}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
        />
      )}
    </div>
  )
}
