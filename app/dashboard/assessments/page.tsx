import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlusCircle, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AssessmentsTable } from '@/components/assessments/assessments-table'
import type { UserProfile } from '@/types/database'

export const metadata = { title: 'My Assessments' }

export default async function AssessmentsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: profile } = await db
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')
  const safeProfile = profile as UserProfile

  // Recruiter locked state
  if (safeProfile.role !== 'manager') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="glass-card rounded-2xl p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-white/8 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-slate-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Assessments for Managers</h2>
          <p className="text-sm text-slate-400 max-w-sm">
            Assessment sending is available to Managers. Ask your team owner to update your role.
          </p>
        </div>
      </div>
    )
  }

  // Fetch assessments with aggregate data
  const { data: assessments } = await db
    .from('assessments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch question counts per assessment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assessmentIds = ((assessments ?? []) as any[]).map((a: any) => a.id)

  const [questionsRes, invitesRes, sessionsRes] = await Promise.all([
    assessmentIds.length > 0
      ? db
          .from('assessment_questions')
          .select('assessment_id')
          .in('assessment_id', assessmentIds)
      : Promise.resolve({ data: [] }),
    assessmentIds.length > 0
      ? db
          .from('assessment_invites')
          .select('assessment_id, status')
          .in('assessment_id', assessmentIds)
      : Promise.resolve({ data: [] }),
    assessmentIds.length > 0
      ? db
          .from('assessment_sessions')
          .select('assessment_id, trust_score, skill_score, recruiter_decision')
          .in('assessment_id', assessmentIds)
          .eq('status', 'completed')
      : Promise.resolve({ data: [] }),
  ])

  // Build per-assessment aggregates
  const questionCounts: Record<string, number> = {}
  const inviteCounts: Record<string, number> = {}
  const avgTrust: Record<string, number | null> = {}
  const avgSkill: Record<string, number | null> = {}
  const approvedCounts: Record<string, number> = {}
  const doNotSubmitCounts: Record<string, number> = {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const q of ((questionsRes.data ?? []) as any[])) {
    questionCounts[q.assessment_id] = (questionCounts[q.assessment_id] ?? 0) + 1
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const inv of ((invitesRes.data ?? []) as any[])) {
    inviteCounts[inv.assessment_id] = (inviteCounts[inv.assessment_id] ?? 0) + 1
  }

  // Group sessions by assessment for avg scores
  const sessionsByAssessment: Record<string, { trust: number[]; skill: number[] }> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of ((sessionsRes.data ?? []) as any[])) {
    if (!sessionsByAssessment[s.assessment_id]) {
      sessionsByAssessment[s.assessment_id] = { trust: [], skill: [] }
    }
    if (s.trust_score !== null) sessionsByAssessment[s.assessment_id].trust.push(s.trust_score)
    if (s.skill_score !== null) sessionsByAssessment[s.assessment_id].skill.push(s.skill_score)
    if (s.recruiter_decision === 'approve')        approvedCounts[s.assessment_id]    = (approvedCounts[s.assessment_id]    ?? 0) + 1
    if (s.recruiter_decision === 'do_not_submit') doNotSubmitCounts[s.assessment_id] = (doNotSubmitCounts[s.assessment_id] ?? 0) + 1
  }

  for (const [id, { trust, skill }] of Object.entries(sessionsByAssessment)) {
    avgTrust[id] = trust.length > 0 ? Math.round(trust.reduce((a, b) => a + b, 0) / trust.length) : null
    avgSkill[id] = skill.length > 0 ? Math.round(skill.reduce((a, b) => a + b, 0) / skill.length) : null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((assessments ?? []) as any[]).map((a: any) => ({
    ...a,
    questionCount:       questionCounts[a.id]    ?? 0,
    inviteCount:         inviteCounts[a.id]      ?? 0,
    avgTrust:            avgTrust[a.id]          ?? null,
    avgSkill:            avgSkill[a.id]          ?? null,
    approvedCount:       approvedCounts[a.id]    ?? 0,
    doNotSubmitCount:    doNotSubmitCounts[a.id] ?? 0,
    proctoring_intensity: a.proctoring_intensity ?? null,
  }))

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">My Assessments</h1>
          <p className="text-sm text-slate-400 mt-0.5">Create and manage candidate assessments</p>
        </div>
        <Link
          href="/dashboard/assessments/create"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
        >
          <PlusCircle className="w-4 h-4" />
          Create Assessment
        </Link>
      </div>

      {/* Table */}
      <AssessmentsTable rows={rows} />
    </div>
  )
}
