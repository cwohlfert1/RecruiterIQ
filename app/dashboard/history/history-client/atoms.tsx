'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronDown, ChevronUp, Clock, Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 80
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : score >= 60
    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30'
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', cls)}>
      {score}
    </span>
  )
}

export function HighlightBoolean({ str }: { str: string }) {
  const parts = str.split(/(\bAND\b|\bOR\b|\bNOT\b|"[^"]*"|\(|\))/)
  return (
    <code className="font-mono text-sm break-all leading-relaxed">
      {parts.map((part, i) => {
        if (/^(AND|OR|NOT)$/.test(part))
          return <span key={i} className="text-indigo-400 font-bold">{part}</span>
        if (part.startsWith('"'))
          return <span key={i} className="text-emerald-400">{part}</span>
        if (part === '(' || part === ')')
          return <span key={i} className="text-slate-400">{part}</span>
        return <span key={i} className="text-slate-300">{part}</span>
      })}
    </code>
  )
}

export function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-xl bg-white/4 animate-pulse"
          style={{ animationDelay: `${i * 0.07}s` }}
        />
      ))}
    </div>
  )
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-4">
        <Clock className="w-6 h-6 text-slate-500" />
      </div>
      <p className="text-sm font-medium text-slate-400">No {label} yet</p>
      <p className="text-xs text-slate-600 mt-1">
        Your history will appear here after you use this feature
      </p>
    </div>
  )
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors',
        copied
          ? 'border-green-500/30 text-green-400 bg-green-500/10'
          : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 bg-white/4',
      )}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function RowActions({
  expanded, onDelete,
}: { expanded: boolean; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      {expanded
        ? <ChevronUp  className="w-4 h-4 text-slate-400 flex-shrink-0" />
        : <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-400 flex-shrink-0" />
      }
    </div>
  )
}

export function ExpandPanel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="bg-white/3 rounded-xl p-4 mt-1 space-y-3"
    >
      {children}
    </motion.div>
  )
}
