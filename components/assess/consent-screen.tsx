'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Shield, Camera, Eye, Keyboard, Mouse, MessageSquare, Image, ChevronRight, CheckCircle } from 'lucide-react'
import type { ProctoringConfig } from '@/types/database'

interface ConsentItem {
  key: keyof ProctoringConfig
  icon: React.ReactNode
  title: string
  description: string
  requiresCamera?: boolean
}

const CONSENT_ITEMS: ConsentItem[] = [
  {
    key: 'tab_switching',
    icon: <Mouse className="w-5 h-5" />,
    title: 'Tab & window monitoring',
    description: 'The system will detect if you switch to another tab or window during the assessment.',
  },
  {
    key: 'paste_detection',
    icon: <Keyboard className="w-5 h-5" />,
    title: 'Paste detection',
    description: 'Any text pasted into answer fields will be logged, including character count and timing.',
  },
  {
    key: 'eye_tracking',
    icon: <Eye className="w-5 h-5" />,
    title: 'Eye / gaze tracking',
    description: 'Your webcam will be used to detect when your gaze leaves the screen. No video is recorded.',
    requiresCamera: true,
  },
  {
    key: 'keystroke_dynamics',
    icon: <Keyboard className="w-5 h-5" />,
    title: 'Keystroke dynamics',
    description: 'Typing rhythm and patterns are analyzed to detect significant behavioral changes.',
  },
  {
    key: 'presence_challenges',
    icon: <MessageSquare className="w-5 h-5" />,
    title: 'Presence challenges',
    description: 'You may be asked to type a random word within 5 seconds to confirm you are present.',
  },
  {
    key: 'snapshots',
    icon: <Image className="w-5 h-5" />,
    title: 'Periodic webcam snapshots',
    description: 'A photo will be taken every 5 minutes and shared only with the recruiter. These are stored for 90 days.',
    requiresCamera: true,
  },
]

interface Props {
  token: string
  candidateName: string
  assessmentTitle: string
  proctoringConfig: ProctoringConfig
}

export function ConsentScreen({ token, candidateName, assessmentTitle, proctoringConfig }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const activeItems = CONSENT_ITEMS.filter(item => proctoringConfig[item.key])
  const hasAnyProctoring = activeItems.length > 0
  const allChecked = hasAnyProctoring
    ? activeItems.every(item => checked[item.key])
    : true

  const toggle = useCallback((key: string) => {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleStart = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/assess/${token}/start`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to start')
      router.push(`/assess/${token}/1`)
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-100 rounded-2xl mb-4">
            <Shield className="w-7 h-7 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Proctoring Consent</h1>
          <p className="text-gray-500 text-sm">
            {assessmentTitle} — Hi, {candidateName}
          </p>
        </div>

        {hasAnyProctoring ? (
          <>
            <p className="text-sm text-gray-600 mb-4 text-center">
              This assessment uses proctoring to ensure integrity. Please review and acknowledge each item below.
            </p>

            <div className="space-y-3 mb-6">
              {activeItems.map((item) => (
                <motion.label
                  key={item.key}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                    checked[item.key]
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={!!checked[item.key]}
                    onChange={() => toggle(item.key)}
                  />
                  <div className={`w-5 h-5 flex-shrink-0 rounded border-2 mt-0.5 flex items-center justify-center transition-colors ${
                    checked[item.key] ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                  }`}>
                    {checked[item.key] && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`${checked[item.key] ? 'text-indigo-600' : 'text-gray-400'}`}>
                        {item.icon}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                      {item.requiresCamera && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          <Camera className="w-3 h-3" />
                          Camera
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                </motion.label>
              ))}
            </div>

            {!allChecked && (
              <p className="text-xs text-amber-600 text-center mb-4">
                Please acknowledge all monitoring items to continue.
              </p>
            )}
          </>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800">
              This assessment does not use proctoring. You may begin immediately.
            </p>
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={!allChecked || loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all text-lg shadow-lg shadow-indigo-200 disabled:shadow-none"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Starting...
            </span>
          ) : (
            <>
              I agree — Begin Assessment
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">
          By starting, you agree to the proctoring terms above
        </p>
      </motion.div>
    </div>
  )
}
