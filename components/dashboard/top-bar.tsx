'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Search, ChevronRight } from 'lucide-react'
import { CortexOrb } from '@/components/cortex/cortex-orb'
import { getPlanLimit } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { UserProfile } from '@/types/database'
import { CortexPanel } from '@/components/cortex/cortex-panel'
import { CommandPalette } from '@/components/dashboard/command-palette'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':                    'Dashboard',
  '/dashboard/scorer':             'Resume Scorer',
  '/dashboard/summary':            'Summary Generator',
  '/dashboard/boolean':            'Boolean Generator',
  '/dashboard/ranking':            'Stack Ranking',
  '/dashboard/history':            'History',
  '/dashboard/projects':           'My Projects',
  '/dashboard/projects/create':    'Create Project',
  '/dashboard/assessments':        'My Assessments',
  '/dashboard/assessments/create': 'Create Assessment',
  '/dashboard/assessments/library':'Template Library',
  '/dashboard/settings':           'Settings',
  '/dashboard/settings/billing':   'Billing & Plan',
  '/dashboard/settings/branding':  'Agency Branding',
  '/dashboard/settings/team':      'Team',
  '/dashboard/settings/profile':   'Profile',
  '/dashboard/flagged':            'Flagged Candidates',
  '/dashboard/spread-tracker':     'Spread Tracker',
}

interface Breadcrumb {
  label: string
  href?: string
}

function buildBreadcrumbs(pathname: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [{ label: 'Dashboard', href: '/dashboard' }]

  if (pathname === '/dashboard') return crumbs

  // Section mapping
  const sectionMap: Record<string, { label: string; href: string }> = {
    'projects':     { label: 'Projects',    href: '/dashboard/projects' },
    'assessments':  { label: 'Assessments', href: '/dashboard/assessments' },
    'settings':     { label: 'Settings',    href: '/dashboard/settings' },
  }

  const segments = pathname.replace('/dashboard/', '').split('/')
  const section = sectionMap[segments[0]]

  if (section && segments.length > 1) {
    crumbs.push({ label: section.label, href: section.href })
  }

  // Final page title
  const title = PAGE_TITLES[pathname]
  if (title && title !== 'Dashboard') {
    crumbs.push({ label: title })
  } else if (!title) {
    // Dynamic route (e.g. /dashboard/projects/[id])
    if (pathname.startsWith('/dashboard/projects/'))    crumbs.push({ label: 'Project' })
    else if (pathname.startsWith('/dashboard/assessments/')) crumbs.push({ label: 'Assessment' })
    else if (pathname.startsWith('/dashboard/settings/'))    crumbs.push({ label: 'Settings' })
    else crumbs.push({ label: 'Page' })
  }

  return crumbs
}

interface TopBarProps {
  profile: UserProfile
}

export function TopBar({ profile }: TopBarProps) {
  const pathname = usePathname()
  const breadcrumbs = buildBreadcrumbs(pathname)
  const limit    = getPlanLimit(profile.plan_tier)
  const used     = profile.ai_calls_this_month
  const pct      = limit ? Math.min((used / limit) * 100, 100) : 0
  const [cortexOpen, setCortexOpen]     = useState(false)
  const [commandOpen, setCommandOpen]   = useState(false)

  // Cmd/Ctrl+J keyboard shortcut for Cortex
  const toggleCortex = useCallback(() => setCortexOpen(v => !v), [])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        toggleCortex()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen(v => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [toggleCortex])

  const meterColor = pct >= 90
    ? 'bg-red-500'
    : pct >= 70
      ? 'bg-yellow-500'
      : 'bg-indigo-500'

  return (
    <>
    <header className="flex items-center justify-between px-6 py-3.5 border-b border-white/8 bg-[#0F1117]/80 backdrop-blur-sm sticky top-0 z-10">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 min-w-0">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1
          return (
            <Fragment key={i}>
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />}
              {isLast ? (
                <span className="text-sm font-semibold text-white truncate">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href!}
                  className="text-sm text-slate-500 hover:text-slate-300 transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </Fragment>
          )
        })}
      </nav>

      <div className="flex items-center gap-3">
        {/* Command palette trigger */}
        <button
          onClick={() => setCommandOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/15 transition-all text-xs cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ml-2">
            Ctrl K
          </kbd>
        </button>

        {/* Cortex AI trigger */}
        <button
          onClick={toggleCortex}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
            cortexOpen
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-[0_0_16px_0_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
          )}
          title="Cortex AI (Cmd+J)"
        >
          <CortexOrb size={18} active={cortexOpen} />
          <span className="hidden lg:inline">Cortex AI</span>
        </button>

      {/* Usage meter — compact pill format */}
      {limit !== null && (
        <div className="hidden md:flex items-center gap-2.5 pl-3 border-l border-white/8">
          <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', meterColor)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
            {used}<span className="text-slate-600">/{limit}</span>
          </span>
        </div>
      )}

      {limit === null && (
        <div className="hidden md:flex items-center gap-2 pl-3 border-l border-white/8">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-slate-500">Unlimited</span>
        </div>
      )}
      </div>
    </header>

    <CortexPanel
      open={cortexOpen}
      onClose={() => setCortexOpen(false)}
      planTier={profile.plan_tier}
    />

    <CommandPalette
      open={commandOpen}
      onClose={() => setCommandOpen(false)}
    />
    </>
  )
}
