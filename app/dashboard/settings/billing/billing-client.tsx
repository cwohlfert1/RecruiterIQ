'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  CreditCard,
  CheckCircle2,
  Users,
  Zap,
  BarChart3,
  FileDown,
  Crown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLAN_CONFIG, type PaidPlanKey } from '@/lib/square/plans'
import { UpgradeModal } from '@/components/billing/upgrade-modal'
import { CancelModal } from '@/components/billing/cancel-modal'
import type { UserProfile } from '@/types/database'

const PLAN_LIMIT = { free: 10, pro: null, agency: null }

const PLAN_BADGE: Record<string, string> = {
  free:   'bg-slate-700 text-slate-300',
  pro:    'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  agency: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
}

interface BillingClientProps {
  profile: UserProfile
}

export function BillingClient({ profile: initialProfile }: BillingClientProps) {
  const router = useRouter()
  const [profile, setProfile] = useState(initialProfile)
  const [upgradeTarget, setUpgradeTarget] = useState<PaidPlanKey | null>(null)
  const [showCancel, setShowCancel] = useState(false)

  const callLimit = PLAN_LIMIT[profile.plan_tier]
  const isCancelling = profile.subscription_status === 'cancelling'

  const cancelEndDate = profile.billing_period_end
    ? new Date(profile.billing_period_end).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  function handleUpgradeSuccess() {
    setUpgradeTarget(null)
    router.refresh()
  }

  function handleCancelSuccess(newBillingEnd: string | null) {
    setShowCancel(false)
    setProfile((p) => ({
      ...p,
      subscription_status: 'cancelling',
      billing_period_end: newBillingEnd,
    }))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Billing &amp; Plan</h1>
        <p className="text-slate-400 mt-1 text-sm">Manage your subscription and payment method.</p>
      </div>

      {/* Current plan card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Current Plan</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white font-semibold capitalize">{profile.plan_tier}</span>
                <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', PLAN_BADGE[profile.plan_tier])}>
                  {profile.plan_tier.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Cancel / canceling state */}
          {profile.plan_tier !== 'free' && !isCancelling && (
            <button
              onClick={() => setShowCancel(true)}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              Cancel subscription
            </button>
          )}
          {isCancelling && cancelEndDate && (
            <span className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
              Cancels {cancelEndDate}
            </span>
          )}
        </div>

        {/* AI call usage meter */}
        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-400">AI calls this month</span>
            <span className="text-white font-medium">
              {profile.ai_calls_this_month}
              {callLimit ? ` / ${callLimit}` : ' / Unlimited'}
            </span>
          </div>
          {callLimit ? (
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${Math.min((profile.ai_calls_this_month / callLimit) * 100, 100)}%` }}
              />
            </div>
          ) : (
            <div className="h-1.5 bg-indigo-500/30 rounded-full">
              <div className="h-full w-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />
            </div>
          )}
        </div>

        {profile.plan_tier === 'agency' && (
          <Link
            href="/dashboard/settings/team"
            className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Users className="w-4 h-4" />
            Manage team seats →
          </Link>
        )}
      </motion.div>

      {/* Plan cards — show upgrades available */}
      {profile.plan_tier === 'free' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['pro', 'agency'] as PaidPlanKey[]).map((key, i) => (
            <PlanCard
              key={key}
              planKey={key}
              delay={i * 0.05}
              onUpgrade={() => setUpgradeTarget(key)}
            />
          ))}
        </div>
      )}

      {profile.plan_tier === 'pro' && (
        <div className="max-w-sm">
          <PlanCard planKey="agency" delay={0} onUpgrade={() => setUpgradeTarget('agency')} />
        </div>
      )}

      {/* Modals */}
      {upgradeTarget && (
        <UpgradeModal
          plan={upgradeTarget}
          onClose={() => setUpgradeTarget(null)}
          onSuccess={handleUpgradeSuccess}
        />
      )}
      {showCancel && (
        <CancelModal
          billingPeriodEnd={profile.billing_period_end}
          onClose={() => setShowCancel(false)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </div>
  )
}

// ── Plan card ────────────────────────────────────────────────────────────────

const PLAN_ICONS: Record<PaidPlanKey, React.ElementType> = {
  pro:    Zap,
  agency: Crown,
}

const FEATURE_ICONS: Record<string, React.ElementType> = {
  'Unlimited AI calls': Zap,
  'Stack Ranking': BarChart3,
  'Team management (5 seats)': Users,
  'CSV export': FileDown,
}

function PlanCard({
  planKey,
  delay,
  onUpgrade,
}: {
  planKey: PaidPlanKey
  delay: number
  onUpgrade: () => void
}) {
  const config = PLAN_CONFIG[planKey]
  const Icon = PLAN_ICONS[planKey]
  const isAgency = planKey === 'agency'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        'relative glass-card p-5 flex flex-col gap-4',
        isAgency && 'border-amber-500/30 bg-amber-500/4'
      )}
    >
      {isAgency && (
        <div className="absolute -top-2.5 left-4 text-[10px] font-bold tracking-widest text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase">
          Best Value
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            isAgency ? 'bg-amber-500/15' : 'bg-indigo-500/15'
          )}>
            <Icon className={cn('w-4 h-4', isAgency ? 'text-amber-400' : 'text-indigo-400')} />
          </div>
          <span className="font-semibold text-white">{config.name}</span>
        </div>
        <span className="text-lg font-bold text-white">{config.displayPrice}<span className="text-xs text-slate-400 font-normal">/mo</span></span>
      </div>

      <ul className="space-y-2 flex-1">
        {config.features.map((f) => {
          const FIcon = FEATURE_ICONS[f] ?? CheckCircle2
          return (
            <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
              <FIcon className={cn('w-3.5 h-3.5 flex-shrink-0', isAgency ? 'text-amber-400' : 'text-indigo-400')} />
              {f}
            </li>
          )
        })}
      </ul>

      <button
        onClick={onUpgrade}
        className={cn(
          'w-full py-2.5 rounded-xl text-sm font-semibold transition-colors',
          isAgency
            ? 'bg-amber-500 hover:bg-amber-400 text-black'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
        )}
      >
        Upgrade to {config.name}
      </button>
    </motion.div>
  )
}
