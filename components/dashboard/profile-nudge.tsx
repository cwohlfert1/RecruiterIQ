'use client'

import { useState, useEffect } from 'react'
import { UserCircle2, X } from 'lucide-react'
import Link from 'next/link'

const DISMISSED_KEY = 'candid_profile_nudge_dismissed'

interface Props {
  show: boolean  // server-computed: avatar_url is null AND linkedin_id is null
}

export function ProfileNudge({ show }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!show) return
    if (typeof window === 'undefined') return
    if (localStorage.getItem(DISMISSED_KEY)) return
    setVisible(true)
  }, [show])

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 bg-indigo-500/10 border-b border-indigo-500/20">
      <UserCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
      <p className="text-xs text-slate-300 flex-1">
        Complete your profile — connect LinkedIn to add your photo and title
      </p>
      <Link
        href="/dashboard/settings/profile"
        className="text-xs font-semibold text-indigo-400 hover:text-indigo-200 transition-colors shrink-0"
      >
        Set up profile
      </Link>
      <button
        onClick={handleDismiss}
        className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
