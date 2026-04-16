'use client'

import { useState } from 'react'
import NumberFlow from '@number-flow/react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Reveal } from './reveal'

const PLANS = [
  {
    name:         'Free',
    priceMonthly: 0,
    priceAnnual:  0,
    desc:         'Try it out. No credit card required.',
    features: [
      '25 AI calls per month',
      'Resume Scorer',
      'Client Summary Generator',
      'Boolean String Generator',
    ],
    cta:        'Start Free',
    href:       '/signup',
    highlight:  false,
    badge:      null,
    enterprise: false,
  },
  {
    name:         'Pro',
    priceMonthly: 49,
    priceAnnual:  39,
    desc:         'For solo recruiters who want full access.',
    features: [
      'Unlimited AI calls',
      'Resume Scorer',
      'Client Summary Generator',
      'Boolean String Generator',
      'Projects (up to 10 active)',
      'Full history with search',
    ],
    cta:        'Start Pro',
    href:       '/signup',
    highlight:  true,
    badge:      'Most Popular',
    enterprise: false,
  },
  {
    name:         'Agency',
    priceMonthly: 149,
    priceAnnual:  119,
    desc:         'For small teams filling multiple roles.',
    features: [
      'Everything in Pro',
      'Stack Ranking (CQI Leaderboard)',
      'Projects (unlimited)',
      'Skill Assessments',
      'Internal Submittal write-ups',
      '5 team seats',
      'CSV export',
      'Team usage dashboard',
    ],
    cta:        'Start Agency',
    href:       '/signup',
    highlight:  false,
    badge:      null,
    enterprise: false,
  },
  {
    name:         'Enterprise',
    priceMonthly: null,
    priceAnnual:  null,
    desc:         'For agencies filling roles at scale.',
    features: [
      'Everything in Agency',
      'Unlimited seats',
      'Dedicated onboarding',
      'Custom integrations',
      'Priority support',
      'Invoiced billing available',
    ],
    cta:        'Book a Demo',
    href:       'mailto:collin@candidai.app',
    highlight:  false,
    badge:      null,
    enterprise: true,
  },
]

function PricingSwitch({ onSwitch }: { onSwitch: (value: string) => void }) {
  const [selected, setSelected] = useState('0')

  function handleSwitch(value: string) {
    setSelected(value)
    onSwitch(value)
  }

  return (
    <div className="flex justify-center">
      <div className="relative z-10 mx-auto flex w-fit rounded-full bg-white/5 border border-white/10 p-1">
        <button
          onClick={() => handleSwitch('0')}
          className={cn(
            'relative z-10 w-fit h-10 sm:h-12 rounded-full px-4 sm:px-6 py-1 sm:py-2 font-medium text-sm transition-colors',
            selected === '0' ? 'text-white' : 'text-slate-400 hover:text-white',
          )}
        >
          {selected === '0' && (
            <motion.span
              layoutId="pricing-switch"
              className="absolute top-0 left-0 h-full w-full rounded-full border-2 border-indigo-500 bg-gradient-to-t from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-500/25"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative">Monthly</span>
        </button>
        <button
          onClick={() => handleSwitch('1')}
          className={cn(
            'relative z-10 w-fit h-10 sm:h-12 rounded-full px-4 sm:px-6 py-1 sm:py-2 font-medium text-sm transition-colors',
            selected === '1' ? 'text-white' : 'text-slate-400 hover:text-white',
          )}
        >
          {selected === '1' && (
            <motion.span
              layoutId="pricing-switch"
              className="absolute top-0 left-0 h-full w-full rounded-full border-2 border-indigo-500 bg-gradient-to-t from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-500/25"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            Yearly
            <span className="rounded-full bg-green-500/20 text-green-400 px-2 py-0.5 text-[10px] font-semibold border border-green-500/30">
              Save 20%
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false)

  return (
    <section id="pricing" className="py-24 bg-white/1">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white">Pricing</h2>
          <p className="mt-3 text-slate-400">
            Start for free. Upgrade when the ROI is obvious.
          </p>
        </Reveal>

        <Reveal className="mb-10">
          <PricingSwitch onSwitch={v => setIsYearly(Number(v) === 1)} />
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch">
          {PLANS.map((plan, i) => {
            const price = isYearly ? plan.priceAnnual : plan.priceMonthly

            return (
              <Reveal key={plan.name} delay={i * 0.1}>
                {plan.enterprise ? (
                  <div className="rounded-2xl p-px bg-gradient-to-br from-indigo-500/50 via-violet-500/20 to-amber-400/30 h-full shadow-[0_0_32px_0_rgba(99,102,241,0.12)]">
                    <Card className="bg-[#0F1117] border-0 rounded-[15px] h-full">
                      <CardHeader className="text-left">
                        <h3 className="text-2xl font-semibold text-white mb-1">{plan.name}</h3>
                        <p className="text-sm text-slate-400 mb-4">{plan.desc}</p>
                        <div className="flex items-baseline">
                          <span className="text-4xl font-bold text-white">Custom</span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <button
                          onClick={() => window.dispatchEvent(new CustomEvent('openSalesChat'))}
                          className="w-full mb-6 py-3 px-4 rounded-xl text-sm font-semibold border border-white/12 text-slate-300 hover:border-white/24 hover:text-white transition-all"
                        >
                          {plan.cta}
                        </button>
                        <ul className="space-y-2.5">
                          {plan.features.map(f => (
                            <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                              <span className="h-5 w-5 bg-indigo-500/15 border border-indigo-500/30 rounded-full grid place-content-center flex-shrink-0">
                                <Check className="h-3 w-3 text-indigo-400" />
                              </span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card className={cn(
                    'border-white/8 bg-[#12141F] h-full',
                    plan.highlight && 'ring-2 ring-indigo-500 bg-indigo-500/5',
                  )}>
                    <CardHeader className="text-left">
                      <div className="flex justify-between items-start">
                        <h3 className="text-2xl font-semibold text-white mb-1">{plan.name}</h3>
                        {plan.badge && (
                          <span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mb-4">{plan.desc}</p>
                      <div className="flex items-baseline">
                        {price === 0 ? (
                          <span className="text-4xl font-bold text-white">Free</span>
                        ) : (
                          <>
                            <span className="text-4xl font-bold text-white">
                              $<NumberFlow value={price ?? 0} />
                            </span>
                            <span className="text-slate-500 ml-1">/mo</span>
                          </>
                        )}
                      </div>
                      {isYearly && price != null && price > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          ${(price as number) * 12}/yr — billed annually
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <a
                        href={plan.href}
                        className={cn(
                          'block w-full mb-6 py-3 px-4 rounded-xl text-sm font-semibold text-center transition-all',
                          plan.highlight
                            ? 'bg-gradient-to-t from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-500/25 border border-indigo-400 text-white hover:from-indigo-500 hover:to-indigo-400'
                            : 'bg-gradient-to-t from-slate-800 to-slate-700 border border-white/10 text-white hover:from-slate-700 hover:to-slate-600',
                        )}
                      >
                        {plan.cta}
                      </a>
                      <ul className="space-y-2.5">
                        {plan.features.map(f => (
                          <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                            <span className="h-5 w-5 bg-green-500/10 border border-green-500/30 rounded-full grid place-content-center flex-shrink-0">
                              <Check className="h-3 w-3 text-green-400" />
                            </span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
