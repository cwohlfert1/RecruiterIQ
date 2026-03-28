'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Plus, ChevronRight, Check, X, Download, RotateCcw, Loader2, Trophy, ChevronDown, ChevronUp } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { UpgradeModal } from '@/components/upgrade-modal'
import type { Database } from '@/types/database'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CandidateInput {
  id:         string   // local key only
  name:       string
  resumeText: string
}

interface RankedCandidate {
  id:        string | null
  name:      string
  cqi_score: number
  rank:      number
  strengths: string[]
  gaps:      string[]
  notes:     string | null
}

interface RankingResult {
  rankingId:  string
  jobTitle:   string
  candidates: RankedCandidate[]
}

type Step = 1 | 2 | 3

// ─── CQI Score Ring ────────────────────────────────────────────────────────────

function CQIRing({ score, size = 64 }: { score: number; size?: number }) {
  const radius        = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const [displayScore, setDisplayScore] = useState(0)

  useEffect(() => {
    let current = 0
    const step = () => {
      current += 2
      if (current >= score) {
        setDisplayScore(score)
        return
      }
      setDisplayScore(current)
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [score])

  const scoreColor =
    score >= 80 ? '#22C55E' : score >= 60 ? '#EAB308' : '#EF4444'
  const offset = circumference - (displayScore / 100) * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4"
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={scoreColor} strokeWidth="4"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.05s linear' }}
      />
      <text
        x="50%" y="50%" textAnchor="middle" dy="0.35em"
        fontSize={size * 0.25} fill={scoreColor} fontWeight="700"
      >
        {displayScore}
      </text>
    </svg>
  )
}

// ─── Word counter helper ───────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ─── Rank badge colours ────────────────────────────────────────────────────────

function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'bg-amber-400/20 text-amber-300 border-amber-400/40'
  if (rank === 2) return 'bg-slate-400/20 text-slate-300 border-slate-400/40'
  if (rank === 3) return 'bg-amber-700/20 text-amber-600 border-amber-700/40'
  return 'bg-white/5 text-slate-400 border-white/10'
}

