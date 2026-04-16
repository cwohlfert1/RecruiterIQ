'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Brain, CheckCircle2, Copy, Download } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import type {
  Assessment,
  AssessmentQuestion,
  AssessmentSession,
  AssessmentInvite,
  AssessmentQuestionResponse,
  ProctoringEvent,
  AssessmentSnapshot,
} from '@/types/database'

import { AutoFlagBanner } from './auto-flag-banner'
import { DecisionCard } from './decision-card'
import { ProctoringDetails } from './proctoring-details'
import { ProctoringTimeline } from './proctoring-timeline'
import { ScoreRingsPanel, type Benchmark } from './score-rings-panel'
import { SkillResults } from './skill-results'
import { SnapshotGallery } from './snapshot-gallery'
import { SnapshotModal } from './snapshot-modal'

interface Props {
  assessment:    Assessment
  session:       AssessmentSession
  invite:        AssessmentInvite | null
  questions:     AssessmentQuestion[]
  responses:     AssessmentQuestionResponse[]
  events:        ProctoringEvent[]
  snapshots:     AssessmentSnapshot[]
  benchmark?:    Benchmark | null
  snapshotUrls?: Record<string, string>
}

export function ProctoringReport({
  assessment, session, invite, questions, responses, events, snapshots,
  benchmark, snapshotUrls = {},
}: Props) {
  const [copiedSummary,   setCopiedSummary]   = useState(false)
  const [modalSnapshots,  setModalSnapshots]  = useState<AssessmentSnapshot[]>([])
  const [modalInitialIdx, setModalInitialIdx] = useState(0)
  const [showModal,       setShowModal]       = useState(false)

  const candidateName  = invite?.candidate_name  ?? 'Candidate'
  const candidateEmail = invite?.candidate_email ?? ''

  const timeSpent = session.time_spent_seconds
    ? `${Math.floor(session.time_spent_seconds / 60)}m ${session.time_spent_seconds % 60}s`
    : '—'

  const completedAt = session.completed_at
    ? new Date(session.completed_at).toLocaleString()
    : '—'

  const startMs    = session.started_at   ? new Date(session.started_at).getTime()   : 0
  const endMs      = session.completed_at ? new Date(session.completed_at).getTime() : Date.now()
  const durationMs = Math.max(endMs - startMs, 1)

  const violationSnapshots = snapshots.filter(s => !!(s as Record<string, unknown>).triggered_by_event)

  function openModal(list: AssessmentSnapshot[], startIdx: number) {
    setModalSnapshots(list)
    setModalInitialIdx(startIdx)
    setShowModal(true)
  }

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
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId: session.id, assessmentId: assessment.id }),
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
        <Link
          href={`/dashboard/assessments/${assessment.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to assessment
        </Link>

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

        <ScoreRingsPanel session={session} benchmark={benchmark} />

        <AutoFlagBanner
          trustScore={session.trust_score}
          candidateName={candidateName}
          candidateEmail={candidateEmail}
        />

        <DecisionCard assessment={assessment} session={session} />

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

        {events.length > 0 && (
          <ProctoringTimeline
            events={events}
            snapshots={snapshots}
            violationSnapshots={violationSnapshots}
            snapshotUrls={snapshotUrls}
            startMs={startMs}
            durationMs={durationMs}
            timeSpent={timeSpent}
            onOpenModal={openModal}
          />
        )}

        <ProctoringDetails assessment={assessment} events={events} />

        <SnapshotGallery
          snapshots={snapshots}
          snapshotUrls={snapshotUrls}
          startMs={startMs}
          onOpenModal={openModal}
        />

        <SkillResults questions={questions} responses={responses} />
      </div>
    </>
  )
}
