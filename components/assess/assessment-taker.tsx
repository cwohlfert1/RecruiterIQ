'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, ChevronLeft, ChevronRight, Send, AlertTriangle } from 'lucide-react'
import type { ProctoringConfig } from '@/types/database'
import type { AssessmentQuestion } from '@/types/database'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface SavedResponse {
  question_id: string
  answer_text: string | null
  selected_option: string | null
}

interface Props {
  token: string
  sessionId: string
  candidateName: string
  assessment: {
    title: string
    time_limit_minutes: number | null
    question_display: string | null
    proctoring_config: unknown
  }
  questions: AssessmentQuestion[]
  currentIndex: number
  startedAt: string
  savedResponses: SavedResponse[]
  proctoringConfig: ProctoringConfig
}

// ─── Presence Challenge Modal ──────────────────────────────────────────────
function PresenceChallenge({
  word,
  onPass,
  onFail,
}: {
  word: string
  onPass: () => void
  onFail: () => void
}) {
  const [input, setInput] = useState('')
  const [timeLeft, setTimeLeft] = useState(5)

  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); onFail(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [onFail])

  const handleSubmit = () => {
    if (input.trim().toLowerCase() === word.toLowerCase()) onPass()
    else onFail()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center"
      >
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-900 mb-1">Presence Check</h2>
        <p className="text-gray-500 text-sm mb-4">Type the word below within <span className="font-bold text-red-500">{timeLeft}s</span></p>
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl py-3 px-6 mb-4">
          <span className="text-3xl font-bold tracking-widest text-indigo-700">{word}</span>
        </div>
        <input
          autoFocus
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-center text-lg font-mono mb-4 focus:outline-none focus:border-indigo-400"
          placeholder="Type here..."
        />
        <button
          onClick={handleSubmit}
          className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Submit
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Random words for presence challenges ─────────────────────────────────
const CHALLENGE_WORDS = ['MAPLE', 'RIVER', 'CLOUD', 'STONE', 'EAGLE', 'SWIFT', 'GROVE', 'FLAME', 'OCEAN', 'TOWER']

export function AssessmentTaker({
  token,
  sessionId,
  candidateName,
  assessment,
  questions,
  currentIndex,
  startedAt,
  savedResponses,
  proctoringConfig,
}: Props) {
  const router = useRouter()
  const [idx, setIdx] = useState(currentIndex)
  const [submitting, setSubmitting] = useState(false)
  const [showChallenge, setShowChallenge] = useState(false)
  const [challengeWord, setChallengeWord] = useState('')

  // ─── Answer state ──────────────────────────────────────────────────────
  const [answers, setAnswers] = useState<Record<string, { text?: string; option?: string }>>(() => {
    const init: Record<string, { text?: string; option?: string }> = {}
    for (const r of savedResponses) {
      init[r.question_id] = {
        text: r.answer_text ?? undefined,
        option: r.selected_option ?? undefined,
      }
    }
    return init
  })

  const currentQuestion = questions[idx]
  const currentAnswer = answers[currentQuestion?.id] ?? {}

  // ─── Timer ─────────────────────────────────────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!assessment.time_limit_minutes) return null
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    return Math.max(0, assessment.time_limit_minutes * 60 - elapsed)
  })
  const timeSpentRef = useRef(0)

  useEffect(() => {
    const t = setInterval(() => {
      timeSpentRef.current += 1
      if (secondsLeft !== null) {
        setSecondsLeft(prev => {
          if (prev === null) return null
          if (prev <= 1) { clearInterval(t); handleSubmit(); return 0 }
          return prev - 1
        })
      }
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ─── Proctoring: Post event ────────────────────────────────────────────
  const postEvent = useCallback(async (
    type: string,
    severity: string,
    payload: Record<string, unknown>
  ) => {
    await fetch(`/api/assess/${token}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: type, severity, payload_json: payload, timestamp: new Date().toISOString() }),
    }).catch(() => {})
  }, [token])

  // ─── Tab switching ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!proctoringConfig.tab_switching) return
    let hiddenAt: number | null = null

    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
      } else if (hiddenAt !== null) {
        const ms = Date.now() - hiddenAt
        postEvent('tab_switch', ms > 60000 ? 'high' : ms > 15000 ? 'medium' : 'low', { duration_away_ms: ms })
        hiddenAt = null
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [proctoringConfig.tab_switching, postEvent])

  // ─── Paste detection ──────────────────────────────────────────────────
  useEffect(() => {
    if (!proctoringConfig.paste_detection) return

    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text') ?? ''
      const chars = text.length
      postEvent('paste_detected', chars > 500 ? 'high' : chars > 100 ? 'medium' : 'low', { char_count: chars })
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [proctoringConfig.paste_detection, postEvent])

  // ─── Keystroke dynamics ────────────────────────────────────────────────
  const keystrokeRef = useRef<{ times: number[]; baseline: number | null }>({ times: [], baseline: null })
  useEffect(() => {
    if (!proctoringConfig.keystroke_dynamics) return

    const onKey = () => {
      const now = Date.now()
      const ref = keystrokeRef.current
      if (ref.times.length > 0) {
        const gap = now - ref.times[ref.times.length - 1]
        ref.times.push(gap)
        // Establish baseline after 20 keystrokes in first 2 minutes
        if (ref.times.length === 20) {
          ref.baseline = ref.times.slice(1).reduce((a, b) => a + b, 0) / (ref.times.length - 1)
        }
        // Flag anomaly after baseline established
        if (ref.baseline && ref.times.length > 20) {
          const recent = ref.times.slice(-5).reduce((a, b) => a + b, 0) / 5
          const ratio = recent / ref.baseline
          if (ratio < 0.3 || ratio > 5) {
            postEvent('keystroke_anomaly', ratio < 0.3 ? 'high' : 'medium', {
              baseline_ms: ref.baseline,
              recent_avg_ms: recent,
              ratio,
            })
          }
        }
      } else {
        ref.times.push(now)
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [proctoringConfig.keystroke_dynamics, postEvent])

  // ─── Presence challenges ──────────────────────────────────────────────
  useEffect(() => {
    if (!proctoringConfig.presence_challenges) return
    const freq = proctoringConfig.presence_challenge_frequency ?? 2
    const interval = (assessment.time_limit_minutes ? assessment.time_limit_minutes * 60 : 20 * 60) / (freq + 1)

    const timers = Array.from({ length: freq }, (_, i) => {
      return setTimeout(() => {
        const word = CHALLENGE_WORDS[Math.floor(Math.random() * CHALLENGE_WORDS.length)]
        setChallengeWord(word)
        setShowChallenge(true)
      }, (i + 1) * interval * 1000)
    })

    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onChallengePass = () => {
    setShowChallenge(false)
    postEvent('presence_challenge_passed', 'info', { word: challengeWord })
  }

  const onChallengeFail = () => {
    setShowChallenge(false)
    postEvent('presence_challenge_failed', 'high', { word: challengeWord })
  }

  // ─── Snapshots ────────────────────────────────────────────────────────
  const snapshotVideoRef = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    if (!proctoringConfig.snapshots) return

    let stream: MediaStream | null = null
    const video = document.createElement('video')
    video.style.display = 'none'
    document.body.appendChild(video)
    snapshotVideoRef.current = video

    navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
      stream = s
      video.srcObject = s
      video.play()
    }).catch(() => {})

    const takeSnapshot = () => {
      if (!stream || !video.videoWidth) return
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      const image = canvas.toDataURL('image/jpeg', 0.7)
      fetch(`/api/assess/${token}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      }).catch(() => {})
    }

    const t = setInterval(takeSnapshot, 5 * 60 * 1000) // every 5 minutes
    return () => {
      clearInterval(t)
      stream?.getTracks().forEach(t => t.stop())
      video.remove()
    }
  }, [proctoringConfig.snapshots, token])

  // ─── Navigation ────────────────────────────────────────────────────────
  const goTo = (newIdx: number) => {
    if (newIdx < 0 || newIdx >= questions.length) return
    setIdx(newIdx)
    router.replace(`/assess/${token}/${newIdx + 1}`, { scroll: false })
  }

  // ─── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)

    const responses = questions.map(q => ({
      questionId: q.id,
      answerText: answers[q.id]?.text ?? undefined,
      selectedOption: answers[q.id]?.option ?? undefined,
    }))

    await fetch(`/api/assess/${token}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responses, timeSpentSeconds: timeSpentRef.current }),
    }).catch(() => {})

    router.push(`/assess/${token}/complete`)
  }, [submitting, questions, answers, token, router])

  if (!currentQuestion) return null

  const isFirst = idx === 0
  const isLast = idx === questions.length - 1

  return (
    <>
      <AnimatePresence>
        {showChallenge && (
          <PresenceChallenge
            word={challengeWord}
            onPass={onChallengePass}
            onFail={onChallengeFail}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div>
            <p className="text-xs text-gray-400 font-medium">{assessment.title}</p>
            <p className="text-sm font-semibold text-gray-700">{candidateName}</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Question progress */}
            <span className="text-sm text-gray-500">
              {idx + 1} / {questions.length}
            </span>
            {/* Timer */}
            {secondsLeft !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-semibold ${
                secondsLeft < 120 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-700'
              }`}>
                <Clock className="w-4 h-4" />
                {formatTime(secondsLeft)}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div
            className="h-1 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
            style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Question header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                    {currentQuestion.type === 'multiple_choice' ? 'Multiple Choice' :
                     currentQuestion.type === 'coding' ? 'Coding Challenge' : 'Written Response'}
                  </span>
                  {currentQuestion.time_limit_secs && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {Math.floor(currentQuestion.time_limit_secs / 60)}m limit
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-900">{currentQuestion.prompt}</h2>
              </div>

              {/* Answer area by type */}
              {currentQuestion.type === 'multiple_choice' && (
                <MCQuestion
                  question={currentQuestion}
                  selected={currentAnswer.option}
                  onSelect={opt => setAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...prev[currentQuestion.id], option: opt } }))}
                />
              )}

              {currentQuestion.type === 'written' && (
                <WrittenQuestion
                  value={currentAnswer.text ?? ''}
                  onChange={text => setAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...prev[currentQuestion.id], text } }))}
                  placeholder={currentQuestion.rubric_hints ?? 'Write your answer here...'}
                />
              )}

              {currentQuestion.type === 'coding' && (
                <CodingQuestion
                  question={currentQuestion}
                  code={currentAnswer.text ?? currentQuestion.starter_code ?? ''}
                  onCodeChange={text => setAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...prev[currentQuestion.id], text } }))}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom navigation */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 sticky bottom-0">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <button
              onClick={() => goTo(idx - 1)}
              disabled={isFirst}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            {/* Question dots */}
            <div className="flex gap-1.5 flex-wrap justify-center">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => goTo(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i === idx ? 'bg-indigo-600' :
                    answers[q.id]?.text || answers[q.id]?.option ? 'bg-green-400' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {isLast ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {submitting ? 'Submitting...' : <>Submit <Send className="w-4 h-4" /></>}
              </button>
            ) : (
              <button
                onClick={() => goTo(idx + 1)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── MC Question ─────────────────────────────────────────────────────────
function MCQuestion({
  question,
  selected,
  onSelect,
}: {
  question: AssessmentQuestion
  selected?: string
  onSelect: (opt: string) => void
}) {
  const options = (question.options_json ?? []) as { id: string; text: string }[]

  return (
    <div className="space-y-3">
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${
            selected === opt.id
              ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
              : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
              selected === opt.id ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
            }`}>
              {selected === opt.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
            </div>
            <span className="text-sm font-medium">{opt.text}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Written Question ─────────────────────────────────────────────────────
function WrittenQuestion({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (text: string) => void
  placeholder?: string | null
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Write your answer here...'}
        rows={10}
        className="w-full border-2 border-gray-200 rounded-xl px-5 py-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 resize-none bg-white"
      />
      <p className="text-xs text-gray-400 mt-1 text-right">{value.length} characters</p>
    </div>
  )
}

// ─── Coding Question ──────────────────────────────────────────────────────
function CodingQuestion({
  question,
  code,
  onCodeChange,
}: {
  question: AssessmentQuestion
  code: string
  onCodeChange: (code: string) => void
}) {
  const testCases = (question.test_cases_json ?? []) as { input: string; expectedOutput: string; description?: string }[]

  return (
    <div className="space-y-4">
      {/* Language badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">
          {question.language ?? 'javascript'}
        </span>
      </div>

      {/* Editor */}
      <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-[#1e1e1e]">
        <div className="bg-[#252526] border-b border-[#3e3e42] px-4 py-2 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-gray-400 ml-2">solution.{question.language ?? 'js'}</span>
        </div>
        <MonacoEditor
          height="320px"
          language={question.language ?? 'javascript'}
          value={code}
          onChange={v => onCodeChange(v ?? '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>

      {/* Test cases */}
      {testCases.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Test Cases</h4>
          <div className="space-y-2">
            {testCases.map((tc, i) => (
              <div key={i} className="flex gap-4 text-xs font-mono">
                <div className="flex-1">
                  <span className="text-gray-400">Input: </span>
                  <span className="text-gray-800">{tc.input}</span>
                </div>
                <div className="flex-1">
                  <span className="text-gray-400">Expected: </span>
                  <span className="text-gray-800">{tc.expectedOutput}</span>
                </div>
                {tc.description && (
                  <div className="text-gray-400 italic">{tc.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
