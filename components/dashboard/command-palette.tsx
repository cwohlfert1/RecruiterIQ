'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import {
  LayoutDashboard,
  FileSearch,
  FileText,
  Search,
  Trophy,
  Clock,
  Settings,
  FolderOpen,
  PlusCircle,
  ClipboardList,
  BookOpen,
  AlertOctagon,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandItem {
  label:   string
  href:    string
  icon:    React.ComponentType<{ className?: string }>
  section: string
}

const COMMANDS: CommandItem[] = [
  { label: 'Home',               href: '/dashboard',                    icon: LayoutDashboard, section: 'Navigate' },
  { label: 'My Projects',        href: '/dashboard/projects',           icon: FolderOpen,      section: 'Projects' },
  { label: 'Create Project',     href: '/dashboard/projects/create',    icon: PlusCircle,      section: 'Projects' },
  { label: 'Resume Scorer',      href: '/dashboard/scorer',             icon: FileSearch,      section: 'Tools' },
  { label: 'Summary Generator',  href: '/dashboard/summary',            icon: FileText,        section: 'Tools' },
  { label: 'Boolean Generator',  href: '/dashboard/boolean',            icon: Search,          section: 'Tools' },
  { label: 'Stack Ranking',      href: '/dashboard/ranking',            icon: Trophy,          section: 'Tools' },
  { label: 'Flagged Candidates', href: '/dashboard/flagged',            icon: AlertOctagon,    section: 'Tools' },
  { label: 'Spread Tracker',     href: '/dashboard/spread-tracker',     icon: TrendingUp,      section: 'Tools' },
  { label: 'My Assessments',     href: '/dashboard/assessments',        icon: ClipboardList,   section: 'Assessments' },
  { label: 'Create Assessment',  href: '/dashboard/assessments/create', icon: PlusCircle,      section: 'Assessments' },
  { label: 'Template Library',   href: '/dashboard/assessments/library',icon: BookOpen,        section: 'Assessments' },
  { label: 'History',            href: '/dashboard/history',            icon: Clock,           section: 'Account' },
  { label: 'Settings',           href: '/dashboard/settings',           icon: Settings,        section: 'Account' },
]

interface CommandPaletteProps {
  open:    boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router    = useRouter()
  const inputRef  = useRef<HTMLInputElement>(null)
  const [query, setQuery]       = useState('')
  const [activeIdx, setActiveIdx] = useState(0)

  // Filter commands by query
  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS
    const q = query.toLowerCase()
    return COMMANDS.filter(
      c => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q)
    )
  }, [query])

  // Group by section
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    for (const item of filtered) {
      const arr = map.get(item.section) ?? []
      arr.push(item)
      map.set(item.section, arr)
    }
    return map
  }, [filtered])

  // Reset on open/query change
  useEffect(() => { setActiveIdx(0) }, [query, open])
  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const navigate = useCallback((href: string) => {
    onClose()
    router.push(href)
  }, [onClose, router])

  // Keyboard nav
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[activeIdx]) {
      e.preventDefault()
      navigate(filtered[activeIdx].href)
    }
  }, [filtered, activeIdx, navigate])

  // Scroll active item into view
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  let flatIdx = -1

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-2xl border border-white/10 bg-[#1A1D2E] shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200"
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search commands..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-72 overflow-y-auto p-2">
            {filtered.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-slate-500">
                No results for &ldquo;{query}&rdquo;
              </p>
            )}

            {Array.from(grouped.entries()).map(([section, items]) => (
              <div key={section}>
                <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {section}
                </p>
                {items.map((item: CommandItem) => {
                  flatIdx++
                  const idx  = flatIdx
                  const Icon = item.icon
                  return (
                    <button
                      key={item.href}
                      data-active={idx === activeIdx}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-100 cursor-pointer',
                        idx === activeIdx
                          ? 'bg-indigo-500/15 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {idx === activeIdx && (
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-4 border-t border-white/8 px-4 py-2.5 text-[11px] text-slate-600">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-white/8 px-1 py-0.5 font-mono text-[10px]">&uarr;&darr;</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-white/8 px-1 py-0.5 font-mono text-[10px]">&crarr;</kbd>
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-white/8 px-1 py-0.5 font-mono text-[10px]">Esc</kbd>
              Close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
