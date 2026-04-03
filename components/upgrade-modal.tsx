'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Lock, Trophy } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface UpgradeModalProps {
  isOpen:        boolean
  onClose:       () => void
  reason:        'limit_reached' | 'plan_required'
  requiredPlan?: 'pro' | 'agency'
}

const PLAN_META = {
  pro: {
    name:     'Pro',
    price:    '$49/month',
    features: ['Unlimited Screenings', 'Resume Scorer', 'Summary Generator', 'Boolean Generator'],
    icon:     <Zap className="w-5 h-5" />,
    color:    'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30',
    badge:    'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
  agency: {
    name:     'Agency',
    price:    '$149/month',
    features: ['Everything in Pro', 'Stack Ranking', 'Team seats (up to 5)', 'CSV export'],
    icon:     <Trophy className="w-5 h-5" />,
    color:    'from-violet-500/20 to-violet-600/10 border-violet-500/30',
    badge:    'bg-violet-500/20 text-violet-300 border-violet-500/30',
  },
}

export function UpgradeModal({ isOpen, onClose, reason, requiredPlan }: UpgradeModalProps) {
  const plan     = PLAN_META[requiredPlan ?? 'pro']
  const isLocked = reason === 'plan_required'

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.95, y: 16  }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="glass-card rounded-2xl p-6 w-full max-w-sm pointer-events-auto">
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Icon */}
              <div className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br border',
                plan.color
              )}>
                <span className={cn('text-sm', requiredPlan === 'agency' ? 'text-violet-300' : 'text-indigo-300')}>
                  {isLocked ? <Lock className="w-5 h-5" /> : plan.icon}
                </span>
              </div>

              <h2 className="text-lg font-semibold text-white mb-1">
                {isLocked
                  ? `${plan.name} plan required`
                  : "You've reached your free limit"}
              </h2>
              <p className="text-sm text-slate-400 mb-5">
                {isLocked
                  ? `This feature is only available on the ${plan.name} plan.`
                  : 'Free plan includes 10 screenings/month. Upgrade to unlock unlimited access.'}
              </p>

              {/* Plan features */}
              <div className={cn('rounded-xl p-4 mb-5 bg-gradient-to-br border', plan.color)}>
                <div className="flex items-center justify-between mb-3">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', plan.badge)}>
                    {plan.name}
                  </span>
                  <span className="text-sm font-semibold text-white">{plan.price}</span>
                </div>
                <ul className="space-y-1.5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="w-1 h-1 rounded-full bg-indigo-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/dashboard/settings#billing"
                onClick={onClose}
                className="block w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white text-center bg-gradient-brand hover-glow transition-all duration-150"
              >
                Upgrade to {plan.name}
              </Link>

              <button
                onClick={onClose}
                className="w-full mt-2 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
