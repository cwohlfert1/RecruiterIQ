'use client'

import { useState, useRef, useEffect } from 'react'
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PipelineStage } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────

export interface FilterState {
  stages:      PipelineStage[]
  cqiMin:      number
  cqiMax:      number
  redFlags:    'all' | 'none' | 'has'
  assessment:  'all' | 'not_sent' | 'pending' | 'completed'
  tags:        string[]
  addedBy:     string[]
}

export const DEFAULT_FILTERS: FilterState = {
  stages:     [],
  cqiMin:     0,
  cqiMax:     100,
  redFlags:   'all',
  assessment: 'all',
  tags:       [],
  addedBy:    [],
}

function isDefaultFilter(f: FilterState): boolean {
  return (
    f.stages.length === 0 &&
    f.cqiMin === 0 &&
    f.cqiMax === 100 &&
    f.redFlags === 'all' &&
    f.assessment === 'all' &&
    f.tags.length === 0 &&
    f.addedBy.length === 0
  )
}

const STAGES: Array<{ key: PipelineStage; label: string }> = [
  { key: 'reviewing',          label: 'Reviewing'          },
  { key: 'screened',           label: 'Screened'           },
  { key: 'internal_submittal', label: 'Internal Submittal' },
  { key: 'client_submittal',   label: 'Client Submittal'   },
  { key: 'interviewing',       label: 'Interviewing'       },
  { key: 'placed',             label: 'Placed'             },
  { key: 'rejected',           label: 'Rejected'           },
]

// ─── Multi-select dropdown ────────────────────────────────────

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label:    string
  options:  Array<{ value: string; label: string }>
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter(s => s !== value) : [...selected, value])
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors',
          selected.length > 0
            ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
            : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200 hover:border-white/20',
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="bg-indigo-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-44 bg-[#1A1D2E] border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors"
            >
              <div className={cn(
                'w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0',
                selected.includes(opt.value)
                  ? 'bg-indigo-500 border-indigo-500'
                  : 'border-white/20 bg-transparent'
              )}>
                {selected.includes(opt.value) && (
                  <svg className="w-2 h-2 text-white" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-slate-300">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────

interface Props {
  filters:         FilterState
  onChange:        (f: FilterState) => void
  allTags:         string[]
  memberOptions:   Array<{ value: string; label: string }>
  isAgency:        boolean
}

// ─── Component ───────────────────────────────────────────────

export function CandidateFilters({ filters, onChange, allTags, memberOptions, isAgency }: Props) {
  const active = !isDefaultFilter(filters)

  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span>Filter:</span>
      </div>

      {/* Stage multi-select */}
      <MultiSelect
        label="Stage"
        options={STAGES.map(s => ({ value: s.key, label: s.label }))}
        selected={filters.stages}
        onChange={v => set('stages', v as PipelineStage[])}
      />

      {/* Red Flags */}
      <select
        value={filters.redFlags}
        onChange={e => set('redFlags', e.target.value as FilterState['redFlags'])}
        className={cn(
          'px-3 py-1.5 rounded-xl text-xs font-medium border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/50',
          filters.redFlags !== 'all'
            ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
            : 'border-white/10 bg-white/5 text-slate-400',
        )}
      >
        <option value="all"  className="bg-[#1A1D2E] text-white">Red Flags: All</option>
        <option value="none" className="bg-[#1A1D2E] text-white">No Flags</option>
        <option value="has"  className="bg-[#1A1D2E] text-white">Has Flags</option>
      </select>

      {/* Assessment */}
      <select
        value={filters.assessment}
        onChange={e => set('assessment', e.target.value as FilterState['assessment'])}
        className={cn(
          'px-3 py-1.5 rounded-xl text-xs font-medium border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/50',
          filters.assessment !== 'all'
            ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
            : 'border-white/10 bg-white/5 text-slate-400',
        )}
      >
        <option value="all"       className="bg-[#1A1D2E] text-white">Assessment: All</option>
        <option value="not_sent"  className="bg-[#1A1D2E] text-white">Not Sent</option>
        <option value="pending"   className="bg-[#1A1D2E] text-white">Pending</option>
        <option value="completed" className="bg-[#1A1D2E] text-white">Completed</option>
      </select>

      {/* CQI Range */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">CQI:</span>
        <input
          type="number" min={0} max={filters.cqiMax} value={filters.cqiMin}
          onChange={e => set('cqiMin', Math.max(0, Math.min(Number(e.target.value), filters.cqiMax)))}
          className="w-12 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 text-center focus:outline-none focus:border-indigo-500/40"
        />
        <span className="text-xs text-slate-600">–</span>
        <input
          type="number" min={filters.cqiMin} max={100} value={filters.cqiMax}
          onChange={e => set('cqiMax', Math.min(100, Math.max(Number(e.target.value), filters.cqiMin)))}
          className="w-12 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 text-center focus:outline-none focus:border-indigo-500/40"
        />
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <MultiSelect
          label="Tag"
          options={allTags.map(t => ({ value: t, label: t }))}
          selected={filters.tags}
          onChange={v => set('tags', v)}
        />
      )}

      {/* Added By (Agency only) */}
      {isAgency && memberOptions.length > 0 && (
        <MultiSelect
          label="Added By"
          options={memberOptions}
          selected={filters.addedBy}
          onChange={v => set('addedBy', v)}
        />
      )}

      {/* Clear */}
      {active && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 transition-colors"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}
    </div>
  )
}