// ─── Candidate result card ─────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  index,
  onNoteChange,
}: {
  candidate:    RankedCandidate
  index:        number
  onNoteChange: (id: string | null, note: string) => void
}) {
  const [noteText,    setNoteText]    = useState(candidate.notes ?? '')
  const [noteOpen,    setNoteOpen]    = useState(false)
  const [noteSaving,  setNoteSaving]  = useState(false)
  const [noteSaved,   setNoteSaved]   = useState(false)

  const scoreColor =
    candidate.cqi_score >= 80
      ? 'text-green-400'
      : candidate.cqi_score >= 60
        ? 'text-yellow-400'
        : 'text-red-400'

  async function handleNoteBlur() {
    if (!candidate.id) return
    if (noteText === (candidate.notes ?? '')) return

    setNoteSaving(true)
    const supabase = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    await supabase
      .from('stack_ranking_candidates')
      .update({ notes: noteText })
      .eq('id', candidate.id)

    setNoteSaving(false)
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
    onNoteChange(candidate.id, noteText)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className="glass-card rounded-2xl p-5"
    >
      <div className="flex items-start gap-4">
        {/* Rank badge */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center text-sm font-bold ${rankBadgeClass(candidate.rank)}`}>
          #{candidate.rank}
        </div>

        {/* CQI ring */}
        <div className="flex-shrink-0">
          <CQIRing score={candidate.cqi_score} size={64} />
        </div>

        {/* Name + score label */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white truncate">{candidate.name}</h3>
          <p className={`text-sm font-medium ${scoreColor}`}>
            CQI Score: {candidate.cqi_score}/100
          </p>
        </div>
      </div>

      {/* Strengths */}
      {candidate.strengths.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Strengths</p>
          <ul className="space-y-1">
            {candidate.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gaps */}
      {candidate.gaps.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Gaps</p>
          <ul className="space-y-1">
            {candidate.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes section */}
      <div className="mt-4 border-t border-white/5 pt-3">
        <button
          onClick={() => setNoteOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {noteOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {noteText ? 'Edit note' : 'Add note'}
        </button>

        <AnimatePresence>
          {noteOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 relative">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onBlur={handleNoteBlur}
                  placeholder="Add a personal note about this candidate..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
                {noteSaving && (
                  <span className="absolute bottom-2 right-2 text-xs text-slate-500">Saving…</span>
                )}
                {noteSaved && (
                  <span className="absolute bottom-2 right-2 text-xs text-green-400">Saved</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function RankingPage() {
  // Gate state
  const [planChecked,    setPlanChecked]    = useState(false)
  const [isAgency,       setIsAgency]       = useState(false)
  const [showUpgrade,    setShowUpgrade]    = useState(false)

  // Step state
  const [step,           setStep]           = useState<Step>(1)

  // Step 1 fields
  const [jobTitle,       setJobTitle]       = useState('')
  const [jobDescription, setJobDescription] = useState('')

  // Step 2 fields
  const [candidates,     setCandidates]     = useState<CandidateInput[]>([])
  const [newName,        setNewName]        = useState('')
  const [newResume,      setNewResume]      = useState('')

  // Loading / results
  const [loading,        setLoading]        = useState(false)
  const [result,         setResult]         = useState<RankingResult | null>(null)
  const [apiError,       setApiError]       = useState<string | null>(null)

  // Note sync in result
  const [resultCandidates, setResultCandidates] = useState<RankedCandidate[]>([])

  const nameInputRef = useRef<HTMLInputElement>(null)

  // ── Check plan tier on mount ────────────────────────────────────────────────
  useEffect(() => {
    async function checkPlan() {
      const supabase = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setPlanChecked(true); return }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('plan_tier')
        .eq('user_id', user.id)
        .single()

      const agency = profile?.plan_tier === 'agency'
      setIsAgency(agency)
      if (!agency) setShowUpgrade(true)
      setPlanChecked(true)
    }
    checkPlan()
  }, [])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const jdWordCount    = countWords(jobDescription)
  const newResumeWords = countWords(newResume)
  const canAddMore     = candidates.length < 10
  const canRank        = candidates.length >= 2

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleStep1Continue() {
    if (!jobTitle.trim() || !jobDescription.trim()) return
    setStep(2)
  }

  function handleAddCandidate() {
    if (!newName.trim() || !newResume.trim()) return
    if (!canAddMore) return
    setCandidates((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: newName.trim(), resumeText: newResume.trim() },
    ])
    setNewName('')
    setNewResume('')
    nameInputRef.current?.focus()
  }

  function handleRemoveCandidate(id: string) {
    setCandidates((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleRank() {
    if (!canRank || loading) return
    setLoading(true)
    setApiError(null)

    try {
      const res = await fetch('/api/stack-rank', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle,
          jobDescription,
          candidates: candidates.map(({ name, resumeText }) => ({ name, resumeText })),
        }),
      })

      const data = await res.json() as RankingResult & { error?: string; reason?: string }

      if (!res.ok) {
        if (res.status === 403 && data.reason === 'plan_required') {
          setShowUpgrade(true)
          return
        }
        setApiError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      setResult(data)
      setResultCandidates(data.candidates)
      setStep(3)
    } catch {
      setApiError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleNoteChange(id: string | null, note: string) {
    if (!id) return
    setResultCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, notes: note } : c))
    )
  }

  function handleReset() {
    setStep(1)
    setJobTitle('')
    setJobDescription('')
    setCandidates([])
    setNewName('')
    setNewResume('')
    setResult(null)
    setResultCandidates([])
    setApiError(null)
  }

  function handleExportCSV() {
    if (!result) return
    const rows: (string | number | null)[][] = [
      ['Rank', 'Name', 'CQI Score', 'Strengths', 'Gaps', 'Notes'],
      ...resultCandidates.map((c) => [
        c.rank,
        c.name,
        c.cqi_score,
        c.strengths.join('; '),
        c.gaps.join('; '),
        c.notes ?? '',
      ]),
    ]
    const csv = rows
      .map((r) =>
        r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `stack-ranking-${result.jobTitle.replace(/\s+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!planChecked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 relative">

      {/* ── Upgrade modal (agency gate) ── */}
      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="plan_required"
        requiredPlan="agency"
      />

      {/* ── Blurred preview overlay when not agency ── */}
      {!isAgency && (
        <div className="absolute inset-0 z-10 backdrop-blur-sm bg-[#0F1117]/60 rounded-2xl pointer-events-none" />
      )}

      {/* ── Page header ── */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-violet-300" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Stack Ranking</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              Agency
            </span>
          </div>
          <p className="text-sm text-slate-400">Score and rank candidates by CQI — Candidate Quality Index</p>
        </div>
      </div>

      {/* ── Step indicators ── */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step === s
                  ? 'bg-indigo-500 text-white'
                  : step > s
                    ? 'bg-indigo-500/30 text-indigo-300'
                    : 'bg-white/5 text-slate-500'
              }`}
            >
              {step > s ? <Check className="w-3.5 h-3.5" /> : s}
            </div>
            <span className={`text-xs hidden sm:block ${step === s ? 'text-white' : 'text-slate-500'}`}>
              {s === 1 ? 'Job Setup' : s === 2 ? 'Add Candidates' : 'Results'}
            </span>
            {i < 2 && <div className="flex-1 h-px bg-white/5 w-8 sm:w-12" />}
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════
          STEP 1 — Job Setup
      ════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
          >
            <div className="glass-card rounded-2xl p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Job Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value.slice(0, 100))}
                  placeholder="e.g. Senior Software Engineer"
                  maxLength={100}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
                <p className="text-xs text-slate-500 mt-1 text-right">{jobTitle.length}/100</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Job Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here…"
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
                <p className={`text-xs mt-1 text-right ${jdWordCount > 500 ? 'text-red-400' : 'text-slate-500'}`}>
                  {jdWordCount}/500 words
                </p>
              </div>

              <button
                onClick={handleStep1Continue}
                disabled={!jobTitle.trim() || !jobDescription.trim() || jdWordCount > 500}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════
            STEP 2 — Add Candidates
        ════════════════════════════════════════════════════ */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            {/* Breadcrumb */}
            <p className="text-sm text-slate-400">
              Ranking for: <span className="text-white font-medium">{jobTitle}</span>
            </p>

            {/* Add candidate form */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-white">Add a Candidate</h2>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Candidate Name</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.slice(0, 100))}
                  placeholder="Full name"
                  maxLength={100}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Resume Text</label>
                <textarea
                  value={newResume}
                  onChange={(e) => setNewResume(e.target.value)}
                  placeholder="Paste resume text here…"
                  rows={8}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
                <p className={`text-xs mt-1 text-right ${newResumeWords > 500 ? 'text-red-400' : 'text-slate-500'}`}>
                  {newResumeWords}/500 words
                </p>
              </div>

              <button
                onClick={handleAddCandidate}
                disabled={!newName.trim() || !newResume.trim() || newResumeWords > 500 || !canAddMore}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Plus className="w-4 h-4" />
                Add Candidate
              </button>
            </div>

            {/* Candidate list */}
            {candidates.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-300">
                    {candidates.length}/10 candidates added
                  </p>
                </div>

                <AnimatePresence>
                  {candidates.map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -16, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className="glass-card rounded-xl px-4 py-3 flex items-center gap-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{c.name}</p>
                        <p className="text-xs text-slate-500 truncate">{c.resumeText.slice(0, 100)}{c.resumeText.length > 100 ? '…' : ''}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveCandidate(c.id)}
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        aria-label="Remove candidate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Error */}
            {apiError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {apiError}
              </div>
            )}

            {/* Rank button */}
            <button
              onClick={handleRank}
              disabled={!canRank || loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing candidates with Claude…
                </>
              ) : (
                <>
                  <Trophy className="w-4 h-4" />
                  Rank Candidates
                </>
              )}
            </button>

            {/* Loading shimmer */}
            {loading && (
              <div className="space-y-3">
                {candidates.map((_, i) => (
                  <div
                    key={i}
                    className="glass-card rounded-2xl p-5 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5" />
                      <div className="w-16 h-16 rounded-full bg-white/5" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-white/5 rounded w-1/2" />
                        <div className="h-3 bg-white/5 rounded w-1/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════
            STEP 3 — Results
        ════════════════════════════════════════════════════ */}
        {step === 3 && result && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            {/* Results header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">{result.jobTitle}</h2>
                <p className="text-sm text-slate-400">Ranked by CQI Score · {resultCandidates.length} candidates</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  New Ranking
                </button>
              </div>
            </div>

            {/* Candidate cards */}
            <div className="space-y-4">
              {resultCandidates.map((candidate, i) => (
                <CandidateCard
                  key={candidate.id ?? candidate.name}
                  candidate={candidate}
                  index={i}
                  onNoteChange={handleNoteChange}
                />
              ))}
            </div>

            {/* Bottom actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleExportCSV}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Start New Ranking
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
