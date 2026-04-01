'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export function CompletionScreen() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-white to-indigo-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center max-w-md"
      >
        {/* Animated checkmark */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5, type: 'spring', stiffness: 200 }}
            className="w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-green-200"
          >
            <svg
              className="w-16 h-16 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </motion.div>

          {/* Confetti-like dots */}
          {show && [0, 1, 2, 3, 4, 5].map(i => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0.5],
                x: [0, (i % 2 === 0 ? 1 : -1) * (40 + i * 10)],
                y: [0, -(30 + i * 8)],
              }}
              transition={{ delay: 0.5 + i * 0.05, duration: 0.8 }}
              className={`absolute top-1/2 left-1/2 w-3 h-3 rounded-full ${
                ['bg-indigo-400', 'bg-purple-400', 'bg-pink-400', 'bg-yellow-400', 'bg-green-400', 'bg-blue-400'][i]
              }`}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Assessment Complete!
          </h1>
          <p className="text-gray-500 text-lg mb-6">
            Thank you for completing the assessment. Your responses have been submitted successfully.
          </p>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-left">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">What happens next?</h3>
            <ul className="space-y-2.5">
              {[
                'Your responses are being reviewed by the recruiting team',
                'Results and feedback will be shared by your recruiter',
                'You will be contacted regarding next steps',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-indigo-600">{i + 1}</span>
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-gray-400 mt-6">
            You may now close this tab.
          </p>
          <p className="text-xs text-gray-300 mt-1">
            Powered by RecruiterIQ — AI Talent Assessment Platform
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
