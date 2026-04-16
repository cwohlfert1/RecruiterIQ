'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

function HeroMockup() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })

  const categories = [
    { label: 'Skills Match',   score: 92 },
    { label: 'Domain Exp.',    score: 78 },
    { label: 'Communication',  score: 85 },
    { label: 'Tenure',         score: 90 },
    { label: 'Tool Depth',     score: 80 },
  ]

  const totalScore = 87
  const radius     = 48
  const circ       = 2 * Math.PI * radius
  const dashOffset = inView ? circ - (totalScore / 100) * circ : circ

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.94, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-indigo-500/10 blur-2xl scale-110 -z-10" />

        <div className="glass-card rounded-2xl p-5 w-72 mx-auto">
          <div className="flex items-center gap-1.5 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400/50" />
            <span className="ml-2 text-xs text-slate-500">Resume Scorer</span>
          </div>

          <div className="flex items-center gap-4 mb-5">
            <svg width="108" height="108" viewBox="0 0 108 108" className="flex-shrink-0">
              <circle cx="54" cy="54" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
              <motion.circle
                cx="54" cy="54" r={radius}
                fill="none"
                stroke="#22C55E"
                strokeWidth="7"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(-90 54 54)"
                transition={{ duration: 1.3, delay: 0.5, ease: 'easeOut' }}
              />
              <text x="54" y="54" textAnchor="middle" dominantBaseline="central" fontSize="22" fill="#22C55E" fontWeight="700" fontFamily="inherit">
                {totalScore}
              </text>
            </svg>

            <div>
              <p className="text-xl font-bold text-white">{totalScore} / 100</p>
              <p className="text-xs text-slate-400 mt-0.5">Strong Match</p>
              <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                Recommend
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {categories.map((cat, i) => (
              <div key={cat.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">{cat.label}</span>
                  <span className="text-slate-300 font-medium">{cat.score}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full bg-indigo-500"
                    initial={{ width: 0 }}
                    animate={inView ? { width: `${cat.score}%` } : { width: 0 }}
                    transition={{ duration: 0.9, delay: 0.7 + i * 0.1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-slate-600 text-right">Scored in 4.2s</p>
        </div>
      </div>
    </motion.div>
  )
}

export function HeroSection() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center pt-16 pb-24 overflow-hidden dot-grid-bg">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-4"
            >
              Built for agency recruiters
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-5"
            >
              Stop screening resumes.{' '}
              <span className="gradient-text">Start making placements.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="text-lg text-slate-400 mb-8 leading-relaxed max-w-lg"
            >
              Candid.ai scores every resume in seconds, writes your client submittals, builds your Boolean strings, and tells you exactly who to call first. You do the closing.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="flex flex-wrap gap-3"
            >
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
              >
                Start Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-slate-300 border border-white/12 hover:border-white/24 hover:text-white transition-colors duration-150"
              >
                See How It Works
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.36 }}
              className="mt-4 text-xs text-slate-600"
            >
              25 free AI calls every month. No credit card required.
            </motion.p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <HeroMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
