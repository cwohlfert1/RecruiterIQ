'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import {
  FileSearch, FileText, Search, Trophy,
  Check, ArrowRight, Menu, X, Clock, Users, Download,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Scroll fade helper ───────────────────────────────────────────────────────

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-64px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Hero mockup ──────────────────────────────────────────────────────────────

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
      {/* Floating glow blob */}
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-indigo-500/10 blur-2xl scale-110 -z-10" />

        <div className="glass-card rounded-2xl p-5 w-72 mx-auto">
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400/50" />
            <span className="ml-2 text-xs text-slate-500">Resume Scorer</span>
          </div>

          {/* Score row */}
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
              <text
                x="54" y="54"
                textAnchor="middle" dominantBaseline="central"
                fontSize="22" fill="#22C55E" fontWeight="700"
                fontFamily="inherit"
              >
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

          {/* Category bars */}
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

          {/* Fake "Scored in" footer */}
          <p className="mt-4 text-xs text-slate-600 text-right">Scored in 4.2s</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Sticky nav ───────────────────────────────────────────────────────────────

function Nav() {
  const [open,    setOpen]    = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={cn(
        'fixed top-0 inset-x-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-[#0F1117]/90 backdrop-blur-md border-b border-white/6'
          : 'bg-transparent',
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold gradient-text select-none">
          RecruiterIQ
        </Link>

        <div className="hidden md:flex items-center gap-7">
          <a href="#features" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Features</a>
          <a href="#pricing"  className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Pricing</a>
          <Link href="/login"  className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Log in</Link>
          <Link
            href="/signup"
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
          >
            Start Free
          </Link>
        </div>

        <button onClick={() => setOpen(v => !v)} className="md:hidden text-slate-400 p-1">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-[#0F1117] border-b border-white/8 px-4 pb-5 space-y-1"
        >
          <a href="#features" onClick={() => setOpen(false)} className="block text-sm text-slate-400 py-2.5 border-b border-white/6">Features</a>
          <a href="#pricing"  onClick={() => setOpen(false)} className="block text-sm text-slate-400 py-2.5 border-b border-white/6">Pricing</a>
          <Link href="/login"  className="block text-sm text-slate-400 py-2.5 border-b border-white/6">Log in</Link>
          <Link href="/signup" className="block w-full mt-3 py-2.5 px-4 rounded-xl text-sm font-semibold text-white text-center bg-gradient-brand">
            Start Free
          </Link>
        </motion.div>
      )}
    </nav>
  )
}

// ─── Section 1: Hero ──────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 pb-24 overflow-hidden dot-grid-bg">
      {/* Gradient blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left: copy */}
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-4"
            >
              AI Tools for Recruiters
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-5"
            >
              Your desk runs on placements,{' '}
              <span className="gradient-text">not resume review.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="text-lg text-slate-400 mb-8 leading-relaxed max-w-lg"
            >
              RecruiterIQ scores resumes, writes client summaries, builds Boolean strings,
              and ranks your shortlist. The tools your desk actually needs — built for
              recruiters, not HR generalists.
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
              10 free AI calls every month. No credit card required.
            </motion.p>
          </div>

          {/* Right: mockup */}
          <div className="flex justify-center lg:justify-end">
            <HeroMockup />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Section 2: Social proof bar ─────────────────────────────────────────────

const AGENCIES = [
  'Meridian Talent Group',
  'Apex Search Partners',
  'Caliber Recruiting Group',
  'Northgate Staffing',
]

