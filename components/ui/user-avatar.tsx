'use client'

import { useState, useEffect, useRef } from 'react'
import { Linkedin } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Module-level cache (survives re-renders, cleared on page navigation) ────

interface CachedProfile {
  avatar_url:   string | null
  display_name: string | null
  job_title:    string | null
}

const profileCache = new Map<string, CachedProfile>()
const pendingFetches = new Map<string, Promise<void>>()

async function fetchProfiles(userIds: string[]): Promise<void> {
  const uncached = userIds.filter(id => !profileCache.has(id))
  if (uncached.length === 0) return
  try {
    const res  = await fetch(`/api/user-profiles?ids=${uncached.join(',')}`)
    const data = await res.json() as Record<string, CachedProfile>
    for (const [id, profile] of Object.entries(data)) {
      profileCache.set(id, profile)
    }
    // Mark missing as "fetched with no data" to avoid re-fetching
    for (const id of uncached) {
      if (!profileCache.has(id)) {
        profileCache.set(id, { avatar_url: null, display_name: null, job_title: null })
      }
    }
  } catch {
    // On error, mark as null so we don't retry in this session
    for (const id of uncached) {
      if (!profileCache.has(id)) {
        profileCache.set(id, { avatar_url: null, display_name: null, job_title: null })
      }
    }
  }
}

// ── Color palette for initials fallback ─────────────────────────────────────

const PALETTE = [
  'bg-indigo-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-cyan-500',   'bg-rose-500',   'bg-amber-500',
  'bg-blue-500',   'bg-fuchsia-500',
]

function getColor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserAvatarProps {
  userId:       string
  /** Pre-fetched avatar URL — skips network fetch if provided */
  avatarUrl?:   string | null
  /** Pre-fetched display name — used for initials + tooltip */
  displayName?: string | null
  /** User email — used for initials fallback */
  email?:       string | null
  /** Pre-fetched job title — shown in tooltip */
  jobTitle?:    string | null
  /** Pre-fetched LinkedIn URL — shown in tooltip */
  linkedinUrl?: string | null
  size?:        number   // pixels, default 32
  showTooltip?: boolean  // default false
  className?:   string
}

// ── Component ────────────────────────────────────────────────────────────────

export function UserAvatar({
  userId,
  avatarUrl:   propAvatarUrl,
  displayName: propDisplayName,
  email,
  jobTitle:    propJobTitle,
  linkedinUrl: propLinkedinUrl,
  size = 32,
  showTooltip = false,
  className,
}: UserAvatarProps) {
  // Start with pre-fetched props so there's no flash on first render
  const [cachedProfile, setCachedProfile] = useState<CachedProfile | null>(
    propAvatarUrl !== undefined || propDisplayName !== undefined
      ? { avatar_url: propAvatarUrl ?? null, display_name: propDisplayName ?? null, job_title: propJobTitle ?? null }
      : profileCache.get(userId) ?? null,
  )
  const [imgError,     setImgError]     = useState(false)
  const [tooltipOpen,  setTooltipOpen]  = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)

  // Fetch from API if we don't have pre-fetched data
  useEffect(() => {
    if (propAvatarUrl !== undefined || propDisplayName !== undefined) return  // pre-fetched
    if (profileCache.has(userId)) {
      setCachedProfile(profileCache.get(userId)!)
      return
    }

    // Deduplicate in-flight fetches for same userId
    const existing = pendingFetches.get(userId)
    const p = existing ?? fetchProfiles([userId])
    if (!existing) pendingFetches.set(userId, p)

    p.then(() => {
      const cached = profileCache.get(userId) ?? null
      setCachedProfile(cached)
      pendingFetches.delete(userId)
    })
  }, [userId, propAvatarUrl, propDisplayName])

  const avatarUrl   = cachedProfile?.avatar_url   ?? propAvatarUrl   ?? null
  const displayName = cachedProfile?.display_name ?? propDisplayName ?? null
  const jobTitle    = cachedProfile?.job_title    ?? propJobTitle    ?? null

  const initials  = getInitials(displayName, email ?? null)
  const colorClass = getColor(userId)
  const showPhoto  = !!avatarUrl && !imgError
  const fontSize   = Math.max(9, Math.round(size * 0.35))

  function handleMouseEnter() {
    if (!showTooltip) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setTooltipOpen(true), 300)
  }
  function handleMouseLeave() {
    if (!showTooltip) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setTooltipOpen(false), 150)
  }

  return (
    <div
      ref={wrapRef}
      className={cn('relative inline-flex flex-shrink-0', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Avatar circle */}
      <div
        className={cn(
          'rounded-full flex items-center justify-center overflow-hidden flex-shrink-0',
          !showPhoto && colorClass,
        )}
        style={{ width: size, height: size }}
      >
        {showPhoto ? (
          <img
            src={avatarUrl!}
            alt={displayName ?? email ?? 'User'}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span
            className="font-semibold text-white leading-none select-none"
            style={{ fontSize }}
          >
            {initials}
          </span>
        )}
      </div>

      {/* Hover tooltip */}
      {showTooltip && tooltipOpen && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-[9999] w-52 bg-[#1A1D2E] border border-white/12 rounded-xl shadow-2xl p-3 pointer-events-none"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center gap-2.5">
            {/* Mini avatar */}
            <div
              className={cn(
                'rounded-full flex items-center justify-center overflow-hidden flex-shrink-0',
                !showPhoto && colorClass,
              )}
              style={{ width: 40, height: 40 }}
            >
              {showPhoto ? (
                <img src={avatarUrl!} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-semibold text-white text-sm">{initials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {displayName ?? email?.split('@')[0] ?? 'Team member'}
              </p>
              {jobTitle && (
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{jobTitle}</p>
              )}
              {email && (
                <p className="text-[10px] text-slate-500 truncate mt-0.5">{email}</p>
              )}
            </div>
          </div>
          {propLinkedinUrl && (
            <a
              href={propLinkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto mt-2 flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
            >
              <Linkedin className="w-3 h-3" />
              LinkedIn
            </a>
          )}
          {/* Tooltip arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-[#1A1D2E] border-r border-b border-white/12 rotate-45" />
        </div>
      )}
    </div>
  )
}
