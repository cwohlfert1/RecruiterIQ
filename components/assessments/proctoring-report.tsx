'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Eye,
  Keyboard,
  ClipboardCopy,
  ShieldCheck,
  Brain,
  ThumbsUp,
  ThumbsDown,
  StickyNote,
  Zap,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type {
  Assessment,
  AssessmentQuestion,
  AssessmentSession,
  AssessmentInvite,
  AssessmentQuestionResponse,
  ProctoringEvent,
  AssessmentSnapshot,
} from '@/types/database'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

// ── Score ring ──────────────────────────────────────────────

function ScoreRing({ score, label }: { score: number | null; label: string }) {
  const pct    = score ?? 0
  const radius = 40
  const circ   = 2 * Math.PI * radius
  const offset = circ - (pct / 100) * circ
  const color  = pct >= 70 ? '#22C55E' : pct >= 40 ? '#EAB308' : '#EF4444'

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={score !== null ? color : 'rgba(255,255,255,0.1)'}
            strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{score ?? '—'}</span>
          <span className="text-[10px] text-slate-500">/100</span>
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mt-2">{label}</p>
    </div>
  )
}

// ── Percentile badge ────────────────────────────────────────

function PercentileBadge({ score, avg }: { score: number | null; avg: number }) {
  if (score === null) return null
  const diff = score - avg
  if (diff > 10)  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25 font-medium">Top performer</span>
  if (diff > 0)   return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25 font-medium">Above average</span>
  if (diff < -10) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-medium">Below average</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/25 font-medium">Average</span>
}

// ── Severity icon ───────────────────────────────────────────

function SeverityDot({ severity }: { severity: string }) {
  const cls = {
    high:   'bg-red-500',
    medium: 'bg-yellow-500',
    low:    'bg-green-500',
    info:   'bg-slate-500',
  }[severity] ?? 'bg-slate-500'
  return <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', cls)} />
}

// ── Event type label ────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  tab_switch:                'Tab Switch',
  paste_detected:            'Paste Detected',
  gaze_off_screen:           'Gaze Off Screen',
  face_not_detected:         'Face Not Detected',
  eye_tracking_degraded:     'Eye Tracking Degraded',
  keystroke_anomaly:         'Keystroke Anomaly',
  presence_challenge_passed: 'Presence Challenge Passed',
  presence_challenge_failed: 'Presence Challenge Failed',
  offline_detected:          'Offline Detected',
  session_resumed:           'Session Resumed',
  automated_input_detected:  'Superhuman Typing Speed',
  code_without_typing:       'Code Without Typing',
}

// ── Question type label ─────────────────────────────────────

const MONACO_LANG: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  react_jsx:  'javascript',
  react_tsx:  'typescript',
  python:     'python',
}

// ── Snapshot modal ──────────────────────────────────────────

