'use client'

import { useState, useEffect, useMemo } from 'react'
import { AlertOctagon, Trash2, Loader2, Search, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type FlagType = 'catfish' | 'dnu' | 'watch'

interface FlagRecord {
  id:                string
  candidate_email:   string
  candidate_name:    string
  flag_type:         FlagType
  reason:            string | null
  flagged_by:        string
  flagged_by_email:  string | null
  source_project_id: string | null
  created_at:        string
}

const FLAG_STYLES: Record<FlagType, { label: string; cls: string }> = {
  catfish: { label: 'Catfish', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/25'     },
  dnu:     { label: 'DNU',    cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
  watch:   { label: 'Watch',  cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
}

type FilterTab = 'all' | FlagType

export default function FlaggedCandidatesPage() {
  const [flags,      setFlags]      = useState<FlagRecord[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<FilterTab>('all')
  const [search,     setSearch]     = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/flagged')
      .then(r => r.json())
      .then(json => { if (json.flags) setFlags(json.flags) })
      .catch(() => toast.error('Failed to load flagged candidates'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let list = flags
    if (filter !== 'all') list = list.filter(f => f.flag_type === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(f =>
        f.candidate_name.toLowerCase().includes(q) ||
        f.candidate_email.toLowerCase().includes(q)
      )
    }
    return list
  }, [flags, filter, search])

  async function handleRemove(id: string) {
    if (!confirm('Remove this flag from the registry?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/flagged?id=${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed to remove flag'); return }
      setFlags(prev => prev.filter(f => f.id !== id))
      toast.success('Flag removed')
    } catch {
      toast.error('Failed to remove flag')
    } finally { setDeletingId(null) }
  }

  const counts: Record<FilterTab, number> = {
    all:     flags.length,
    catfish: flags.filter(f => f.flag_type === 'catfish').length,
    dnu:     flags.filter(f => f.flag_type === 'dnu').length,
    watch:   flags.filter(f => f.flag_type === 'watch').length,
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center">
          <AlertOctagon className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Flagged Candidates</h1>
          <p className="text-xs text-slate-500">Agency-wide DNU registry</p>
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-9 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-white/8">
          {(['all', 'catfish', 'dnu', 'watch'] as FilterTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                'relative px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap capitalize',
                filter === tab ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {tab === 'all' ? 'All' : FLAG_STYLES[tab as FlagType].label}
              {counts[tab] > 0 && (
                <span className={cn(
                  'ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                  filter === tab ? 'bg-rose-500/20 text-rose-300' : 'bg-white/6 text-slate-500'
                )}>
                  {counts[tab]}
                </span>
              )}
              {filter === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-400 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertOctagon className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">
              {search ? 'No matches found' : filter === 'all' ? 'No flagged candidates yet' : `No ${FLAG_STYLES[filter as FlagType].label} flags`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/8">
                  {['Candidate', 'Flag Type', 'Reason', 'Flagged By', 'Added', ''].map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500 pb-3 pt-4 px-4 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(flag => {
                  const style = FLAG_STYLES[flag.flag_type] ?? FLAG_STYLES.watch
                  return (
                    <tr key={flag.id} className="hover:bg-white/2 transition-colors">
                      <td className="py-3.5 px-4 pl-5">
                        <p className="text-sm font-medium text-white">{flag.candidate_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{flag.candidate_email}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', style.cls)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <p className="text-xs text-slate-400 line-clamp-2">{flag.reason ?? '—'}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-xs text-slate-500">
                          {flag.flagged_by_email?.split('@')[0] ?? flag.flagged_by.slice(0, 8)}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-xs text-slate-600 whitespace-nowrap">
                          {formatDistanceToNow(new Date(flag.created_at), { addSuffix: true })}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 pr-5">
                        <button
                          onClick={() => handleRemove(flag.id)}
                          disabled={deletingId === flag.id}
                          className="text-slate-600 hover:text-rose-400 transition-colors disabled:opacity-40"
                          title="Remove flag"
                        >
                          {deletingId === flag.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />
                          }
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
