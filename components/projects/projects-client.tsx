'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ChevronDown,
  Users,
  FolderOpen,
  PlusCircle,
  TrendingUp,
  Star,
  Building2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import type { ProjectListItem, ProjectStatus } from '@/types/database'

// ─── Types ──────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'shared' | 'archived'
type SortKey   = 'recent' | 'candidates' | 'cqi'

interface ProjectsClientProps {
  projects: ProjectListItem[]
  userId:   string
}

// ─── Constants ──────────────────────────────────────────────

const FILTER_TABS: Array<{ key: FilterTab; label: string }> = [
  { key: 'all',      label: 'All'           },
  { key: 'active',   label: 'Active'        },
  { key: 'shared',   label: 'Shared with Me' },
  { key: 'archived', label: 'Archived'      },
]

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'recent',     label: 'Most Recent'     },
  { key: 'candidates', label: 'Most Candidates' },
  { key: 'cqi',        label: 'Highest CQI'     },
]

const STATUS_BADGE: Record<ProjectStatus, { label: string; className: string }> = {
  active:   { label: 'Active',   className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  on_hold:  { label: 'On Hold',  className: 'bg-yellow-500/15  text-yellow-400  border-yellow-500/20'  },
  filled:   { label: 'Filled',   className: 'bg-blue-500/15    text-blue-400    border-blue-500/20'    },
  archived: { label: 'Archived', className: 'bg-slate-500/15   text-slate-400   border-slate-500/20'   },
}

// ─── CQI Score Badge ─────────────────────────────────────────

function CqiBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-emerald-400' :
    score >= 60 ? 'text-yellow-400'  :
                  'text-red-400'

  return (
    <span className={cn('font-semibold tabular-nums text-sm', color)}>
      {score}
    </span>
  )
}

// ─── Company Logo ─────────────────────────────────────────────

