'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  FileSearch,
  FileText,
  Search,
  Trophy,
  Clock,
  Settings,
  LogOut,
  ClipboardList,
  PlusCircle,
  FolderOpen,
} from 'lucide-react'
import { CandidLogo } from '@/components/candid-logo'
import { createClient } from '@/lib/supabase/client'
import { cn, getPlanLabel } from '@/lib/utils'
import type { UserProfile } from '@/types/database'

const BOTTOM_NAV = [
  { label: 'History',  href: '/dashboard/history',  icon: Clock    },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

const PROJECTS_NAV = [
  { label: 'My Projects',    href: '/dashboard/projects',        icon: FolderOpen  },
  { label: 'Create Project', href: '/dashboard/projects/create', icon: PlusCircle  },
]

const TOOLS_NAV = [
  { label: 'Resume Scorer',     href: '/dashboard/scorer',   icon: FileSearch },
  { label: 'Summary Generator', href: '/dashboard/summary',  icon: FileText   },
  { label: 'Boolean Generator', href: '/dashboard/boolean',  icon: Search     },
  { label: 'Stack Ranking',     href: '/dashboard/ranking',  icon: Trophy     },
]

const ASSESSMENT_NAV = [
  { label: 'My Assessments',    href: '/dashboard/assessments',        icon: ClipboardList },
  { label: 'Create Assessment', href: '/dashboard/assessments/create', icon: PlusCircle    },
]

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
}

const itemVariants = {
  hidden:  { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

interface SidebarProps {
  profile:   UserProfile
  userEmail: string
}

function SectionDivider({ label }: { label: string }) {
  return (
    <motion.li variants={itemVariants}>
      <div className="flex items-center gap-2 px-3 pt-4 pb-1.5">
        <div className="flex-1 h-px bg-white/8" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">
          {label}
        </span>
        <div className="flex-1 h-px bg-white/8" />
      </div>
    </motion.li>
  )
}

export function Sidebar({ profile, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'local' })
    router.push('/login')
    router.refresh()
  }

  const planBadgeClass = {
    free:   'badge-free',
    pro:    'badge-pro',
    agency: 'badge-agency',
  }[profile.plan_tier]

  const initials  = userEmail.slice(0, 2).toUpperCase()
  const isManager = profile.role === 'manager'

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="flex flex-col w-64 h-full bg-[#1A1D2E] border-r border-white/8 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center px-5 py-5 border-b border-white/8">
        <CandidLogo variant="dark" className="h-8 w-auto" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <motion.ul
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-0.5"
        >
          {/* Home */}
          <motion.li variants={itemVariants}>
            <Link
              href="/dashboard"
              className={cn('nav-item', isActive('/dashboard') && 'nav-active')}
            >
              <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
              <span>Home</span>
            </Link>
          </motion.li>

          {/* ── Projects section ─────────────────────────── */}
          <SectionDivider label="Projects" />

          {PROJECTS_NAV.map(({ label, href, icon: Icon }) => (
            <motion.li key={href} variants={itemVariants}>
              <Link
                href={href}
                className={cn('nav-item', isActive(href) && 'nav-active')}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            </motion.li>
          ))}

          {/* ── Tools section ─────────────────────────────── */}
          <SectionDivider label="Tools" />

          {TOOLS_NAV.map(({ label, href, icon: Icon }) => (
            <motion.li key={href} variants={itemVariants}>
              <Link
                href={href}
                className={cn('nav-item', isActive(href) && 'nav-active')}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
                {href === '/dashboard/ranking' && profile.plan_tier === 'free' && (
                  <span className="ml-auto text-[10px] font-semibold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
                    PRO
                  </span>
                )}
              </Link>
            </motion.li>
          ))}

          {/* ── Assessments section (manager only) ────────── */}
          {isManager && (
            <>
              <SectionDivider label="Assessments" />
              {ASSESSMENT_NAV.map(({ label, href, icon: Icon }) => (
                <motion.li key={href} variants={itemVariants}>
                  <Link
                    href={href}
                    className={cn('nav-item', isActive(href) && 'nav-active')}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{label}</span>
                  </Link>
                </motion.li>
              ))}
            </>
          )}

          {/* ── Bottom nav ────────────────────────────────── */}
          <motion.li variants={itemVariants}>
            <div className="h-px bg-white/8 mx-3 my-3" />
          </motion.li>

          {BOTTOM_NAV.map(({ label, href, icon: Icon }) => (
            <motion.li key={href} variants={itemVariants}>
              <Link
                href={href}
                className={cn('nav-item', isActive(href) && 'nav-active')}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-white/8 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/4">
          <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{userEmail}</p>
            <span className={cn(
              'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full border mt-0.5',
              planBadgeClass
            )}>
              {getPlanLabel(profile.plan_tier)}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="nav-item w-full text-slate-500 hover:text-red-400 hover:bg-red-500/8"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
