'use client'

import { useState } from 'react'
import { X, CheckCircle2, CalendarClock, Trash2, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Placement } from './placement-drawer'

interface CheckinModalProps {
  placements: Placement[]
  onDone: () => void
}

type Step = 'ask' | 'update-date' | 'confirm-remove'

export function CheckinModal({ placements, onDone }: CheckinModalProps) {
  const [index, setIndex] = useState(0)
  const [step, setStep] = useState<Step>('ask')
  const [newDate, setNewDate] = useState('')
  const [busy, setBusy] = useState(false)

  const current = placements[index]
  if (!current) return null

  function advance() {
    setStep('ask')
    setNewDate('')
    if (index + 1 < placements.length) {
      setIndex(i => i + 1)
    } else {
      onDone()
    }
  }

  async function handleStarted() {
    setBusy(true)
    try {
      const res = await fetch(`/api/spread-tracker/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active', has_checked_in: true }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${current.consultant_name} is now active — spread updated!`)
      advance()
    } catch {
      toast.error('Failed to update')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateDate() {
    if (!newDate) { toast.error('Select a new start date'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/spread-tracker/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_start_date: newDate, has_checked_in: false }),
      })
      if (!res.ok) throw new Error()
      const formatted = new Date(newDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      toast.success(`Start date updated to ${formatted}`)
      advance()
    } catch {
      toast.error('Failed to update')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setBusy(true)
    try {
      const res = await fetch(`/api/spread-tracker/${current.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success(`${current.consultant_name} removed — false start logged`)
      advance()
    } catch {
      toast.error('Failed to remove')
    } finally {
      setBusy(false)
    }
  }

  const startDate = current.expected_start_date
    ? new Date(current.expected_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A'

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-[#12141F] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <CalendarClock className="w-5 h-5 text-indigo-400" />
              <span className="text-sm font-semibold text-white">Start Day Check-in</span>
            </div>
            {placements.length > 1 && (
              <span className="text-[10px] text-slate-500">{index + 1} of {placements.length}</span>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                Did {current.consultant_name} start today?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {current.role} at {current.client_company} — expected start: {startDate}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {step === 'ask' && (
                <motion.div
                  key="ask"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <button
                    onClick={handleStarted}
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 transition-colors"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Yes, they started!
                  </button>
                  <button
                    onClick={() => setStep('update-date')}
                    disabled={busy}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-slate-300 border border-white/12 hover:border-white/24 hover:text-white disabled:opacity-50 transition-all"
                  >
                    No, update start date
                  </button>
                  <button
                    onClick={() => setStep('confirm-remove')}
                    disabled={busy}
                    className="w-full py-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    False Start — remove placement
                  </button>
                </motion.div>
              )}

              {step === 'update-date' && (
                <motion.div
                  key="update"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1.5 block">New expected start date</label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateDate}
                      disabled={busy || !newDate}
                      className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-50 transition-all"
                    >
                      {busy ? 'Updating...' : 'Update Start Date'}
                    </button>
                    <button
                      onClick={() => setStep('ask')}
                      className="py-2.5 px-4 rounded-xl text-sm text-slate-400 border border-white/10 hover:bg-white/5 transition-colors"
                    >
                      Back
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 'confirm-remove' && (
                <motion.div
                  key="remove"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                    Are you sure? This will permanently remove <strong>{current.consultant_name}</strong> from your spread tracker.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRemove}
                      disabled={busy}
                      className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-400 disabled:opacity-50 transition-colors"
                    >
                      {busy ? 'Removing...' : 'Yes, remove placement'}
                    </button>
                    <button
                      onClick={() => setStep('ask')}
                      className="py-2.5 px-4 rounded-xl text-sm text-slate-400 border border-white/10 hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </>
  )
}
