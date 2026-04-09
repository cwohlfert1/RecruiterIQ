'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Zap, X } from 'lucide-react'

const STORAGE_KEY = 'candid_upgrade_banner_dismissed'

export function UpgradeBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed) setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="relative flex items-center gap-4 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600/25 to-violet-600/20 border border-indigo-500/25 mb-6">
      <div className="w-8 h-8 rounded-xl bg-indigo-500/25 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
        <Zap className="w-4 h-4 text-indigo-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">
          Upgrade to Pro for unlimited screenings
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Free plan includes 25 screenings/month. Pro starts at $49/month.
        </p>
      </div>
      <Link
        href="/dashboard/settings#billing"
        className="flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-400 transition-colors duration-150"
      >
        Upgrade
      </Link>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors duration-150"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
