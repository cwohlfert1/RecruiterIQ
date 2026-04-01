'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ProjectStatus } from '@/types/database'

interface Option {
  value: ProjectStatus
  label: string
  className: string
}

const OPTIONS: Option[] = [
  { value: 'active',   label: 'Active',   className: 'text-emerald-400' },
  { value: 'on_hold',  label: 'On Hold',  className: 'text-yellow-400'  },
  { value: 'filled',   label: 'Filled',   className: 'text-blue-400'    },
  { value: 'archived', label: 'Archived', className: 'text-slate-400'   },
]

const BADGE: Record<ProjectStatus, { label: string; badgeClass: string }> = {
  active:   { label: 'Active',   badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  on_hold:  { label: 'On Hold',  badgeClass: 'bg-yellow-500/15  text-yellow-400  border-yellow-500/20'  },
  filled:   { label: 'Filled',   badgeClass: 'bg-blue-500/15    text-blue-400    border-blue-500/20'    },
  archived: { label: 'Archived', badgeClass: 'bg-slate-500/15   text-slate-400   border-slate-500/20'   },
}

interface Props {
  projectId:     string
  currentStatus: ProjectStatus
}

export function ProjectStatusDropdown({ projectId, currentStatus }: Props) {
  const [status,  setStatus]  = useState<ProjectStatus>(currentStatus)
  const [open,    setOpen]    = useState(false)
  const [saving,  setSaving]  = useState(false)
  const ref                   = useRef<HTMLDivElement>(null)
  const router                = useRouter()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function changeStatus(next: ProjectStatus) {
    if (next === status) { setOpen(false); return }
    setOpen(false)
    setSaving(true)

    try {
      const res = await fetch(`/api/projects/${projectId}/update`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: next }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to update status')
        return
      }

      setStatus(next)
      toast.success('Status updated')
      router.refresh()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const current = BADGE[status]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className={cn(
          'flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors',
          current.badgeClass,
          'hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        {saving ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
        )}
        {current.label}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-36 bg-[#1A1D2E] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => changeStatus(opt.value)}
              className={cn(
                'w-full text-left px-4 py-2.5 text-xs font-medium transition-colors hover:bg-white/5',
                opt.value === status ? 'opacity-50 cursor-default' : '',
                opt.className
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
