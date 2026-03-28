'use client'

import { useState, useEffect, useRef } from 'react'
import Script from 'next/script'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Shield, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PLAN_CONFIG, type PaidPlanKey } from '@/lib/square/plans'

// Square Web Payments SDK types (minimal)
declare global {
  interface Window {
    Square?: {
      payments(appId: string, locationId: string): Promise<{
        card(): Promise<{
          attach(selector: string): Promise<void>
          tokenize(): Promise<{ status: string; token?: string; errors?: { message: string }[] }>
          destroy(): void
        }>
      }>
    }
  }
}

interface UpgradeModalProps {
  plan: PaidPlanKey
  onClose: () => void
  onSuccess: () => void
}

export function UpgradeModal({ plan, onClose, onSuccess }: UpgradeModalProps) {
  const planConfig = PLAN_CONFIG[plan]
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [cardReady, setCardReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const cardRef = useRef<Awaited<ReturnType<Awaited<ReturnType<NonNullable<Window['Square']>['payments']>>['card']>> | null>(null)

  useEffect(() => {
    if (sdkLoaded) initCard()
    return () => {
      cardRef.current?.destroy()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkLoaded])

  async function initCard() {
    if (!window.Square) return
    try {
      const payments = await window.Square.payments(
        process.env.NEXT_PUBLIC_SQUARE_APP_ID!,
        process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
      )
      const card = await payments.card()
      await card.attach('#sq-card-container')
      cardRef.current = card
      setCardReady(true)
    } catch (err) {
      console.error('Square card init failed:', err)
      toast.error('Payment form failed to load. Please refresh and try again.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cardRef.current || loading) return

    setLoading(true)
    try {
      const result = await cardRef.current.tokenize()
      if (result.status !== 'OK' || !result.token) {
        const msg = result.errors?.[0]?.message ?? 'Card tokenization failed'
        toast.error(msg)
        setLoading(false)
        return
      }

      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: result.token, plan }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Subscription failed')
        setLoading(false)
        return
      }

      toast.success(`Upgraded to ${planConfig.name}!`)
      onSuccess()
    } catch {
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const squareSrc =
    process.env.NEXT_PUBLIC_SQUARE_ENV === 'production'
      ? 'https://web.squarecdn.com/v1/square.js'
      : 'https://sandbox.web.squarecdn.com/v1/square.js'

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-[#1A1D2E] border border-white/10 rounded-2xl p-6 shadow-2xl"
        >
          <Script
            src={squareSrc}
            onLoad={() => setSdkLoaded(true)}
            onError={() => toast.error('Failed to load payment SDK')}
          />

          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Upgrade to {planConfig.name}
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {planConfig.displayPrice}/month — billed immediately
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/8"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Features */}
          <ul className="mb-5 space-y-1.5">
            {planConfig.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] flex-shrink-0">✓</span>
                {f}
              </li>
            ))}
          </ul>

          {/* Card form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                Card details
              </label>
              {/* Square mounts card form here */}
              <div
                id="sq-card-container"
                className="min-h-[100px] rounded-xl overflow-hidden bg-[#0F1117] border border-white/10 p-1"
              />
              {!cardReady && (
                <div className="flex items-center justify-center gap-2 text-slate-500 text-sm mt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading payment form...
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!cardReady || loading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Subscribe for ${planConfig.displayPrice}/mo`
              )}
            </button>
          </form>

          {/* Trust signal */}
          <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-slate-500">
            <Shield className="w-3.5 h-3.5" />
            Secured by Square · Cancel anytime
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
