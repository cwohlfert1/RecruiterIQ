'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Clock, FileText, Shield, AlertCircle, ChevronRight, Timer, ChevronDown, CheckCircle2 } from 'lucide-react'
import type { ProctoringConfig } from '@/types/database'

interface Props {
  token:           string
  candidateName:   string
  assessment: {
    title:               string
    description:         string | null
    role:                string | null
    time_limit_minutes:  number | null
    question_display:    string | null
    proctoring_config:   unknown
  }
  questionCount:  number
  codingCount:    number
  mcCount:        number
  writtenCount:   number
  expired:        boolean
  alreadyStarted: boolean
  expiresAt:      string | null
}

function formatCountdown(expiresAt: string): string {
  const ms      = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0)  return 'Expired'
  const hours   = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours >= 48) return `${Math.floor(hours / 24)} days`
  if (hours >= 1)  return `${hours}h ${minutes}m`
  return `${minutes} minutes`
}

function calcTimeEstimate(coding: number, mc: number, written: number) {
  const base = coding * 15 + mc * 2 + written * 5
  const lo   = Math.round(base * 0.8)
  const hi   = Math.round(base * 1.2)
  return { lo, hi, base }
}

export function AssessLanding({
  token,
  candidateName,
  assessment,
  questionCount,
  codingCount,
  mcCount,
  writtenCount,
  expired,
  alreadyStarted,
  expiresAt,
}: Props) {
  const router     = useRouter()
  const [tipsOpen, setTipsOpen] = useState(false)

  const config        = assessment.proctoring_config as ProctoringConfig | null
  const hasProctoring = config && Object.values(config).some(Boolean)

  const monitoringItems: string[] = []
  if (config?.tab_switching)     monitoringItems.push('Tab and window switching')
  if (config?.paste_detection)   monitoringItems.push('Copy and paste activity')
  if (config?.eye_tracking)      monitoringItems.push('Eye/gaze tracking via webcam')
  if (config?.keystroke_dynamics) monitoringItems.push('Keystroke patterns')
  if (config?.presence_challenges) monitoringItems.push('Live presence challenges')
  if (config?.snapshots)         monitoringItems.push('Periodic webcam snapshots')

  const { lo, hi } = calcTimeEstimate(codingCount, mcCount, writtenCount)
  const hasEstimate = questionCount > 0 && (lo > 0 || hi > 0)

  const breakdown: string[] = []
  if (codingCount > 0)  breakdown.push(`${codingCount} coding challenge${codingCount !== 1 ? 's' : ''}`)
  if (mcCount > 0)      breakdown.push(`${mcCount} multiple choice`)
  if (writtenCount > 0) breakdown.push(`${writtenCount} written response${writtenCount !== 1 ? 's' : ''}`)

  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-500">This assessment link has expired. Please contact your recruiter for a new link.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Shield className="w-4 h-4" />
            Candid.ai Assessment
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{assessment.title}</h1>
          {assessment.role && (
            <p className="text-indigo-600 font-medium">{assessment.role}</p>
          )}
        </div>

        {/* Candidate greeting */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-6 mb-6">
          <p className="text-gray-700 text-lg">
            Hello, <span className="font-semibold text-gray-900">{candidateName}</span>! You&apos;ve been invited to complete this assessment.
          </p>
          {assessment.description && (
            <p className="text-gray-600 mt-2 text-sm">{assessment.description}</p>
          )}
        </div>

        {/* Expiry countdown */}
        {expiresAt && !expired && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 text-sm">
            <Timer className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-amber-800">
              Link expires in <strong>{formatCountdown(expiresAt)}</strong>
            </span>
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <FileText className="w-5 h-5 text-gray-400 mb-2" />
            <div className="text-2xl font-bold text-gray-900">{questionCount}</div>
            <div className="text-sm text-gray-500">Questions</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <Clock className="w-5 h-5 text-gray-400 mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {assessment.time_limit_minutes ?? '—'}
            </div>
            <div className="text-sm text-gray-500">
              {assessment.time_limit_minutes ? 'Minutes limit' : 'No time limit'}
            </div>
          </div>
        </div>

        {/* Time estimate card */}
        {hasEstimate && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-semibold text-indigo-800">Time required</span>
            </div>
            <p className="text-2xl font-bold text-indigo-700 mb-1">~{lo}–{hi} minutes</p>
            {breakdown.length > 0 && (
              <p className="text-xs text-indigo-500">{breakdown.join(' · ')}</p>
            )}
          </div>
        )}

        {/* Proctoring notice */}
        {hasProctoring && monitoringItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">This assessment is proctored</p>
                <p className="text-xs text-amber-700 mb-2">The following will be monitored:</p>
                <ul className="text-xs text-amber-700 space-y-1">
                  {monitoringItems.map(item => (
                    <li key={item} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Collapsible tips */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl mb-6 overflow-hidden">
          <button
            onClick={() => setTipsOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <span>Tips for best results</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${tipsOpen ? 'rotate-180' : ''}`} />
          </button>
          {tipsOpen && (
            <div className="px-4 pb-4 space-y-2 border-t border-gray-200 pt-3">
              {[
                'Use a desktop or laptop computer',
                'Find a quiet, well-lit space',
                'Close other browser tabs first',
                'Ensure a stable internet connection',
                hasEstimate ? `Set aside ${lo}–${hi} minutes of focused time` : 'Set aside enough focused time',
              ].map(tip => (
                <div key={tip} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {tip}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        {alreadyStarted ? (
          <button
            onClick={() => router.push(`/assess/${token}/consent`)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-xl transition-colors text-lg"
          >
            Resume Assessment
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <>
            <button
              onClick={() => router.push(`/assess/${token}/consent`)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-4 rounded-xl transition-all text-lg shadow-lg shadow-indigo-200"
            >
              I&apos;m Ready — Begin Assessment
              <ChevronRight className="w-5 h-5" />
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">
              By clicking, you agree to the monitoring terms outlined on the next screen
            </p>
          </>
        )}

        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by Candid.ai — AI Recruiting Platform
        </p>
      </motion.div>
    </div>
  )
}