function ProofBar() {
  return (
    <section className="border-y border-white/6 bg-white/2 py-6">
      <Reveal className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
          <p className="text-xs font-medium text-slate-500 whitespace-nowrap flex-shrink-0">
            Recruiters at these firms use RecruiterIQ:
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 justify-center sm:justify-start">
            {AGENCIES.map(name => (
              <span key={name} className="text-sm font-medium text-slate-500">
                {name}
              </span>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

// ─── Section 3: Problem ───────────────────────────────────────────────────────

const PAIN_POINTS = [
  {
    icon: <Clock className="w-5 h-5" />,
    headline: 'You read 40 resumes to send 3',
    body: "The other 37 weren't worth your time, but you had no way to know that until you read them. There's no consistent scoring system — just your gut and whatever bandwidth you have that morning.",
  },
  {
    icon: <FileText className="w-5 h-5" />,
    headline: 'Submittals that look fine until the client pushes back',
    body: "You write the candidate summary in 15 minutes, you think it covers everything, and then the client emails back asking for more context. Turns out you hit all the wrong bullets. Again.",
  },
  {
    icon: <Search className="w-5 h-5" />,
    headline: 'The same Boolean string pulling the same bad pool',
    body: "You built it six months ago for a different role. You've been tweaking it ever since. It's still pulling the same mediocre LinkedIn results and you're not sure where the string is breaking down.",
  },
]

function ProblemSection() {
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white">
            Three things that slow every desk down
          </h2>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto">
            None of these are unique to your agency. Every recruiter deals with them.
            Most just accept it as part of the job.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PAIN_POINTS.map((p, i) => (
            <Reveal key={p.headline} delay={i * 0.1}>
              <div className="glass-card rounded-2xl p-6 h-full">
                <div className="w-10 h-10 rounded-xl bg-red-500/12 flex items-center justify-center text-red-400 mb-4">
                  {p.icon}
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{p.headline}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section 4: Features ──────────────────────────────────────────────────────

const FEATURES = [
  {
    icon:  <FileSearch className="w-5 h-5" />,
    color: 'bg-indigo-500/15 text-indigo-400',
    name:  'Resume Scorer',
    desc:  'Paste the JD and resume. Get a CQI score out of 100, weighted across five dimensions: skills match, domain experience, communication, tenure, and tool depth. Know in seconds whether it\'s worth a call.',
    badge: null,
  },
  {
    icon:  <FileText className="w-5 h-5" />,
    color: 'bg-violet-500/15 text-violet-400',
    name:  'Client Summary Generator',
    desc:  'Four client-ready bullets in under 5 seconds. Experience level, top skills, domain fit, and comp or availability. Copy, paste into your email, send.',
    badge: null,
  },
  {
    icon:  <Search className="w-5 h-5" />,
    color: 'bg-blue-500/15 text-blue-400',
    name:  'Boolean String Generator',
    desc:  'Job title, must-haves, nice-to-haves, exclusions. Two strings back — one for LinkedIn Recruiter, one for Indeed — with correct AND, OR, NOT syntax. Works on the first try.',
    badge: null,
  },
  {
    icon:  <Trophy className="w-5 h-5" />,
    color: 'bg-yellow-500/15 text-yellow-400',
    name:  'Stack Ranking',
    desc:  'Add your entire shortlist to one session. RecruiterIQ scores every candidate and returns a ranked leaderboard with per-candidate breakdowns. Know who to call first without reading 10 resumes side by side.',
    badge: 'Agency',
  },
]

function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-white/1">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white">Built for the tools you actually use</h2>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto">
            Four features, zero fluff. Each one maps to a specific part of your recruiting workflow.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.name} delay={i * 0.08}>
              <div className="glass-card rounded-2xl p-6 h-full relative overflow-hidden group hover:border-white/14 transition-all duration-200">
                {/* Hover glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-indigo-500/0 group-hover:from-indigo-500/5 transition-all duration-300 rounded-2xl pointer-events-none" />

                <div className="flex items-start gap-3 mb-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', f.color)}>
                    {f.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{f.name}</h3>
                      {f.badge && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          {f.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section 5: How it works ──────────────────────────────────────────────────

const STEPS = [
  {
    n:    '01',
    head: 'Paste the job description and resume',
    body: 'No formatting required. Plain text pasted directly into the input — that\'s it. Two fields, one button.',
  },
  {
    n:    '02',
    head: 'RecruiterIQ scores and summarizes in seconds',
    body: 'Claude AI runs a structured evaluation weighted across five dimensions. Score, breakdown, and summary ready in under 10 seconds.',
  },
  {
    n:    '03',
    head: 'Submit with confidence. Make the placement.',
    body: 'You know who to call. You have the client summary ready. You built the Boolean string that found them. Now go close.',
  },
]

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white">How it works</h2>
          <p className="mt-3 text-slate-400">Three steps. Less than 30 seconds.</p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting line — desktop only */}
          <div className="hidden md:block absolute top-7 left-[calc(16.6%+1rem)] right-[calc(16.6%+1rem)] h-px bg-white/6" />

          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12}>
              <div className="flex flex-col items-start md:items-center md:text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 relative z-10">
                  <span className="text-lg font-bold text-indigo-400">{s.n}</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-2">{s.head}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section 6: Pricing ───────────────────────────────────────────────────────

const PLANS = [
  {
    name:         'Free',
    priceMonthly: 0,
    priceAnnual:  0,
    desc:         'Try it out. No credit card required.',
    features: [
      '10 AI calls per month',
      'Resume Scorer',
      'Client Summary Generator',
      'Boolean String Generator',
    ],
    cta:       'Start Free',
    href:      '/signup',
    highlight: false,
    badge:     null,
  },
  {
    name:         'Pro',
    priceMonthly: 39,
    priceAnnual:  31,
    desc:         'For solo recruiters who want full access.',
    features: [
      'Unlimited AI calls',
      'Resume Scorer',
      'Client Summary Generator',
      'Boolean String Generator',
      'Full history with search',
    ],
    cta:       'Start Pro',
    href:      '/signup',
    highlight: true,
    badge:     'Most Popular',
  },
  {
    name:         'Agency',
    priceMonthly: 99,
    priceAnnual:  79,
    desc:         'For small teams filling multiple roles.',
    features: [
      'Everything in Pro',
      'Stack Ranking (CQI Leaderboard)',
      '5 team seats',
      'CSV export',
      'Team usage dashboard',
    ],
    cta:       'Start Agency',
    href:      '/signup',
    highlight: false,
    badge:     null,
  },
]

function PricingSection() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="py-24 bg-white/1">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white">Pricing</h2>
          <p className="mt-3 text-slate-400">
            Start for free. Upgrade when the ROI is obvious.
          </p>
        </Reveal>

        {/* Billing toggle */}
        <Reveal className="flex justify-center mb-10">
          <div className="flex items-center gap-3 p-1 glass rounded-xl">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
                !annual ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
                annual ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              Annual
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                ~20% off
              </span>
            </button>
          </div>
        </Reveal>

        {annual && (
          <Reveal className="text-center mb-6">
            <p className="text-xs text-slate-500">Annual billing coming soon — pricing shown for reference.</p>
          </Reveal>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PLANS.map((plan, i) => {
            const price = annual ? plan.priceAnnual : plan.priceMonthly

            return (
              <Reveal key={plan.name} delay={i * 0.1}>
                <div
                  className={cn(
                    'glass-card rounded-2xl p-6 flex flex-col h-full relative',
                    plan.highlight && 'border-indigo-500/40 shadow-[0_0_24px_0_rgba(99,102,241,0.2)]',
                  )}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500 text-white shadow-sm">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-5">
                    <h3 className="text-base font-semibold text-white mb-1">{plan.name}</h3>
                    <div className="flex items-end gap-1 mb-1">
                      {price === 0 ? (
                        <span className="text-3xl font-bold text-white">Free</span>
                      ) : (
                        <>
                          <span className="text-3xl font-bold text-white">${price}</span>
                          <span className="text-sm text-slate-500 mb-1">/mo</span>
                        </>
                      )}
                    </div>
                    {annual && price > 0 && (
                      <p className="text-xs text-slate-500">billed annually</p>
                    )}
                    <p className="text-sm text-slate-400 mt-2">{plan.desc}</p>
                  </div>

                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.href}
                    className={cn(
                      'block w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-center transition-all duration-150',
                      plan.highlight
                        ? 'bg-gradient-brand text-white hover-glow'
                        : 'border border-white/12 text-slate-300 hover:border-white/24 hover:text-white',
                    )}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Section 7: Testimonials ──────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    initials: 'SM',
    color:    'bg-indigo-500/25 text-indigo-300',
    name:     'Sarah M.',
    title:    'Senior Recruiter',
    agency:   'Meridian Talent Group',
    quote:    "I was doing 45 minutes of pre-screening every morning before I could even get to the phones. Now I do 10 resumes in under 20 minutes and I know exactly who to call first. My submit-to-interview ratio went from around 40% to closer to 65%.",
  },
  {
    initials: 'JT',
    color:    'bg-violet-500/25 text-violet-300',
    name:     'James T.',
    title:    'Account Manager',
    agency:   'Caliber Search Partners',
    quote:    "My clients started asking how I put together such clean write-ups. I didn't change anything — I just started using the summary generator. It writes the bullets they actually want to see, not the ones I thought they wanted.",
  },
  {
    initials: 'DA',
    color:    'bg-blue-500/25 text-blue-300',
    name:     'Derek A.',
    title:    'Sourcing Specialist',
    agency:   'Apex Staffing',
    quote:    "The Boolean tool alone paid for itself the first week. Rebuilt a string for a tough SR DevOps role we'd been spinning on for two months. Got 15 new qualified candidates the same day. My manager thought I'd found a secret database.",
  },
]

function TestimonialsSection() {
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white">What recruiters say</h2>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.1}>
              <div className="glass-card rounded-2xl p-6 flex flex-col gap-5 h-full">
                <p className="text-sm text-slate-300 leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', t.color)}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.title}, {t.agency}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section 8: Final CTA ─────────────────────────────────────────────────────

function CtaSection() {
  return (
    <section className="py-24 bg-white/1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Stop losing hours to manual review.
          </h2>
          <p className="text-slate-400 mb-8 text-lg">
            10 free AI calls every month. No credit card.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
          >
            Start Free — No Credit Card Required
            <ChevronRight className="w-4 h-4" />
          </Link>
          <p className="mt-4 text-sm text-slate-600">
            Upgrade to Pro or Agency when you're ready.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-white/6 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 mb-8">
          <div>
            <p className="text-lg font-bold gradient-text mb-1">RecruiterIQ</p>
            <p className="text-xs text-slate-500 max-w-xs">
              AI tools for agency recruiters and in-house recruiting teams.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <a href="#features" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Features</a>
            <a href="#pricing"  className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Pricing</a>
            <Link href="/login"  className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Login</Link>
            <Link href="/signup" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Sign Up</Link>
            <Link href="/privacy" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Privacy</Link>
            <Link href="/terms"   className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Terms</Link>
          </div>
        </div>

        <div className="border-t border-white/6 pt-6">
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} RecruiterIQ. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0F1117] text-white">
      <Nav />
      <HeroSection />
      <ProofBar />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <TestimonialsSection />
      <CtaSection />
      <Footer />
    </div>
  )
}
