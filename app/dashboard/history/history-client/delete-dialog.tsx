'use client'

import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

interface Props {
  onConfirm: () => void
  onCancel:  () => void
  loading:   boolean
}

export function DeleteDialog({ onConfirm, onCancel, loading }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card rounded-2xl p-6 w-full max-w-sm relative z-10"
      >
        <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">Delete this record?</h3>
        <p className="text-sm text-slate-400 mb-5">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 border border-white/10 hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 px-4 rounded-xl text-sm font-semibold text-white bg-red-500/80 hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
