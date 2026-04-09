'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface PulseHintProps {
  featureKey: string
  tooltip?: string
  children: React.ReactNode
  className?: string
  /** Only show for users with fewer than this many AI calls */
  maxCalls?: number
  aiCallsUsed?: number
}

/**
 * Wraps any element with a pulsing indigo ring for new users.
 * Disappears permanently once clicked (stored in localStorage).
 */
export function PulseHint({
  featureKey,
  tooltip,
  children,
  className,
  maxCalls = 5,
  aiCallsUsed = 0,
}: PulseHintProps) {
  const [seen, setSeen] = useState(true)
  const [showTooltip, setShowTooltip] = useState(false)

  const storageKey = `candidai_seen_${featureKey}`

  useEffect(() => {
    setSeen(localStorage.getItem(storageKey) === 'true')
  }, [storageKey])

  if (seen || aiCallsUsed >= maxCalls) {
    return <>{children}</>
  }

  function handleClick() {
    localStorage.setItem(storageKey, 'true')
    setSeen(true)
  }

  return (
    <div
      className={cn('relative', className)}
      onClick={handleClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}

      {/* Pulsing ring */}
      <span className="absolute inset-0 rounded-lg pointer-events-none" aria-hidden="true">
        <span className="absolute inset-0 rounded-lg border-2 border-indigo-500/40 animate-[pulse-ring_2s_ease-in-out_infinite]" />
      </span>

      {/* Tooltip */}
      {tooltip && showTooltip && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="bg-[#12141F] border border-indigo-500/20 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
            <p className="text-[11px] text-white font-medium">{tooltip}</p>
          </div>
        </div>
      )}
    </div>
  )
}
