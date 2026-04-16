'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { TopBar } from '@/components/dashboard/top-bar'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { GracePeriodBanner } from '@/components/dashboard/grace-period-banner'
import { ProfileNudge } from '@/components/dashboard/profile-nudge'
import type { UserProfile } from '@/types/database'

const STORAGE_KEY = 'candid-sidebar-collapsed'

interface DashboardShellProps {
  profile:          UserProfile
  userEmail:        string
  showGraceBanner:  boolean
  showProfileNudge: boolean
  children:         React.ReactNode
}

export function DashboardShell({
  profile,
  userEmail,
  showGraceBanner,
  showProfileNudge,
  children,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Persist preference
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') setCollapsed(true)
  }, [])

  function toggleCollapse() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <div className="flex h-screen bg-[#0F1117]">
      {/* Sidebar — desktop only */}
      <div className="hidden md:flex h-full flex-shrink-0">
        <Sidebar
          profile={profile}
          userEmail={userEmail}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar profile={profile} />
        {showGraceBanner && <GracePeriodBanner />}
        <ProfileNudge show={showProfileNudge} />
        <main className="flex-1 p-6 pb-24 md:pb-6 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}