function SnapshotModal({
  snapshots,
  initialIdx,
  urls,
  onClose,
}: {
  snapshots: AssessmentSnapshot[]
  initialIdx: number
  urls: Record<string, string>
  onClose: () => void
}) {
  const [idx, setIdx] = useState(initialIdx)
  const snap = snapshots[idx]
  if (!snap) return null

  const label = (snap as Record<string, unknown>).triggered_by_event
    ? EVENT_LABELS[(snap as Record<string, unknown>).triggered_by_event as string] ?? String((snap as Record<string, unknown>).triggered_by_event)
    : `Periodic snapshot`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="relative max-w-2xl w-full flex flex-col items-center gap-3"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <p className="text-sm font-medium text-white">{label}</p>

        {urls[snap.id] ? (
          <img
            src={urls[snap.id]}
            alt={label}
            className="w-full rounded-xl border border-white/10 shadow-2xl"
          />
        ) : (
          <div className="w-full aspect-video bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
            <span className="text-xs text-slate-500">Image unavailable</span>
          </div>
        )}

        <p className="text-xs text-slate-500">{new Date(snap.taken_at).toLocaleString()}</p>

        {snapshots.length > 1 && (
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIdx(i => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="text-xs text-slate-600">{idx + 1} / {snapshots.length}</span>
            <button
              onClick={() => setIdx(i => Math.min(snapshots.length - 1, i + 1))}
              disabled={idx === snapshots.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors disabled:opacity-30"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Main component ──────────────────────────────────────────

interface Benchmark {
  avg_skill_score:   number
  avg_trust_score:   number
  total_assessments: number
  template_type:     string
}

interface Props {
  assessment:   Assessment
  session:      AssessmentSession
  invite:       AssessmentInvite | null
  questions:    AssessmentQuestion[]
  responses:    AssessmentQuestionResponse[]
  events:       ProctoringEvent[]
  snapshots:    AssessmentSnapshot[]
  benchmark?:   Benchmark | null
  snapshotUrls?: Record<string, string>
}

export function ProctoringReport({ assessment, session, invite, questions, responses, events, snapshots, benchmark, snapshotUrls = {} }: Props) {
  const [copiedSummary, setCopiedSummary] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<ProctoringEvent | null>(null)

  // Decision state
  const [decision,      setDecision]      = useState<string | null>((session as Record<string, unknown>).recruiter_decision as string | null ?? null)
  const [decisionNotes, setDecisionNotes] = useState<string>((session as Record<string, unknown>).decision_notes as string ?? '')
  const [savingDecision,setSavingDecision] = useState(false)
  const [showNotes,     setShowNotes]     = useState(false)

  // Snapshot modal
  const [modalSnapshots,  setModalSnapshots]  = useState<AssessmentSnapshot[]>([])
  const [modalInitialIdx, setModalInitialIdx] = useState(0)
  const [showModal,       setShowModal]       = useState(false)

  function openModal(list: AssessmentSnapshot[], startIdx: number) {
    setModalSnapshots(list)
    setModalInitialIdx(startIdx)
    setShowModal(true)
  }

  async function submitDecision(value: 'approve' | 'do_not_submit') {
    setSavingDecision(true)
    try {
      const res = await fetch(`/api/assessments/${assessment.id}/sessions/${session.id}/decision`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ decision: value, notes: decisionNotes }),
      })
      if (res.ok) {
        setDecision(value)
        toast.success(value === 'approve' ? 'Marked as Approved' : 'Marked as Do Not Submit')
      } else {
        toast.error('Failed to save decision')
      }
    } catch {
      toast.error('Failed to save decision')
    } finally {
      setSavingDecision(false)
    }
  }

  // Recommendation based on scores
  function getRecommendation(): { label: string; detail: string; color: string } {
    const trust = session.trust_score ?? 0
    const skill = session.skill_score ?? 0
    if (trust >= 70 && skill >= 70) return { label: 'Strong Candidate', detail: 'High trust and strong skill scores — recommend submitting.', color: 'emerald' }
    if (trust >= 70 && skill >= 40) return { label: 'Potential Candidate', detail: 'Good integrity, moderate skill. Consider additional screening.', color: 'blue' }
    if (trust < 40)  return { label: 'Integrity Concern', detail: 'Low trust score suggests potential academic dishonesty. Review events carefully.', color: 'red' }
    if (skill < 40)  return { label: 'Skills Gap', detail: 'Candidate did not demonstrate sufficient technical skills for this role.', color: 'yellow' }
    return { label: 'Review Required', detail: 'Mixed signals — review proctoring events and skill responses before deciding.', color: 'slate' }
  }

  const rec = getRecommendation()

  const candidateName  = invite?.candidate_name  ?? 'Candidate'
  const candidateEmail = invite?.candidate_email ?? ''

  const timeSpent = session.time_spent_seconds
    ? `${Math.floor(session.time_spent_seconds / 60)}m ${session.time_spent_seconds % 60}s`
    : '—'

  const completedAt = session.completed_at
    ? new Date(session.completed_at).toLocaleString()
    : '—'

  // ── Event grouping ─────────────────────────────────────────

  const tabSwitches    = events.filter(e => e.event_type === 'tab_switch')
  const pastes         = events.filter(e => e.event_type === 'paste_detected')
  const gazeOff        = events.filter(e => e.event_type === 'gaze_off_screen')
  const keystroke      = events.filter(e => e.event_type === 'keystroke_anomaly')
  const presencePassed = events.filter(e => e.event_type === 'presence_challenge_passed')
  const presenceFailed = events.filter(e => e.event_type === 'presence_challenge_failed')
  const automatedInput = events.filter(e => e.event_type === 'automated_input_detected')
  const codeNoTyping   = events.filter(e => e.event_type === 'code_without_typing')

  const proctoring = assessment.proctoring_config as Record<string, boolean | number>

  // ── Response map ───────────────────────────────────────────

  const responseByQuestion: Record<string, AssessmentQuestionResponse> = {}
  for (const r of responses) {
    responseByQuestion[r.question_id] = r
  }

  // ── Timeline ───────────────────────────────────────────────

  const startMs    = session.started_at ? new Date(session.started_at).getTime() : 0
  const endMs      = session.completed_at ? new Date(session.completed_at).getTime() : Date.now()
  const durationMs = Math.max(endMs - startMs, 1)

  function timelinePct(ts: string) {
    return Math.min(100, Math.max(0, ((new Date(ts).getTime() - startMs) / durationMs) * 100))
  }

  // ── Find violation snapshot for an event (±15s) ────────────

  function findViolationSnapshot(event: ProctoringEvent): AssessmentSnapshot | null {
    const eventMs = new Date(event.timestamp).getTime()
    return snapshots.find(s => {
      const sms = new Date(s.taken_at).getTime()
      const tbe = (s as Record<string, unknown>).triggered_by_event as string | null
      return tbe === event.event_type && Math.abs(sms - eventMs) <= 15000
    }) ?? null
  }

  // ── Snapshot split ─────────────────────────────────────────

  const violationSnapshots = snapshots.filter(s => !!(s as Record<string, unknown>).triggered_by_event)
  const periodicSnapshots  = snapshots.filter(s => !(s as Record<string, unknown>).triggered_by_event)

  // ── Benchmark helpers ──────────────────────────────────────

  const showBenchmark = !!(benchmark && benchmark.total_assessments >= 3)

  // ── Copy summary ───────────────────────────────────────────

  function copySummary() {
    const sentence = session.ai_integrity_summary?.split('.')[0] ?? ''
    const text = `${candidateName} | Trust: ${session.trust_score ?? '?'}/100 | Skill: ${session.skill_score ?? '?'}/100 | ${sentence}.`
    navigator.clipboard.writeText(text)
    setCopiedSummary(true)
    toast.success('Summary copied')
    setTimeout(() => setCopiedSummary(false), 2000)
  }

  async function downloadPDF() {
    toast.info('Generating PDF…')
    const res = await fetch('/api/assessments/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, assessmentId: assessment.id }),
    })
    if (!res.ok) { toast.error('PDF generation failed'); return }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `report-${candidateName.replace(/\s+/g, '-')}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <AnimatePresence>
        {showModal && (
          <SnapshotModal
            snapshots={modalSnapshots}
            initialIdx={modalInitialIdx}
            urls={snapshotUrls}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back */}
        <Link
          href={`/dashboard/assessments/${assessment.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to assessment
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">{candidateName}</h1>
            <p className="text-sm text-slate-400">{candidateEmail}</p>
            <p className="text-xs text-slate-600 mt-1">
              {assessment.title} · {assessment.role} · Completed {completedAt} · {timeSpent}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copySummary}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors"
            >
              {copiedSummary ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              Copy Summary
            </button>
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>

        {/* Score rings + benchmark */}
        <div className="glass-card rounded-2xl p-8 flex items-start justify-center gap-16">
          {/* Trust score */}
          <div className="flex flex-col items-center gap-2">
            <ScoreRing score={session.trust_score} label="Trust Score" />
            {showBenchmark && (
              <div className="flex flex-col items-center gap-1.5 text-center">
                <PercentileBadge score={session.trust_score} avg={benchmark!.avg_trust_score} />
                <p className="text-xs text-slate-500">
                  Avg integrity for {benchmark!.template_type}: {Math.round(benchmark!.avg_trust_score)}/100
                </p>
              </div>
            )}
            {benchmark && benchmark.total_assessments < 3 && (
              <p className="text-[10px] text-slate-600">Not enough data yet</p>
            )}
          </div>

          <div className="w-px h-20 bg-white/8 mt-4" />

          {/* Skill score */}
          <div className="flex flex-col items-center gap-2">
            <ScoreRing score={session.skill_score} label="Skill Score" />
            {showBenchmark && (
              <div className="flex flex-col items-center gap-1.5 text-center">
                <PercentileBadge score={session.skill_score} avg={benchmark!.avg_skill_score} />
                <p className="text-xs text-slate-500">
                  Avg skill for {benchmark!.template_type}: {Math.round(benchmark!.avg_skill_score)}/100
                  {' '}across {benchmark!.total_assessments} candidate{benchmark!.total_assessments !== 1 ? 's' : ''}
                </p>
              </div>
            )}
            {benchmark && benchmark.total_assessments < 3 && (
              <p className="text-[10px] text-slate-600">Not enough data yet</p>
            )}
          </div>
        </div>

        {/* Decision card */}
        <div className={cn(
          'glass-card rounded-2xl p-6 space-y-4 border',
          decision === 'approve'        ? 'border-emerald-500/30 bg-emerald-500/5' :
          decision === 'do_not_submit'  ? 'border-red-500/30 bg-red-500/5' :
          'border-white/8'
        )}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">Recruiter Decision</h2>
              <div className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
                rec.color === 'emerald' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' :
                rec.color === 'blue'    ? 'bg-blue-500/15 text-blue-300 border-blue-500/25' :
                rec.color === 'red'     ? 'bg-red-500/15 text-red-300 border-red-500/25' :
                rec.color === 'yellow'  ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25' :
                'bg-slate-500/15 text-slate-300 border-slate-500/25'
              )}>
                {rec.label}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">{rec.detail}</p>
            </div>

            {decision && (
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border',
                decision === 'approve'       ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                'bg-red-500/20 text-red-300 border-red-500/30'
              )}>
                {decision === 'approve' ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                {decision === 'approve' ? 'Approved' : 'Do Not Submit'}
              </div>
            )}
          </div>

          {!decision && (
            <div className="flex gap-3">
              <button onClick={() => submitDecision('approve')} disabled={savingDecision}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <ThumbsUp className="w-4 h-4" /> Approve
              </button>
              <button onClick={() => submitDecision('do_not_submit')} disabled={savingDecision}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-300 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <ThumbsDown className="w-4 h-4" /> Do Not Submit
              </button>
              <button onClick={() => setShowNotes(!showNotes)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-white/5 border border-white/10 hover:border-white/20 hover:text-white transition-colors">
                <StickyNote className="w-4 h-4" /> {showNotes ? 'Hide Notes' : 'Add Notes'}
              </button>
            </div>
          )}

          {decision && (
            <button onClick={() => setDecision(null)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Change decision
            </button>
          )}

          {(showNotes || decisionNotes) && (
            <div>
              <textarea
                value={decisionNotes}
                onChange={e => setDecisionNotes(e.target.value)}
                placeholder="Optional notes about this decision..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors resize-none"
              />
              {decision && (
                <button onClick={() => submitDecision(decision as 'approve' | 'do_not_submit')} disabled={savingDecision}
                  className="mt-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-brand hover-glow transition-all disabled:opacity-40">
                  Save Notes
                </button>
              )}
            </div>
          )}
        </div>

        {/* AI integrity summary */}
        {session.ai_integrity_summary && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-6 border border-indigo-500/15">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
                <Brain className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-sm font-semibold text-white">AI Integrity Summary</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{session.ai_integrity_summary}</p>
          </motion.div>
        )}

        {/* Proctoring timeline */}
        {events.length > 0 && (
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white">Proctoring Timeline</h2>
            <div className="relative h-6 bg-white/5 rounded-full overflow-visible">
              <div className="absolute inset-0 rounded-full bg-green-500/10" />
              {events.map(event => {
                const pct = timelinePct(event.timestamp)
                const dotColor = {
                  high:   'bg-red-500',
                  medium: 'bg-yellow-500',
                  low:    'bg-green-500',
                  info:   'bg-slate-500',
                }[event.severity] ?? 'bg-slate-500'
                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                    style={{ left: `${pct}%` }}
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-[#1A1D2E] hover:scale-150 transition-transform cursor-pointer z-10',
                      dotColor
                    )}
                    title={EVENT_LABELS[event.event_type] ?? event.event_type}
                  />
                )
              })}
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Start</span>
              <span>End ({timeSpent})</span>
            </div>

            {/* Event detail popup with optional snapshot thumbnail */}
            {selectedEvent && (() => {
              const snap = findViolationSnapshot(selectedEvent)
              return (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SeverityDot severity={selectedEvent.severity} />
                      <span className="font-medium text-white">{EVENT_LABELS[selectedEvent.event_type] ?? selectedEvent.event_type}</span>
                    </div>
                    <button onClick={() => setSelectedEvent(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(selectedEvent.timestamp).toLocaleTimeString()}
                  </p>
                  <pre className="text-xs text-slate-400 bg-white/5 rounded-lg p-2 overflow-x-auto">
                    {JSON.stringify(selectedEvent.payload_json, null, 2)}
                  </pre>
                  {snap && (
                    <div className="mt-2">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Snapshot at moment of violation</p>
                      {snapshotUrls[snap.id] ? (
                        <button onClick={() => openModal(violationSnapshots.length > 0 ? violationSnapshots : [snap], violationSnapshots.indexOf(snap) >= 0 ? violationSnapshots.indexOf(snap) : 0)}>
                          <img
                            src={snapshotUrls[snap.id]}
                            alt="Violation snapshot"
                            className="w-20 h-14 object-cover rounded-md border border-white/10 hover:border-indigo-500/50 transition-colors cursor-pointer"
                          />
                        </button>
                      ) : (
                        <div className="w-20 h-14 bg-white/5 rounded-md border border-white/10 flex items-center justify-center">
                          <span className="text-[9px] text-slate-600">No image</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* Proctoring detail cards */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Proctoring Details</h2>

          {/* Tab switching */}
          {proctoring.tab_switching && (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-white">Tab Switching</span>
                <span className="ml-auto text-xs text-slate-500">{tabSwitches.length} events</span>
              </div>
              {tabSwitches.length === 0 ? (
                <p className="text-xs text-slate-500">No tab switches detected.</p>
              ) : (
                <div className="space-y-1.5">
                  {tabSwitches.map(e => {
                    const payload = e.payload_json as Record<string, unknown>
                    const ms = typeof payload.duration_away_ms === 'number' ? payload.duration_away_ms : 0
                    const suspicious = ms > 15000
                    return (
                      <div key={e.id} className="flex items-center gap-3 text-xs">
                        <SeverityDot severity={e.severity} />
                        <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                        <span className={cn(suspicious ? 'text-red-400' : 'text-slate-300')}>
                          {(ms / 1000).toFixed(1)}s away{suspicious && ' ⚠ Suspicious'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Paste detection */}
          {proctoring.paste_detection && (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ClipboardCopy className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-white">Paste Detection</span>
                <span className="ml-auto text-xs text-slate-500">{pastes.length} events</span>
              </div>
              {pastes.length === 0 ? (
                <p className="text-xs text-slate-500">No paste events detected.</p>
              ) : (
                <div className="space-y-1.5">
                  {pastes.map(e => {
                    const payload = e.payload_json as Record<string, unknown>
                    const chars = typeof payload.char_count === 'number' ? payload.char_count : 0
                    const preview = typeof payload.content_preview === 'string' ? payload.content_preview : ''
                    return (
                      <div key={e.id} className="text-xs space-y-0.5">
                        <div className="flex items-center gap-3">
                          <SeverityDot severity={e.severity} />
                          <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                          <span className={cn(chars > 500 ? 'text-red-400' : 'text-slate-300')}>
                            {chars} chars{chars > 500 && ' ⚠ High risk'}
                          </span>
                        </div>
                        {preview && <p className="ml-6 text-slate-500 font-mono truncate">&ldquo;{preview}&rdquo;</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Keystroke dynamics */}
          {proctoring.keystroke_dynamics && (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-white">Keystroke Dynamics</span>
                <span className="ml-auto text-xs text-slate-500">{keystroke.length} anomalies</span>
              </div>
              {keystroke.length === 0 ? (
                <p className="text-xs text-slate-500">No significant rhythm anomalies detected.</p>
              ) : (
                <div className="space-y-1.5">
                  {keystroke.map(e => {
                    const payload = e.payload_json as Record<string, unknown>
                    return (
                      <div key={e.id} className="flex items-center gap-3 text-xs">
                        <SeverityDot severity={e.severity} />
                        <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                        <span className="text-slate-300">
                          Baseline {String(payload.baseline_iki_ms ?? '?')}ms → Current {String(payload.current_iki_ms ?? '?')}ms
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Presence challenges */}
          {proctoring.presence_challenges && (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-white">Presence Challenges</span>
                <span className="ml-auto text-xs text-slate-500">
                  {presencePassed.length}/{presencePassed.length + presenceFailed.length} passed
                </span>
              </div>
              {presencePassed.length + presenceFailed.length === 0 ? (
                <p className="text-xs text-slate-500">No presence challenges recorded.</p>
              ) : (
                <div className="space-y-1.5">
                  {[...presencePassed, ...presenceFailed].sort((a, b) =>
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  ).map(e => {
                    const passed  = e.event_type === 'presence_challenge_passed'
                    const payload = e.payload_json as Record<string, unknown>
                    return (
                      <div key={e.id} className="flex items-center gap-3 text-xs">
                        <span className={cn('text-lg', passed ? 'text-green-400' : 'text-red-400')}>{passed ? '✓' : '✗'}</span>
                        <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                        <span className="text-slate-300 font-mono">&ldquo;{String(payload.word ?? '')}&rdquo;</span>
                        {passed && <span className="text-slate-500">{String(payload.response_time_ms ?? '')}ms</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Eye tracking */}
          {proctoring.eye_tracking && (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-white">Eye Tracking</span>
                <span className="ml-auto text-xs text-slate-500">{gazeOff.length} gaze-off events</span>
              </div>
              {gazeOff.length === 0 ? (
                <p className="text-xs text-slate-500">No gaze-off events recorded.</p>
              ) : (
                <div className="space-y-1.5">
                  {gazeOff.map(e => {
                    const payload = e.payload_json as Record<string, unknown>
                    const ms = typeof payload.duration_ms === 'number' ? payload.duration_ms : 0
                    return (
                      <div key={e.id} className="flex items-center gap-3 text-xs">
                        <SeverityDot severity={e.severity} />
                        <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                        <span className="text-slate-300">{(ms / 1000).toFixed(1)}s off screen</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Ghost typist — automated input */}
          {automatedInput.length > 0 && (
            <div className="glass-card rounded-2xl p-5 space-y-3 border border-red-500/20">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-red-400" />
                <span className="text-sm font-semibold text-red-300">Superhuman Typing Speed Detected</span>
                <span className="ml-auto text-xs text-red-400/60">{automatedInput.length} event{automatedInput.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {automatedInput.map(e => {
                  const payload = e.payload_json as Record<string, unknown>
                  const avg = typeof payload.avgIntervalMs === 'number' ? payload.avgIntervalMs : null
                  return (
                    <div key={e.id} className="text-xs space-y-1">
                      <div className="flex items-center gap-3">
                        <SeverityDot severity="high" />
                        <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                        {avg !== null && <span className="text-red-300 font-medium">{avg}ms avg between keystrokes</span>}
                      </div>
                      <p className="ml-5 text-slate-500 leading-relaxed">
                        Code entered at {avg !== null ? `${avg}ms` : 'superhuman'} average between keystrokes — human maximum is ~120ms.
                        Possible AI completion tool, clipboard macro, or remote operator.
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Ghost typist — code without typing */}
          {codeNoTyping.length > 0 && (
            <div className="glass-card rounded-2xl p-5 space-y-3 border border-red-500/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-semibold text-red-300">Code Appeared Without Keyboard Activity</span>
                <span className="ml-auto text-xs text-red-400/60">{codeNoTyping.length} event{codeNoTyping.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {codeNoTyping.map(e => {
                  const payload = e.payload_json as Record<string, unknown>
                  const chars = typeof payload.charsAdded === 'number' ? payload.charsAdded : null
                  const keys  = typeof payload.keystrokesDetected === 'number' ? payload.keystrokesDetected : null
                  return (
                    <div key={e.id} className="text-xs space-y-1">
                      <div className="flex items-center gap-3">
                        <SeverityDot severity="high" />
                        <span className="text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                        {chars !== null && keys !== null && (
                          <span className="text-red-300 font-medium">{chars} chars, {keys} keystroke{keys !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                      <p className="ml-5 text-slate-500 leading-relaxed">
                        {chars} characters appeared with only {keys} keystroke{keys !== 1 ? 's' : ''} detected.
                        Consistent with pasting, code injection, or a remote operator typing on a different device.
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Snapshot gallery — split into Violation and Periodic */}
        {snapshots.length > 0 && (
          <div className="space-y-5">
            {/* Violation snapshots */}
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Violation Snapshots ({violationSnapshots.length})
              </h2>
              {violationSnapshots.length === 0 ? (
                <p className="text-xs text-slate-600 italic">No violation snapshots captured — webcam may have been off or no high-severity events occurred.</p>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {violationSnapshots.map((snap, i) => {
                    const tbe = (snap as Record<string, unknown>).triggered_by_event as string | null
                    return (
                      <button
                        key={snap.id}
                        onClick={() => openModal(violationSnapshots, i)}
                        className="group glass-card rounded-xl overflow-hidden aspect-video bg-white/5 flex flex-col items-center justify-center relative border border-red-500/15 hover:border-red-500/40 transition-colors"
                      >
                        {snapshotUrls[snap.id] ? (
                          <img src={snapshotUrls[snap.id]} alt="Violation" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-slate-600">{new Date(snap.taken_at).toLocaleTimeString()}</span>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1.5 py-1 text-[9px] text-red-300 truncate">
                          {tbe ? (EVENT_LABELS[tbe] ?? tbe) : 'Violation'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Periodic snapshots */}
            {periodicSnapshots.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Periodic Snapshots ({periodicSnapshots.length}) — Retained 90 days
                </h2>
                <div className="grid grid-cols-4 gap-3">
                  {periodicSnapshots.map((snap, i) => {
                    const secsIn = Math.round((new Date(snap.taken_at).getTime() - startMs) / 1000)
                    const label  = secsIn >= 60 ? `${Math.floor(secsIn / 60)}:${String(secsIn % 60).padStart(2, '0')} in` : `${secsIn}s in`
                    return (
                      <button
                        key={snap.id}
                        onClick={() => openModal(periodicSnapshots, i)}
                        className="group glass-card rounded-xl overflow-hidden aspect-video bg-white/5 flex flex-col items-center justify-center relative border border-white/8 hover:border-white/20 transition-colors"
                      >
                        {snapshotUrls[snap.id] ? (
                          <img src={snap.id in snapshotUrls ? snapshotUrls[snap.id] : ''} alt="Periodic" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-slate-600">{new Date(snap.taken_at).toLocaleTimeString()}</span>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1.5 py-1 text-[9px] text-slate-400 truncate">
                          {label}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Skill assessment results */}
        {questions.length > 0 && (
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
        )}
      </div>
    </>
  )
}
