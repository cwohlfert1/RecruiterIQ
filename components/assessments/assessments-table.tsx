'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ClipboardList,
  Copy,
  Archive,
  Trash2,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type AssessmentRow = {
  id:            string
  title:         string
  role:          string
  status:        'draft' | 'published' | 'archived'
  created_at:    string
  questionCount: number
  inviteCount:   number
  avgTrust:      number | null
  avgSkill:      number | null
}

const statusBadge: Record<AssessmentRow['status'], string> = {
  draft:    'bg-slate-700/60 text-slate-300 border-slate-600/40',
  published: 'bg-green-500/15 text-green-400 border-green-500/25',
  archived: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
}

function ScorePill({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-500 text-sm">—</span>
  const color = value >= 70 ? 'text-green-400' : value >= 40 ? 'text-yellow-400' : 'text-red-400'
  return <span className={cn('text-sm font-semibold tabular-nums', color)}>{value}</span>
}

export function AssessmentsTable({ rows }: { rows: AssessmentRow[] }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [archiving, setArchiving] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Delete this draft assessment? This cannot be undone.')) return
    setDeleting(id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    const { error } = await supabase.from('assessments').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete assessment')
    } else {
      toast.success('Assessment deleted')
      router.refresh()
    }
    setDeleting(null)
  }

  async function handleArchive(id: string) {
    setArchiving(id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    const { error } = await supabase
      .from('assessments')
      .update({ status: 'archived' })
      .eq('id', id)
    if (error) {
      toast.error('Failed to archive assessment')
    } else {
      toast.success('Assessment archived')
      router.refresh()
    }
    setArchiving(null)
  }

  function handleCopyLink(token: string, assessmentId: string) {
    const baseUrl = window.location.origin
    navigator.clipboard.writeText(`${baseUrl}/assess/${token}`)
    setCopied(assessmentId)
    toast.success('Candidate link copied')
    setTimeout(() => setCopied(null), 2000)
  }

  if (rows.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-14 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center mb-4">
          <ClipboardList className="w-7 h-7 text-indigo-400" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">No assessments yet</h3>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          Create your first assessment to start evaluating candidates with live proctoring and skill tests.
        </p>
        <Link
          href="/dashboard/assessments/create"
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
        >
          Create Assessment
        </Link>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Title</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Role</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Qs</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Status</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Invites</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Avg Trust</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Avg Skill</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Created</th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-widest text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="border-b border-white/5 hover:bg-white/3 transition-colors"
              >
                <td className="px-5 py-3.5">
                  <Link
                    href={`/dashboard/assessments/${row.id}`}
                    className="font-medium text-white hover:text-indigo-300 transition-colors"
                  >
                    {row.title}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-slate-400 max-w-[140px] truncate">{row.role}</td>
                <td className="px-4 py-3.5 text-center text-slate-300">{row.questionCount}</td>
                <td className="px-4 py-3.5 text-center">
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize',
                    statusBadge[row.status]
                  )}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center text-slate-300">{row.inviteCount}</td>
                <td className="px-4 py-3.5 text-center"><ScorePill value={row.avgTrust} /></td>
                <td className="px-4 py-3.5 text-center"><ScorePill value={row.avgSkill} /></td>
                <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                  {new Date(row.created_at).toLocaleDateString()}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    {/* View results */}
                    <Link
                      href={`/dashboard/assessments/${row.id}`}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
                      title="View Results"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>

                    {/* Copy link (published only) */}
                    {row.status === 'published' && (
                      <button
                        onClick={() => handleCopyLink('', row.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
                        title="Copy Link"
                      >
                        {copied === row.id
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                          : <Copy className="w-3.5 h-3.5" />
                        }
                      </button>
                    )}

                    {/* Archive (published only) */}
                    {row.status === 'published' && (
                      <button
                        onClick={() => handleArchive(row.id)}
                        disabled={archiving === row.id}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-yellow-400 hover:bg-yellow-500/8 transition-colors disabled:opacity-40"
                        title="Archive"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete (draft only) */}
                    {row.status === 'draft' && (
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={deleting === row.id}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/8 transition-colors disabled:opacity-40"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
