'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Trash2, ChevronDown, ChevronUp, Copy, Check,
  FileSearch, FileText, Trophy, Clock, AlertTriangle, ShieldAlert, FolderOpen,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelativeTime, getScoreColor } from '@/lib/utils'
import { toast } from 'sonner'
import type {
  ResumeScore, ClientSummary, BooleanSearch, StackRanking, StackCandidate, RedFlagCheck,
} from '@/types/database'

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = 'scores' | 'summaries' | 'boolean' | 'rankings' | 'redflags' | 'projects'

type ProjectRow = {
  id: string
  title: string
  client_name: string | null
  status: 'active' | 'filled' | 'on_hold' | 'archived'
  created_at: string
  updated_at: string
}

type RankingRow = StackRanking & {
  stack_ranking_candidates: Pick<StackCandidate, 'id' | 'candidate_name' | 'score' | 'rank'>[]
}

const PAGE_SIZE = 20

const TAB_CONFIG: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'scores',    label: 'Resume Scores',   icon: <FileSearch   className="w-4 h-4" /> },
  { id: 'summaries', label: 'Summaries',        icon: <FileText     className="w-4 h-4" /> },
  { id: 'boolean',   label: 'Boolean Strings',  icon: <Search       className="w-4 h-4" /> },
  { id: 'rankings',  label: 'Stack Rankings',   icon: <Trophy       className="w-4 h-4" /> },
  { id: 'redflags',  label: 'Red Flag Checks',  icon: <ShieldAlert  className="w-4 h-4" /> },
  { id: 'projects',  label: 'Projects',          icon: <FolderOpen   className="w-4 h-4" /> },
]

const STATUS_CONFIG: Record<ProjectRow['status'], { label: string; cls: string }> = {
  active:   { label: 'Active',   cls: 'bg-green-500/20 text-green-400 border-green-500/30'    },
  filled:   { label: 'Filled',   cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30'       },
  on_hold:  { label: 'On Hold',  cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  archived: { label: 'Archived', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30'    },
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 80
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : score >= 60
    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30'
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', cls)}>
      {score}
    </span>
  )
}

function HighlightBoolean({ str }: { str: string }) {
  const parts = str.split(/(\bAND\b|\bOR\b|\bNOT\b|"[^"]*"|\(|\))/)
  return (
    <code className="font-mono text-sm break-all leading-relaxed">
      {parts.map((part, i) => {
        if (/^(AND|OR|NOT)$/.test(part))
          return <span key={i} className="text-indigo-400 font-bold">{part}</span>
        if (part.startsWith('"'))
          return <span key={i} className="text-emerald-400">{part}</span>
        if (part === '(' || part === ')')
          return <span key={i} className="text-slate-400">{part}</span>
        return <span key={i} className="text-slate-300">{part}</span>
      })}
    </code>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-xl bg-white/4 animate-pulse"
          style={{ animationDelay: `${i * 0.07}s` }}
        />
      ))}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-4">
        <Clock className="w-6 h-6 text-slate-500" />
      </div>
      <p className="text-sm font-medium text-slate-400">No {label} yet</p>
      <p className="text-xs text-slate-600 mt-1">
        Your history will appear here after you use this feature
      </p>
    </div>
  )
}

function DeleteDialog({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card rounded-2xl p-6 w-full max-w-sm relative z-10"
      >
        <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">Delete this record?</h3>
        <p className="text-sm text-slate-400 mb-5">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 border border-white/10 hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 px-4 rounded-xl text-sm font-semibold text-white bg-red-500/80 hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors',
        copied
          ? 'border-green-500/30 text-green-400 bg-green-500/10'
          : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 bg-white/4',
      )}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ─── Row action buttons (reused in every table) ──────────────────────────────

function RowActions({
  id,
  expanded,
  onToggle,
  onDelete,
}: {
  id: string
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      {expanded
        ? <ChevronUp  className="w-4 h-4 text-slate-400 flex-shrink-0" />
        : <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-400 flex-shrink-0" />
      }
    </div>
  )
}

// ─── Expandable detail panel ─────────────────────────────────────────────────

