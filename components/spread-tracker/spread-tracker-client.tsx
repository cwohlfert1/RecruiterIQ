'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Plus, Search, Lock, DollarSign, Clock, AlertTriangle, Award, Upload, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PlacementDrawer, type Placement } from './placement-drawer'
import { ImportModal } from './import-modal'

type StatusFilter = 'all' | 'active' | 'locked_up' | 'falling_off'
type SortKey = 'consultant_name' | 'client_company' | 'role' | 'weekly_spread' | 'contract_end_date' | 'status'
type SortDir = 'asc' | 'desc'

interface Watermark {
  high_amount: number
  achieved_at: string | null
}

interface TeamMember {
  user_id: string
  name: string
  email: string
  placements: Placement[]
}

interface SpreadTrackerProps {
  planTier: string
  isAgencyOwner: boolean
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function isExpiringSoon(p: { status: string; contract_end_date: string }): boolean {
  if (p.status !== 'active') return false
  const end = new Date(p.contract_end_date).getTime()
  const now = Date.now()
  return end >= now && end <= now + THIRTY_DAYS_MS
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:      { label: 'Active',      cls: 'bg-green-500/15 text-green-400 border-green-500/25' },
  locked_up:   { label: 'Locked Up',   cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25' },
  falling_off: { label: 'Falling Off', cls: 'bg-red-500/15 text-red-400 border-red-500/25' },
}

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all',         label: 'All'         },
  { key: 'active',      label: 'Active'      },
  { key: 'locked_up',   label: 'Locked Up'   },
  { key: 'falling_off', label: 'Falling Off' },
]

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function CountUp({ target, prefix = '' }: { target: number; prefix?: string }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const dur = 800
    let raf: number
    const tick = () => {
      const p = Math.min((Date.now() - start) / dur, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return <span className="tabular-nums">{prefix}{fmt(val)}</span>
}

export function SpreadTrackerClient({ planTier, isAgencyOwner }: SpreadTrackerProps) {
  const [placements, setPlacements] = useState<Placement[]>([])
  const [watermark, setWatermark]   = useState<Watermark>({ high_amount: 0, achieved_at: null })
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<StatusFilter>('all')
  const [search, setSearch]         = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Placement | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [sortKey, setSortKey]   = useState<SortKey | null>(null)
  const [sortDir, setSortDir]   = useState<SortDir>('asc')

  // Team view (Phase 4)
  const [teamView, setTeamView]       = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)

  const isLocked = planTier === 'free'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/spread-tracker')
      if (res.ok) {
        const data = await res.json()
        setPlacements(data.placements ?? [])
        setWatermark(data.watermark ?? { high_amount: 0, achieved_at: null })
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  const loadTeam = useCallback(async () => {
    setTeamLoading(true)
    try {
      const res = await fetch('/api/spread-tracker/team')
      if (res.ok) {
        const data = await res.json()
        setTeamMembers(data.members ?? [])
      }
    } catch { /* silent */ }
    setTeamLoading(false)
  }, [])

  useEffect(() => {
    if (!isLocked) loadData()
  }, [isLocked, loadData])

  useEffect(() => {
    if (teamView && isAgencyOwner) loadTeam()
  }, [teamView, isAgencyOwner, loadTeam])

  function openAdd() {
    setEditTarget(null)
    setDrawerOpen(true)
  }

  function openEdit(p: Placement) {
    setEditTarget(p)
    setDrawerOpen(true)
  }

  // ── Client color registry (derived from placements) ──
  const clientColorMap: Record<string, string> = {}
  for (const p of placements) {
    const key = p.client_company.toLowerCase()
    if (!clientColorMap[key]) clientColorMap[key] = p.client_color
  }

  // ── Stats ──
  const activeData = teamView
    ? teamMembers.flatMap(m => m.placements)
    : placements

  const totalActive     = activeData.filter(p => p.status === 'active').reduce((s, p) => s + Number(p.weekly_spread), 0)
  const totalLockedUp   = activeData.filter(p => p.status === 'locked_up').reduce((s, p) => s + Number(p.weekly_spread), 0)
  const totalFallingOff = activeData.filter(p => p.status === 'falling_off' || isExpiringSoon(p)).reduce((s, p) => s + Number(p.weekly_spread), 0)
  const athAmount       = Number(watermark.high_amount)
  const athDate         = watermark.achieved_at ? new Date(watermark.achieved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  // ── Filtered data ──
  const displayData = teamView
    ? teamMembers.flatMap(m => m.placements.map(p => ({ ...p, _recruiter: m.name })))
    : placements.map(p => ({ ...p, _recruiter: undefined as string | undefined }))

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === 'asc') { setSortDir('desc') }
      else { setSortKey(null); setSortDir('asc') } // third click → reset
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = displayData
    .filter(p => {
      if (filter === 'all') return true
      if (filter === 'falling_off') return p.status === 'falling_off' || isExpiringSoon(p)
      return p.status === filter
    })
    .filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return p.consultant_name.toLowerCase().includes(q) || p.client_company.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      // Default sort when no column is active
      if (!sortKey) return Number(b.weekly_spread) - Number(a.weekly_spread)

      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'weekly_spread') {
        return (Number(a.weekly_spread) - Number(b.weekly_spread)) * dir
      }
      if (sortKey === 'contract_end_date') {
        return (new Date(a.contract_end_date).getTime() - new Date(b.contract_end_date).getTime()) * dir
      }
      // String columns
      const av = (a[sortKey] ?? '').toLowerCase()
      const bv = (b[sortKey] ?? '').toLowerCase()
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0
    })