function CompanyLogoSmall({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [imgError, setImgError] = useState(false)

  if (logoUrl && !imgError) {
    return (
      <Image
        src={logoUrl}
        alt={name}
        width={16}
        height={16}
        className="rounded object-contain bg-white shrink-0"
        onError={() => setImgError(true)}
        unoptimized
      />
    )
  }

  return <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
}

// ─── Project Card ─────────────────────────────────────────────

function ProjectCard({ project }: { project: ProjectListItem }) {
  const badge = STATUS_BADGE[project.status as ProjectStatus] ?? STATUS_BADGE.active

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      layout
    >
      <Link
        href={`/dashboard/projects/${project.id}`}
        className="group block glass-card rounded-2xl p-5 cursor-pointer hover:bg-white/5 hover:border-indigo-500/30 hover:shadow-[0_0_16px_rgba(99,102,241,0.12)] transition-all duration-200"
      >
        {/* Top row — title + status */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors leading-snug line-clamp-2">
            {project.title}
          </h3>
          <span className={cn(
            'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap',
            badge.className
          )}>
            {badge.label}
          </span>
        </div>

        {/* Client name + logo */}
        <div className="flex items-center gap-1.5 mb-4">
          <CompanyLogoSmall name={project.client_name} logoUrl={project.company_logo_url} />
          <p className="text-xs text-slate-400 line-clamp-1">{project.client_name}</p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{project.candidate_count} candidate{project.candidate_count !== 1 ? 's' : ''}</span>
          </span>

          {project.top_cqi !== null && (
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5" />
              <span>Top: <CqiBadge score={project.top_cqi} /></span>
            </span>
          )}

          {!project.is_owner && (
            <span className="ml-auto text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">
              Shared
            </span>
          )}
        </div>

        {/* Last activity */}
        <p className="text-[11px] text-slate-600 mt-3">
          {project.last_activity_at
            ? `Activity ${formatDistanceToNow(new Date(project.last_activity_at), { addSuffix: true })}`
            : `Created ${formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}`}
        </p>
      </Link>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────

export function ProjectsClient({ projects, userId }: ProjectsClientProps) {
  const [filter,         setFilter]         = useState<FilterTab>('all')
  const [query,          setQuery]          = useState('')
  const [debouncedQ,     setDebouncedQ]     = useState('')
  const [sort,           setSort]           = useState<SortKey>('recent')
  const [sortOpen,       setSortOpen]       = useState(false)
  const [companyFilter,  setCompanyFilter]  = useState<string>('')  // client_name filter
  const sortRef                             = useRef<HTMLDivElement>(null)
  const debounceRef                         = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Unique client names for company filter
  const uniqueClients = useMemo(() => {
    const names = Array.from(new Set(projects.map(p => p.client_name))).sort()
    return names
  }, [projects])

  // Debounce search query
  const handleSearch = useCallback((value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQ(value), 300)
  }, [])

  // Close sort dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Filter + sort logic
  const filtered = useMemo(() => {
    let list = projects

    // Filter tab
    if (filter === 'active') {
      list = list.filter(p => p.status === 'active' || p.status === 'on_hold')
    } else if (filter === 'shared') {
      list = list.filter(p => !p.is_owner)
    } else if (filter === 'archived') {
      list = list.filter(p => p.status === 'archived' || p.status === 'filled')
    }

    // Company filter
    if (companyFilter) {
      list = list.filter(p => p.client_name === companyFilter)
    }

    // Search
    if (debouncedQ.trim()) {
      const q = debouncedQ.toLowerCase()
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.client_name.toLowerCase().includes(q)
      )
    }

    // Sort
    if (sort === 'recent') {
      list = [...list].sort((a, b) => {
        const aDate = a.last_activity_at ?? a.updated_at
        const bDate = b.last_activity_at ?? b.updated_at
        return new Date(bDate).getTime() - new Date(aDate).getTime()
      })
    } else if (sort === 'candidates') {
      list = [...list].sort((a, b) => b.candidate_count - a.candidate_count)
    } else if (sort === 'cqi') {
      list = [...list].sort((a, b) => (b.top_cqi ?? -1) - (a.top_cqi ?? -1))
    }

    return list
  }, [projects, filter, companyFilter, debouncedQ, sort])

  const currentSortLabel = SORT_OPTIONS.find(o => o.key === sort)?.label ?? 'Most Recent'

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by job title or client…"
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all"
          />
        </div>

        {/* Company filter */}
        {uniqueClients.length > 1 && (
          <div className="relative flex-shrink-0">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <select
              value={companyFilter}
              onChange={e => setCompanyFilter(e.target.value)}
              className={cn(
                'pl-8 pr-8 py-2 rounded-xl bg-white/5 border text-sm appearance-none cursor-pointer transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
                companyFilter
                  ? 'border-indigo-500/40 text-indigo-300'
                  : 'border-white/10 text-slate-300 hover:border-white/20',
              )}
            >
              <option value="">All Companies</option>
              {uniqueClients.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
        )}

        {/* Sort dropdown */}
        <div ref={sortRef} className="relative flex-shrink-0">
          <button
            onClick={() => setSortOpen(o => !o)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-300 hover:text-white hover:border-white/20 transition-colors whitespace-nowrap"
          >
            <TrendingUp className="w-4 h-4 text-slate-500" />
            <span>{currentSortLabel}</span>
            <ChevronDown className={cn('w-3.5 h-3.5 text-slate-500 transition-transform', sortOpen && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {sortOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0,  scale: 1     }}
                exit={{    opacity: 0, y: -4, scale: 0.97  }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-1.5 w-44 bg-[#1A1D2E] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden"
              >
                {SORT_OPTIONS.map(option => (
                  <button
                    key={option.key}
                    onClick={() => { setSort(option.key); setSortOpen(false) }}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-sm transition-colors',
                      sort === option.key
                        ? 'text-indigo-300 bg-indigo-500/10'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="relative flex gap-1 mb-6 border-b border-white/8">
        {FILTER_TABS.map(tab => {
          const count =
            tab.key === 'all'      ? projects.length :
            tab.key === 'active'   ? projects.filter(p => p.status === 'active' || p.status === 'on_hold').length :
            tab.key === 'shared'   ? projects.filter(p => !p.is_owner).length :
                                     projects.filter(p => p.status === 'archived' || p.status === 'filled').length

          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'relative px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                filter === tab.key ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                  filter === tab.key
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'bg-white/6 text-slate-500'
                )}>
                  {count}
                </span>
              )}
              {filter === tab.key && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400 rounded-full"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Grid or empty state */}
      {filtered.length > 0 ? (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/8 flex items-center justify-center mb-4">
            <FolderOpen className="w-6 h-6 text-slate-600" />
          </div>
          <p className="text-sm font-medium text-slate-400 mb-1">
            {debouncedQ ? 'No projects match your search' : 'No projects here yet'}
          </p>
          {!debouncedQ && filter === 'all' && (
            <p className="text-xs text-slate-600 max-w-xs">
              Create your first project to start organising your pipeline.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
