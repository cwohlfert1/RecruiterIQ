'use client'

import { useState } from 'react'
import { CalendarClock, Trash2, RefreshCw, Clock, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DatePicker } from '@/components/ui/date-picker'
import { toast } from 'sonner'
import type { Placement } from './placement-drawer'

interface Props {
  placements: Placement[]
  onDone: () => void
}

type Step = 'ask' | 'extend' | 'confirm-end'

export function EndDateCheckinModal({ placements, onDone }: Props) {
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

  async function handleEnded() {
    setBusy(true)
    try {
      const res = await fetch(`/api/spread-tracker/${current.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success(`${current.consultant_name} removed from spread`)
      advance()
    } catch {
      toast.error('Failed to remove')
    } finally {
      setBusy(false)
    }
  }

  async function handleExtend() {
    if (!newDate) { toast.error('Select a new end date'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/spread-tracker/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_end_date: newDate, end_date_checked_in: false }),
      })
      if (!res.ok) throw new Error()
      const formatted = new Date(newDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      toast.success(`End date updated to ${formatted}`)
      advance()
    } catch {
      toast.error('Failed to update')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemindLater() {
    setBusy(true)
    try {
      await fetch(`/api/spread-tracker/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ end_date_checked_in: true }),
      })
      advance()
    } catch {
      toast.error('Failed to update')
    } finally {
      setBusy(false)
    }
  }

  const endDate = new Date(current.contract_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#12141F] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <CalendarClock className="w-5 h-5 text-rose-400" />
              <span className="text-sm font-semibold text-white">Contract End Check-in</span>
            </div>
            {placements.length > 1 && (
              <span className="text-[10px] text-slate-500">{index + 1} of {placements.length}</span>
            )}
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">Has {current.consultant_name} ended their contract?</h3>
              <p className="text-xs text-slate-400 mt-1">{current.role} at {current.client_company} — contract end date: {endDate}</p>
            </div>

            <AnimatePresence mode="wait">
              {step === 'ask' && (
                <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                  <button onClick={() => setStep('confirm-end')} disabled={busy} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors">
                    <Trash2 className="w-4 h-4" /> Yes, they ended
                  </button>
                  <button onClick={() => setStep('extend')} disabled={busy} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 transition-colors">
                    <RefreshCw className="w-4 h-4" /> No, they extended
                  </button>
                  <button onClick={handleRemindLater} disabled={busy} className="w-full py-2 text-xs text-slate-400 hover:text-slate-300 transition-colors">
                    <span className="flex items-center justify-center gap-1">{busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />} Still active, remind me later</span>
                  </button>
                </motion.div>
              )}

              {step === 'confirm-end' && (
                <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                    This will permanently remove <strong>{current.consultant_name}</strong> and recalculate your spread.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleEnded} disabled={busy} className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-400 disabled:opacity-50 transition-colors">
                      {busy ? 'Removing...' : 'Confirm Remove'}
                    </button>
                    <button onClick={() => setStep('ask')} className="py-2.5 px-4 rounded-xl text-sm text-slate-400 border border-white/10 hover:bg-white/5 transition-colors">Back</button>
                  </div>
                </motion.div>
              )}

              {step === 'extend' && (
                <motion.div key="extend" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1.5 block">New contract end date</label>
                    <DatePicker value={newDate} onChange={setNewDate} placeholder="Select new end date" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleExtend} disabled={busy || !newDate} className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-50 transition-all">
                      {busy ? 'Updating...' : 'Update End Date'}
                    </button>
                    <button onClick={() => setStep('ask')} className="py-2.5 px-4 rounded-xl text-sm text-slate-400 border border-white/10 hover:bg-white/5 transition-colors">Back</button>
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
