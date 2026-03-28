'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'

export function GracePeriodBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border-b border-red-500/20 text-sm">
      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
      <p className="flex-1 text-red-300">
        Your payment failed — update your billing to avoid losing access.
      </p>
      <Link
        href="/dashboard/settings/billing"
        className="flex-shrink-0 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg transition-colors"
      >
        Update Payment
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-red-400 hover:text-red-200 transition-colors p-0.5"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
