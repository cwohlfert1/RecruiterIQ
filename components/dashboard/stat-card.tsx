'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label:     string
  value:     number
  icon:      React.ReactNode
  color?:    'indigo' | 'violet' | 'green' | 'yellow'
  delay?:    number
}

function useCountUp(target: number, duration = 800, delay = 0) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (target === 0) return

    const timeout = setTimeout(() => {
      const startTime = Date.now()

      const tick = () => {
        const elapsed  = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        setCount(Math.round(eased * target))
        if (progress < 1) requestAnimationFrame(tick)
      }

      requestAnimationFrame(tick)
    }, delay)

    return () => clearTimeout(timeout)
  }, [target, duration, delay])

  return count
}

const colorMap = {
  indigo: { icon: 'bg-indigo-500/15 text-indigo-400', glow: 'hover:shadow-glow-sm' },
  violet: { icon: 'bg-violet-500/15 text-violet-400', glow: 'hover:shadow-[0_0_16px_0_rgba(139,92,246,0.4)]' },
  green:  { icon: 'bg-green-500/15  text-green-400',  glow: 'hover:shadow-[0_0_16px_0_rgba(34,197,94,0.3)]'  },
  yellow: { icon: 'bg-yellow-500/15 text-yellow-400', glow: 'hover:shadow-[0_0_16px_0_rgba(234,179,8,0.3)]'  },
}

export function StatCard({ label, value, icon, color = 'indigo', delay = 0 }: StatCardProps) {
  const displayValue = useCountUp(value, 800, delay)
  const colors = colorMap[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delay / 1000, ease: 'easeOut' }}
      className={cn(
        'glass-card rounded-2xl p-5 transition-all duration-200',
        colors.glow
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-3xl font-semibold text-white tabular-nums">{displayValue}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', colors.icon)}>
          {icon}
        </div>
      </div>
    </motion.div>
  )
}