function ExpandPanel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="bg-white/3 rounded-xl p-4 mt-1 space-y-3"
    >
      {children}
    </motion.div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function HistoryClient() {
  const supabase = useMemo(() => createClient(), [])
  const router   = useRouter()

  const [activeTab,   setActiveTab]   = useState<Tab>('scores')
  const [searchInput, setSearchInput] = useState('')
  const [debSearch,   setDebSearch]   = useState('')
  const [page,        setPage]        = useState(1)
  const [totalCount,  setTotalCount]  = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [deleting,    setDeleting]    = useState(false)

  const [scores,    setScores]    = useState<ResumeScore[]>([])
  const [summaries, setSummaries] = useState<ClientSummary[]>([])
  const [booleans,  setBooleans]  = useState<BooleanSearch[]>([])
  const [rankings,  setRankings]  = useState<RankingRow[]>([])
  const [redflags,  setRedflags]  = useState<RedFlagCheck[]>([])
  const [projects,  setProjects]  = useState<ProjectRow[]>([])

  // Debounce search
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearch = (val: string) => {
    setSearchInput(val)
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => {
      setDebSearch(val)
      setPage(1)
    }, 300)
  }

  const handleTabChange = (tab: Tab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    setSearchInput('')
    setDebSearch('')
    setPage(1)
    setExpandedId(null)
  }

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id)

  // ─── Fetch ───────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    const from = (page - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    setLoading(true)

    if (activeTab === 'scores') {
      let q = supabase
        .from('resume_scores')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (debSearch) q = q.ilike('job_title', `%${debSearch}%`)
      q.then(({ data, count }) => {
        if (cancelled) return
        setScores((data ?? []) as ResumeScore[])
        setTotalCount(count ?? 0)
        setLoading(false)
      })
    } else if (activeTab === 'summaries') {
      let q = supabase
        .from('client_summaries')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (debSearch) q = q.ilike('job_title', `%${debSearch}%`)
      q.then(({ data, count }) => {
        if (cancelled) return
        setSummaries((data ?? []) as ClientSummary[])
        setTotalCount(count ?? 0)
        setLoading(false)
      })
    } else if (activeTab === 'boolean') {
      let q = supabase
        .from('boolean_searches')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (debSearch) q = q.ilike('job_title', `%${debSearch}%`)
      q.then(({ data, count }) => {
        if (cancelled) return
        setBooleans((data ?? []) as BooleanSearch[])
        setTotalCount(count ?? 0)
        setLoading(false)
      })
    } else if (activeTab === 'rankings') {
      let q = supabase
        .from('stack_rankings')
        .select('*, stack_ranking_candidates(id, candidate_name, score, rank)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (debSearch) q = q.ilike('job_title', `%${debSearch}%`)
      q.then(({ data, count }) => {
        if (cancelled) return
        setRankings((data ?? []) as RankingRow[])
        setTotalCount(count ?? 0)
        setLoading(false)
      })
    } else if (activeTab === 'projects') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      let q = db
        .from('projects')
        .select('id,title,client_name,status,created_at,updated_at', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range(from, to)
      if (debSearch) q = q.or(`title.ilike.%${debSearch}%,client_name.ilike.%${debSearch}%`)
      q.then(({ data, count }: { data: ProjectRow[] | null; count: number | null }) => {
        if (cancelled) return
        setProjects(data ?? [])
        setTotalCount(count ?? 0)
        setLoading(false)
      })
    } else {
      // redflags
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      db
        .from('red_flag_checks')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
        .then(({ data, count }: { data: RedFlagCheck[] | null; count: number | null }) => {
          if (cancelled) return
          setRedflags(data ?? [])
          setTotalCount(count ?? 0)
          setLoading(false)
        })
    }

    return () => { cancelled = true }
  }, [activeTab, debSearch, page, supabase])

  // ─── Delete ──────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!deleteId) return
    setDeleting(true)

    // Optimistic removal
    if      (activeTab === 'scores')    setScores(p    => p.filter(r => r.id !== deleteId))
    else if (activeTab === 'summaries') setSummaries(p => p.filter(r => r.id !== deleteId))
    else if (activeTab === 'boolean')   setBooleans(p  => p.filter(r => r.id !== deleteId))
    else if (activeTab === 'rankings')  setRankings(p  => p.filter(r => r.id !== deleteId))
    else                                setRedflags(p  => p.filter(r => r.id !== deleteId))
    setTotalCount(p => p - 1)

    const tableMap: Partial<Record<Tab, string>> = {
      scores:    'resume_scores',
      summaries: 'client_summaries',
      boolean:   'boolean_searches',
      rankings:  'stack_rankings',
      redflags:  'red_flag_checks',
    }

    const tableName = tableMap[activeTab]
    if (!tableName) { setDeleteId(null); setDeleting(false); return }

    const { error } = await supabase.from(tableName).delete().eq('id', deleteId)

    if (error) {
      toast.error('Failed to delete — please try again')
      // Trigger a re-fetch to restore correct state
      setPage(p => p)
    } else {
      toast.success('Record deleted')
    }

    setDeleteId(null)
    setDeleting(false)
  }

  // ─── Render helpers ──────────────────────────────────────

  const totalPages  = Math.ceil(totalCount / PAGE_SIZE)
  const currentData =
    activeTab === 'scores'    ? scores    :
    activeTab === 'summaries' ? summaries :
    activeTab === 'boolean'   ? booleans  :
    activeTab === 'rankings'  ? rankings  :
    activeTab === 'projects'  ? projects  : redflags

  const emptyLabels: Record<Tab, string> = {
    scores:    'resume scores',
    summaries: 'summaries',
    boolean:   'boolean strings',
    rankings:  'stack rankings',
    redflags:  'red flag checks',
    projects:  'projects',
  }

  const thCls = 'text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4'

  // ─── Scores table ─────────────────────────────────────────

  function ScoresTable() {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/6">
              <th className={thCls}>Date</th>
              <th className={thCls}>Job Title</th>
              <th className={thCls}>Score</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {scores.map(row => (
              <React.Fragment key={row.id}>
                <tr
                  className="group cursor-pointer hover:bg-white/3 transition-colors"
                  onClick={() => toggleExpand(row.id)}
                >
                  <td className="py-3 pr-4 text-sm text-slate-400 whitespace-nowrap">
                    {formatRelativeTime(row.created_at)}
                  </td>
                  <td className="py-3 pr-4 text-sm text-slate-200 max-w-[200px] truncate">
                    {row.job_title ?? 'Untitled'}
                  </td>
                  <td className="py-3 pr-4">
                    <ScoreBadge score={row.score} />
                  </td>
                  <td className="py-3">
                    <RowActions
                      id={row.id}
                      expanded={expandedId === row.id}
                      onToggle={() => toggleExpand(row.id)}
                      onDelete={() => setDeleteId(row.id)}
                    />
                  </td>
                </tr>
                {expandedId === row.id && (
                  <tr>
                    <td colSpan={4} className="pb-3">
                      <ExpandPanel>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                            Resume preview
                          </p>
                          <p className="text-sm text-slate-400 line-clamp-3">{row.resume_text}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            Score breakdown
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {Object.entries(row.breakdown_json)
                              .filter(([key]) => key !== 'recommendation')
                              .map(([key, val]) => {
                                const cat = val as { score: number }
                                const label = key === 'catfish_risk' ? 'Red Flag Risk' : key === 'scope_impact' ? 'Scope & Impact' : key.replace(/_/g, ' ')
                                const displayScore = key === 'catfish_risk' ? 100 - cat.score : cat.score
                                return (
                                  <div key={key} className="text-center">
                                    <p className="text-xs text-slate-500 mb-1 capitalize leading-tight">
                                      {label}
                                    </p>
                                    <p
                                      className="text-xl font-bold"
                                      style={{ color: getScoreColor(displayScore) }}
                                    >
                                      {displayScore}
                                    </p>
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      </ExpandPanel>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ─── Summaries table ──────────────────────────────────────

  function SummariesTable() {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/6">
              <th className={thCls}>Date</th>
              <th className={thCls}>Job Title</th>
              <th className={thCls}>Notes preview</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {summaries.map(row => (
              <React.Fragment key={row.id}>
                <tr
                  className="group cursor-pointer hover:bg-white/3 transition-colors"
                  onClick={() => toggleExpand(row.id)}
                >
                  <td className="py-3 pr-4 text-sm text-slate-400 whitespace-nowrap">
                    {formatRelativeTime(row.created_at)}
                  </td>
                  <td className="py-3 pr-4 text-sm text-slate-200 max-w-[140px] truncate">
                    {row.job_title}
                  </td>
                  <td className="py-3 pr-4 text-sm text-slate-500 max-w-[280px] truncate">
                    {row.input_notes.slice(0, 80)}…
                  </td>
                  <td className="py-3">
                    <RowActions
                      id={row.id}
                      expanded={expandedId === row.id}
                      onToggle={() => toggleExpand(row.id)}
                      onDelete={() => setDeleteId(row.id)}
                    />
                  </td>
                </tr>
                {expandedId === row.id && (
                  <tr>
                    <td colSpan={4} className="pb-3">
                      <ExpandPanel>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Generated Summary
                          </p>
                          <CopyButton text={row.summary_output} />
                        </div>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {row.summary_output}
                        </p>
                      </ExpandPanel>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ─── Boolean table ────────────────────────────────────────

  function BooleanTable() {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/6">
              <th className={thCls}>Date</th>
              <th className={thCls}>Job Title</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {booleans.map(row => (
              <React.Fragment key={row.id}>
                <tr
                  className="group cursor-pointer hover:bg-white/3 transition-colors"
                  onClick={() => toggleExpand(row.id)}
                >
                  <td className="py-3 pr-4 text-sm text-slate-400 whitespace-nowrap">
                    {formatRelativeTime(row.created_at)}
                  </td>
                  <td className="py-3 pr-4 text-sm text-slate-200 max-w-[360px] truncate">
                    {row.job_title}
                  </td>
                  <td className="py-3">
                    <RowActions
                      id={row.id}
                      expanded={expandedId === row.id}
                      onToggle={() => toggleExpand(row.id)}
                      onDelete={() => setDeleteId(row.id)}
                    />
                  </td>
                </tr>
                {expandedId === row.id && (
                  <tr>
                    <td colSpan={3} className="pb-3">
                      <ExpandPanel>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                              Boolean String
                            </p>
                            <CopyButton text={row.boolean_output} />
                          </div>
                          <div className="bg-slate-900/60 rounded-lg p-3">
                            <HighlightBoolean str={row.boolean_output} />
                          </div>
                        </div>
                      </ExpandPanel>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ─── Rankings table ───────────────────────────────────────

  function RankingsTable() {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/6">
              <th className={thCls}>Date</th>
              <th className={thCls}>Job Title</th>
              <th className={thCls}>Candidates</th>
              <th className={thCls}>Top Scorer</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {rankings.map(row => {
              const sorted = [...row.stack_ranking_candidates].sort((a, b) => b.score - a.score)
              const top = sorted[0]
              return (
                <React.Fragment key={row.id}>
                  <tr
                    className="group cursor-pointer hover:bg-white/3 transition-colors"
                    onClick={() => toggleExpand(row.id)}
                  >
                    <td className="py-3 pr-4 text-sm text-slate-400 whitespace-nowrap">
                      {formatRelativeTime(row.created_at)}
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-200 max-w-[200px] truncate">
                      {row.job_title ?? 'Untitled'}
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-400">
                      {row.stack_ranking_candidates.length}
                    </td>
                    <td className="py-3 pr-4">
                      {top ? (
                        <span className="flex items-center gap-2 text-sm text-slate-300">
                          <span className="max-w-[120px] truncate">{top.candidate_name}</span>
                          <ScoreBadge score={top.score} />
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <RowActions
                        id={row.id}
                        expanded={expandedId === row.id}
                        onToggle={() => toggleExpand(row.id)}
                        onDelete={() => setDeleteId(row.id)}
                      />
                    </td>
                  </tr>
                  {expandedId === row.id && (
                    <tr>
                      <td colSpan={5} className="pb-3">
                        <ExpandPanel>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Leaderboard
                          </p>
                          <div className="space-y-2">
                            {sorted.map((c, idx) => (
                              <div key={c.id} className="flex items-center gap-3">
                                <span className={cn(
                                  'text-sm font-bold w-6 text-center flex-shrink-0',
                                  idx === 0 ? 'text-amber-400'
                                  : idx === 1 ? 'text-slate-300'
                                  : idx === 2 ? 'text-amber-600'
                                  : 'text-slate-600',
                                )}>
                                  #{idx + 1}
                                </span>
                                <span className="flex-1 text-sm text-slate-200 truncate">
                                  {c.candidate_name}
                                </span>
                                <ScoreBadge score={c.score} />
                              </div>
                            ))}
                          </div>
                        </ExpandPanel>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // ─── Red Flags table ──────────────────────────────────────

  const RECOMMENDATION_BADGE: Record<string, string> = {
    proceed: 'bg-green-500/20 text-green-400 border-green-500/30',
    caution: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    pass:    'bg-red-500/20 text-red-400 border-red-500/30',
  }

  const RECOMMENDATION_LABEL: Record<string, string> = {
    proceed: 'Proceed',
    caution: 'Ask About Flags',
    pass:    'Consider Passing',
  }

  function RedFlagsTable() {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/6">
              <th className={thCls}>Date</th>
              <th className={thCls}>Integrity</th>
              <th className={thCls}>Flags</th>
              <th className={thCls}>Recommendation</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {redflags.map(row => (
              <React.Fragment key={row.id}>
                <tr
                  className="group cursor-pointer hover:bg-white/3 transition-colors"
                  onClick={() => toggleExpand(row.id)}
                >
                  <td className="py-3 pr-4 text-sm text-slate-400 whitespace-nowrap">
                    {formatRelativeTime(row.created_at)}
                  </td>
                  <td className="py-3 pr-4">
                    <ScoreBadge score={row.integrity_score} />
                  </td>
                  <td className="py-3 pr-4 text-sm text-slate-400">
                    {row.flags_json.length} flag{row.flags_json.length !== 1 ? 's' : ''}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full border',
                      RECOMMENDATION_BADGE[row.recommendation] ?? 'bg-white/10 text-slate-400 border-white/10',
                    )}>
                      {RECOMMENDATION_LABEL[row.recommendation] ?? row.recommendation}
                    </span>
                  </td>
                  <td className="py-3">
                    <RowActions
                      id={row.id}
                      expanded={expandedId === row.id}
                      onToggle={() => toggleExpand(row.id)}
                      onDelete={() => setDeleteId(row.id)}
                    />
                  </td>
                </tr>
                {expandedId === row.id && (
                  <tr>
                    <td colSpan={5} className="pb-3">
                      <ExpandPanel>
                        {row.flags_json.length === 0 ? (
                          <p className="text-sm text-slate-400 italic">No flags detected.</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Flags</p>
                            {row.flags_json.map((flag, i) => {
                              const sevCls =
                                flag.severity === 'high'   ? 'text-red-400'    :
                                flag.severity === 'medium' ? 'text-yellow-400' : 'text-green-400'
                              const sevDot =
                                flag.severity === 'high'   ? '🔴' :
                                flag.severity === 'medium' ? '🟡' : '🟢'
                              return (
                                <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-white/4 border border-white/6">
                                  <span className="text-sm leading-5">{sevDot}</span>
                                  <div className="min-w-0">
                                    <p className={cn('text-xs font-semibold mb-0.5', sevCls)}>{flag.type}</p>
                                    <p className="text-xs text-slate-400 leading-relaxed">{flag.evidence}</p>
                                    <p className="text-xs text-slate-500 italic leading-relaxed mt-0.5">{flag.explanation}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {row.summary && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Summary</p>
                            <p className="text-sm text-slate-300 leading-relaxed">{row.summary}</p>
                          </div>
                        )}
                      </ExpandPanel>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ─── Projects grid ────────────────────────────────────────

  function ProjectsGrid() {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {projects.map(project => {
          const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.archived
          return (
            <button
              key={project.id}
              onClick={() => router.push(`/dashboard/projects/${project.id}`)}
              className="text-left p-4 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/14 transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors line-clamp-1">
                  {project.title}
                </p>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0', status.cls)}>
                  {status.label}
                </span>
              </div>
              {project.client_name && (
                <p className="text-xs text-slate-500 mb-2 truncate">{project.client_name}</p>
              )}
              <p className="text-xs text-slate-600">
                Updated {formatRelativeTime(project.updated_at)}
              </p>
            </button>
          )
        })}
      </div>
    )
  }

  // ─── Pagination ───────────────────────────────────────────

  function Pagination() {
    if (totalPages <= 1) return null
    const from = (page - 1) * PAGE_SIZE + 1
    const to   = Math.min(page * PAGE_SIZE, totalCount)
    return (
      <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/6">
        <p className="text-xs text-slate-500">
          Showing {from}–{to} of {totalCount}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm text-slate-400 border border-white/10 hover:border-white/20 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm text-slate-400 border border-white/10 hover:border-white/20 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">History</h1>
        <p className="text-sm text-slate-400 mt-1">All your past AI-generated results</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 glass rounded-xl">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 flex-1 justify-center py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150',
              activeTab === tab.id
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={searchInput}
          onChange={e => handleSearch(e.target.value)}
          placeholder={
            activeTab === 'summaries' ? 'Search by candidate name…' :
            activeTab === 'projects'  ? 'Search by title or client…' :
            'Search by job title…'
          }
          className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
        />
      </div>

      {/* Table card */}
      <div className="glass-card rounded-2xl p-6">
        {loading ? (
          <TableSkeleton />
        ) : currentData.length === 0 ? (
          <EmptyState label={emptyLabels[activeTab]} />
        ) : (
          <>
            {activeTab === 'scores'    && <ScoresTable    />}
            {activeTab === 'summaries' && <SummariesTable />}
            {activeTab === 'boolean'   && <BooleanTable   />}
            {activeTab === 'rankings'  && <RankingsTable  />}
            {activeTab === 'redflags'  && <RedFlagsTable  />}
            {activeTab === 'projects'  && <ProjectsGrid   />}
            <Pagination />
          </>
        )}
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteId && (
          <DeleteDialog
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteId(null)}
            loading={deleting}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