  // ── Locked state ──
  if (isLocked) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader />
        <div className="relative mt-6">
          <div className="glass-card rounded-2xl p-12 text-center opacity-40 blur-[2px] pointer-events-none select-none">
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 rounded-xl bg-white/5" />
              ))}
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 rounded-lg bg-white/5 mb-2" />
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Lock className="w-8 h-8 text-slate-500 mb-3" />
            <p className="text-sm font-semibold text-white mb-1">Spread Tracker is available on Pro and Agency plans</p>
            <p className="text-xs text-slate-500 mb-4">Upgrade to start tracking your contractor spread</p>
            <a href="/dashboard/settings/billing" className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 transition-all">
              Upgrade Plan
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <PageHeader />
        <div className="flex items-center gap-3">
          {isAgencyOwner && (
            <div className="flex gap-1 p-1 glass rounded-xl">
              <button
                onClick={() => setTeamView(false)}
                className={cn(
                  'py-1.5 px-3 rounded-lg text-xs font-medium transition-all',
                  !teamView ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200',
                )}
              >
                My Spread
              </button>
              <button
                onClick={() => setTeamView(true)}
                className={cn(
                  'py-1.5 px-3 rounded-lg text-xs font-medium transition-all',
                  teamView ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200',
                )}
              >
                Team Spread
              </button>
            </div>
          )}
          {!teamView && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-sm font-medium text-slate-300 border border-white/12 hover:border-white/24 hover:text-white transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                Import CSV
              </button>
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Placement
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Weekly Spread" value={totalActive} icon={DollarSign} accent="text-green-400" accentBg="bg-green-500/10" />
        <StatCard label="Locked Up"          value={totalLockedUp} icon={Lock} accent="text-indigo-300" accentBg="bg-indigo-500/10" />
        <StatCard label="Spread Falling Off" value={totalFallingOff} icon={AlertTriangle} accent="text-red-400" accentBg="bg-red-500/10" />
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Award className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">All Time High</span>
          </div>
          <p className="text-xl font-bold text-amber-400">
            <CountUp target={athAmount} prefix="$" />
          </p>
          {athDate && <p className="text-[10px] text-slate-600 mt-0.5">since {athDate}</p>}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 p-1 glass rounded-xl">
          {STATUS_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'py-1.5 px-3 rounded-lg text-xs font-medium transition-all',
                filter === key
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search consultant or company…"
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Table */}
      {loading || teamLoading ? (
        <div className="glass-card rounded-2xl p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 && placements.length === 0 && !teamView ? (
        /* Empty state */
        <div className="glass-card rounded-2xl p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <TrendingUp className="w-7 h-7 text-slate-500" />
          </div>
          <p className="text-sm font-semibold text-white mb-1">No placements yet</p>
          <p className="text-xs text-slate-500 mb-5">Add your first placement to start tracking your spread</p>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Placement
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <p className="text-sm text-slate-400">No placements match your filters</p>
          <button onClick={() => { setFilter('all'); setSearch('') }} className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 transition-colors">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="w-1" />
                  {teamView && <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Recruiter</th>}
                  <SortTh k="consultant_name"   label="Consultant"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh k="client_company"     label="Company"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh k="role"               label="Role"          sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh k="weekly_spread"      label="Weekly Spread" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                  <SortTh k="contract_end_date"  label="Contract End"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh k="status"             label="Status"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    onClick={() => {
                      if (teamView) {
                        setEditTarget(p)
                        setDrawerOpen(true)
                      } else {
                        openEdit(p)
                      }
                    }}
                    className="border-b border-white/5 hover:bg-white/3 cursor-pointer transition-colors"
                  >
                    <td className="w-1 p-0">
                      <div className="w-1 h-full min-h-[52px]" style={{ backgroundColor: p.client_color }} />
                    </td>
                    {teamView && (
                      <td className="px-4 py-4 text-slate-300 text-xs">{p._recruiter}</td>
                    )}
                    <td className="px-4 py-4 text-white font-medium">{p.consultant_name}</td>
                    <td className="px-4 py-4 text-slate-300">{p.client_company}</td>
                    <td className="px-4 py-4 text-slate-400">{p.role}</td>
                    <td className="px-4 py-4 text-right font-semibold text-white tabular-nums">
                      ${fmt(Number(p.weekly_spread))}
                    </td>
                    <td className="px-4 py-4 text-slate-400 tabular-nums text-xs">
                      <span className="inline-flex items-center gap-1">
                        {new Date(p.contract_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {isExpiringSoon(p) && (
                          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', STATUS_BADGE[p.status]?.cls)}>
                        {STATUS_BADGE[p.status]?.label}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PlacementDrawer
        open={drawerOpen}
        placement={editTarget}
        readOnly={teamView}
        onClose={() => setDrawerOpen(false)}
        onSaved={loadData}
        clientColorMap={clientColorMap}
        clientNames={Array.from(new Set(placements.map(p => p.client_company)))}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadData}
        clientColorMap={clientColorMap}
      />
    </div>
  )
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold gradient-text">Spread Tracker</h1>
      <p className="text-slate-400 text-sm mt-0.5">Track your contractor placements and weekly margin</p>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, accent, accentBg }: {
  label: string; value: number; icon: typeof DollarSign; accent: string; accentBg: string
}) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', accentBg)}>
          <Icon className={cn('w-3.5 h-3.5', accent)} />
        </div>
        <span className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className={cn('text-xl font-bold', accent)}>
        <CountUp target={value} prefix="$" />
      </p>
    </div>
  )
}

function SortTh({ k, label, sortKey, sortDir, onSort, align }: {
  k: SortKey; label: string; sortKey: SortKey | null; sortDir: SortDir; onSort: (k: SortKey) => void; align?: 'right'
}) {
  const active = sortKey === k
  return (
    <th
      onClick={() => onSort(k)}
      className={cn(
        'px-4 py-3 text-xs font-medium uppercase tracking-wide cursor-pointer select-none transition-colors group',
        align === 'right' ? 'text-right' : 'text-left',
        active ? 'text-slate-200' : 'text-slate-500',
        'hover:bg-white/3',
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === 'asc'
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
        )}
      </span>
    </th>
  )
}
