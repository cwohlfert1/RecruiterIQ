'use client'

import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import type { AssessmentQuestion, AssessmentQuestionResponse } from '@/types/database'
import { MONACO_LANG } from './constants'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface Props {
  questions: AssessmentQuestion[]
  responses: AssessmentQuestionResponse[]
}

export function SkillResults({ questions, responses }: Props) {
  if (questions.length === 0) return null

  const responseByQuestion: Record<string, AssessmentQuestionResponse> = {}
  for (const r of responses) responseByQuestion[r.question_id] = r

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Skill Assessment Results</h2>
      {questions.map(q => {
        const response = responseByQuestion[q.id]
        const feedback = response?.feedback_json as Record<string, { score: number; feedback: string }> | null

        return (
          <div key={q.id} className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{q.prompt}</p>
                <p className="text-xs text-slate-500 mt-1 capitalize">{q.type.replace('_', ' ')} · {q.points} pts</p>
              </div>
              {response?.skill_score !== undefined && response.skill_score !== null && (
                <div className="text-right flex-shrink-0">
                  <span className={cn(
                    'text-2xl font-bold',
                    response.skill_score >= 70 ? 'text-green-400' : response.skill_score >= 40 ? 'text-yellow-400' : 'text-red-400'
                  )}>
                    {response.skill_score}
                  </span>
                  <span className="text-slate-500 text-sm">/100</span>
                </div>
              )}
            </div>

            {q.type === 'coding' && response?.answer_text && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Candidate Code</p>
                <div className="rounded-xl overflow-hidden border border-white/10" style={{ height: 220 }}>
                  <MonacoEditor
                    language={MONACO_LANG[q.language ?? 'javascript']}
                    value={response.answer_text}
                    theme="vs-dark"
                    options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, lineNumbers: 'on', scrollBeyondLastLine: false, padding: { top: 8, bottom: 8 } }}
                  />
                </div>
                {Array.isArray(response.test_results_json) && (
                  <div className="mt-2 space-y-1">
                    {(response.test_results_json as Array<{ input: string; expected: string; actual: string; passed: boolean }>).map((tr, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={cn(tr.passed ? 'text-green-400' : 'text-red-400')}>{tr.passed ? '✓' : '✗'}</span>
                        <span className="text-slate-500">{tr.input}</span>
                        <span className="text-slate-600">→</span>
                        <span className={cn(tr.passed ? 'text-slate-300' : 'text-red-300')}>{tr.actual}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {q.type === 'multiple_choice' && response && (
              <div className="text-sm">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Answer</p>
                <div className="space-y-1.5">
                  {(q.options_json as Array<{ id: string; text: string; is_correct: boolean }> | null ?? []).map(opt => {
                    const selected = response.selected_option === opt.id
                    const correct  = opt.is_correct
                    return (
                      <div key={opt.id} className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm border',
                        correct  ? 'bg-green-500/10 border-green-500/25 text-green-300' :
                        selected ? 'bg-red-500/10 border-red-500/25 text-red-300' :
                        'bg-white/3 border-white/8 text-slate-400'
                      )}>
                        <span className="text-xs uppercase font-medium w-4">{opt.id}.</span>
                        <span className="flex-1">{opt.text}</span>
                        {correct  && <span className="text-xs text-green-400">✓ Correct</span>}
                        {selected && !correct && <span className="text-xs text-red-400">Selected</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {q.type === 'written' && response?.answer_text && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Response</p>
                <p className="text-sm text-slate-300 leading-relaxed bg-white/3 border border-white/8 rounded-xl p-4">
                  {response.answer_text}
                </p>
              </div>
            )}

            {feedback && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">AI Feedback</p>
                <div className="space-y-2">
                  {Object.entries(feedback).map(([category, data]) => (
                    <div key={category} className="flex items-start gap-3 text-sm">
                      <div className="flex-shrink-0 w-24 text-xs text-slate-500 capitalize pt-0.5">{category.replace('_', ' ')}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', data.score >= 70 ? 'bg-green-500' : data.score >= 40 ? 'bg-yellow-500' : 'bg-red-500')}
                              style={{ width: `${data.score}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 w-8 text-right">{data.score}</span>
                        </div>
                        <p className="text-xs text-slate-500">{data.feedback}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
