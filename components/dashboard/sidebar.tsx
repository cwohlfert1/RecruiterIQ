'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Image from 'next/image'
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
  BookOpen,
  AlertOctagon,
  TrendingUp,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { CandidLogo } from '@/components/candid-logo'
import { UserAvatar } from '@/components/ui/user-avatar'
import { PulseHint } from '@/components/ui/pulse-hint'
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
  { label: 'My Assessments',    href: '/dashboard/assessments',         icon: ClipboardList },
  { label: 'Create Assessment', href: '/dashboard/assessments/create',  icon: PlusCircle    },
  { label: 'Template Library',  href: '/dashboard/assessments/library', icon: BookOpen      },
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
  profile:          UserProfile
  userEmail:        string
  collapsed?:       boolean
  onToggleCollapse?: () => void
}

function SectionDivider({ label, collapsed }: { label: string; collapsed?: boolean }) {
  return (
    <motion.li variants={itemVariants}>
      <div className="flex items-center gap-2 px-3 pt-4 pb-1.5">
        {collapsed ? (
          <div className="w-full h-px bg-white/8" />
        ) : (
          <>
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">
              {label}
            </span>
            <div className="flex-1 h-px bg-white/8" />
          </>
        )}
      </div>
    </motion.li>
  )
}

export function Sidebar({ profile, userEmail, collapsed = false, onToggleCollapse }: SidebarProps) {
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

  const wlDomains = (process.env.NEXT_PUBLIC_WHITELISTED_DOMAINS ?? '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
  const isBetaUser = wlDomains.length > 0 && wlDomains.includes(userEmail.split('@')[1]?.toLowerCase() ?? '')

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className={cn(
      'relative flex flex-col h-full bg-[#1A1D2E] border-r border-white/8 flex-shrink-0 transition-all duration-200',
      collapsed ? 'w-[72px]' : 'w-64'
    )}>
      {/* Logo + collapse toggle */}
      <div className={cn(
        'flex items-center border-b border-white/8',
        collapsed ? 'justify-center px-2 py-5' : 'justify-between px-5 py-5'
      )}>
        {collapsed ? (
          <CandidLogo variant="icon" className="h-8 w-8" />
        ) : (
          <>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(profile as any).agency_logo_url ? (
              <div className="flex flex-col gap-0.5">
                <Image
                  src={(profile as any).agency_logo_url as string}
                  alt={(profile as any).agency_name ?? 'Agency logo'}
                  width={120}
                  height={36}
                  className="object-contain max-h-9 w-auto"
                  unoptimized
                />
                <span className="text-[10px] text-slate-600 leading-none">Powered by Candid.ai</span>
              </div>
            ) : (
              <CandidLogo variant="dark" className="h-10 w-auto" />
            )}
          </>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              'p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors duration-150',
              collapsed && 'absolute top-4 right-1.5'
            )}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <ChevronsRight className="w-4 h-4" />
              : <ChevronsLeft className="w-4 h-4" />
            }
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className={cn('flex-1 py-4 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}>
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
              title={collapsed ? 'Home' : undefined}
              className={cn(
                'nav-item',
                collapsed && 'justify-center px-0 py-2.5',
                isActive('/dashboard') && 'nav-active',
              )}
            >
              <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>Home</span>}
            </Link>
          </motion.li>

          {/* ── Projects section ─────────────────────────── */}
          <SectionDivider label="Projects" collapsed={collapsed} />

          {PROJECTS_NAV.map(({ label, href, icon: Icon }) => (
            <motion.li key={href} variants={itemVariants}>
              <PulseHint
                featureKey={href === '/dashboard/projects/create' ? 'project_create' : ''}
                aiCallsUsed={profile.ai_calls_this_month}
              >
                <Link
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'nav-item',
                    collapsed && 'justify-center px-0 py-2.5',
                    isActive(href) && 'nav-active',
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </Link>
              </PulseHint>
            </motion.li>
          ))}

          {/* ── Tools section ─────────────────────────────── */}
          <SectionDivider label="Tools" collapsed={collapsed} />

          {TOOLS_NAV.map(({ label, href, icon: Icon }) => {
            const hintKey = href === '/dashboard/scorer' ? 'resume_scorer'
              : href === '/dashboard/boolean' ? 'boolean_generator'
              : ''
            return (
              <motion.li key={href} variants={itemVariants}>
                <PulseHint featureKey={hintKey} aiCallsUsed={profile.ai_calls_this_month}>
                  <Link
                    href={href}
                    title={collapsed ? label : undefined}
                    className={cn(
                      'nav-item',
                      collapsed && 'justify-center px-0 py-2.5',
                      isActive(href) && 'nav-active',
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span>{label}</span>
                        {href === '/dashboard/ranking' && profile.plan_tier === 'free' && (
                          <span className="ml-auto text-[10px] font-semibold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
                            PRO
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                </PulseHint>
              </motion.li>
            )
          })}

          {/* Flagged Candidates */}
          <motion.li variants={itemVariants}>
            <Link
              href="/dashboard/flagged"
              title={collapsed ? 'Flagged Candidates' : undefined}
              className={cn(
                'nav-item',
                collapsed && 'justify-center px-0 py-2.5',
                isActive('/dashboard/flagged') && 'nav-active',
              )}
            >
              <AlertOctagon className="w-4 h-4 flex-shrink-0 text-rose-400" />
              {!collapsed && <span>Flagged Candidates</span>}
            </Link>
          </motion.li>

          {/* Spread Tracker */}
          <motion.li variants={itemVariants}>
            <Link
              href="/dashboard/spread-tracker"
              title={collapsed ? 'Spread Tracker' : undefined}
              className={cn(
                'nav-item',
                collapsed && 'justify-center px-0 py-2.5',
                isActive('/dashboard/spread-tracker') && 'nav-active',
              )}
            >
              <TrendingUp className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>Spread Tracker</span>}
            </Link>
          </motion.li>

          {/* ── Assessments section (manager only) ────────── */}
          {isManager && (
            <>
              <SectionDivider label="Assessments" collapsed={collapsed} />
              {ASSESSMENT_NAV.map(({ label, href, icon: Icon }) => (
                <motion.li key={href} variants={itemVariants}>
                  <Link
                    href={href}
                    title={collapsed ? label : undefined}
                    className={cn(
                      'nav-item',
                      collapsed && 'justify-center px-0 py-2.5',
                      isActive(href) && 'nav-active',
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span>{label}</span>}
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
                title={collapsed ? label : undefined}
                className={cn(
                  'nav-item',
                  collapsed && 'justify-center px-0 py-2.5',
                  isActive(href) && 'nav-active',
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      </nav>

      {/* User section */}
      <div className={cn('py-4 border-t border-white/8 space-y-1', collapsed ? 'px-2' : 'px-3')}>
        {collapsed ? (
          <Link
            href="/dashboard/settings/profile"
            title="Profile settings"
            className="flex items-center justify-center py-2.5 rounded-xl bg-white/4 hover:bg-white/6 transition-colors"
          >
            <UserAvatar
              userId={profile.user_id}
              avatarUrl={(profile as UserProfile & { avatar_url?: string | null }).avatar_url ?? null}
              displayName={(profile as UserProfile & { display_name?: string | null }).display_name ?? null}
              email={userEmail}
              size={28}
            />
          </Link>
        ) : (
          <Link href="/dashboard/settings/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/4 hover:bg-white/6 transition-colors">
            <UserAvatar
              userId={profile.user_id}
              avatarUrl={(profile as UserProfile & { avatar_url?: string | null }).avatar_url ?? null}
              displayName={(profile as UserProfile & { display_name?: string | null }).display_name ?? null}
              email={userEmail}
              size={32}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {(profile as UserProfile & { display_name?: string | null }).display_name ?? userEmail}
              </p>
              {(profile as UserProfile & { job_title?: string | null }).job_title ? (
                <p className="text-[10px] text-slate-500 truncate">
                  {(profile as UserProfile & { job_title?: string | null }).job_title}
                </p>
              ) : (
                <span className="inline-flex items-center gap-1 mt-0.5">
                  <span className={cn(
                    'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
                    planBadgeClass
                  )}>
                    {getPlanLabel(profile.plan_tier)}
                  </span>
                  {isBetaUser && (
                    <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full border border-emerald-500/25">
                      Beta
                    </span>
                  )}
                </span>
              )}
            </div>
          </Link>
        )}

        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'nav-item w-full text-slate-500 hover:text-red-400 hover:bg-red-500/8',
            collapsed && 'justify-center px-0 py-2.5',
          )}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  )
}
