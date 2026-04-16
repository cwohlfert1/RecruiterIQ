'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { BooleanSearch, ClientSummary, RedFlagCheck, ResumeScore } from '@/types/database'

import { EmptyState, TableSkeleton } from './atoms'
import { BooleanTable } from './boolean-table'
import { DeleteDialog } from './delete-dialog'
import { PAGE_SIZE, TAB_CONFIG, type ProjectRow, type RankingRow, type Tab } from './constants'
import { Pagination } from './pagination'
import { ProjectsGrid } from './projects-grid'
import { RankingsTable } from './rankings-table'
import { RedFlagsTable } from './redflags-table'
import { ScoresTable } from './scores-table'
import { SummariesTable } from './summaries-table'

export function HistoryClient() {
  const supabase = useMemo(() => createClient(), [])

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

  // Fetch
  useEffect(() => {
    let cancelled = false
    const from = (page - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    setLoading(true)

    if (activeTab === 'scores') {
      let q = supabase.from('resume_scores').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
      if (debSearch) q = q.ilike('job_title', `%${debSearch}%`)
      q.then(({ data, count }) => {
        if (cancelled) return
        setScores((data ?? []) as ResumeScore[])
        setTotalCount(count ?? 0)
        setLoading(false)
      })
    } else if (activeTab === 'summaries') {
      let q = supabase.from('client_summaries').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
      if (debSearch) q = q.ilike('job_title', `%${debSearch}%`)
      q.then(({ data, count }) => {
        if (cancelled) return
        setSummaries((data ?? []) as ClientSummary[])
        setTotalCount(count ?? 0)
        setLoading(false)
      })
    } else if (activeTab === 'boolean') {
      let q = supabase.from('boolean_searches').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
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

  async function handleDeleteConfirm() {
    if (!deleteId) return
    setDeleting(true)

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
      setPage(p => p)
    } else {
      toast.success('Record deleted')
    }

    setDeleteId(null)
    setDeleting(false)
  }

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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">History</h1>
        <p className="text-sm text-slate-400 mt-1">All your past AI-generated results</p>
      </div>

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

      <div className="glass-card rounded-2xl p-6">
        {loading ? (
          <TableSkeleton />
        ) : currentData.length === 0 ? (
          <EmptyState label={emptyLabels[activeTab]} />
        ) : (
          <>
            {activeTab === 'scores'    && <ScoresTable    rows={scores}    expandedId={expandedId} onToggle={toggleExpand} onDelete={setDeleteId} />}
            {activeTab === 'summaries' && <SummariesTable rows={summaries} expandedId={expandedId} onToggle={toggleExpand} onDelete={setDeleteId} />}
            {activeTab === 'boolean'   && <BooleanTable   rows={booleans}  expandedId={expandedId} onToggle={toggleExpand} onDelete={setDeleteId} />}
            {activeTab === 'rankings'  && <RankingsTable  rows={rankings}  expandedId={expandedId} onToggle={toggleExpand} onDelete={setDeleteId} />}
            {activeTab === 'redflags'  && <RedFlagsTable  rows={redflags}  expandedId={expandedId} onToggle={toggleExpand} onDelete={setDeleteId} />}
            {activeTab === 'projects'  && <ProjectsGrid   rows={projects} />}
            <Pagination page={page} totalCount={totalCount} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>

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
