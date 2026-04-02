'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, RefreshCw, Copy, Check, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Boolean string syntax highlighter ───────────────────────

function BooleanHighlight({ text }: { text: string }) {
  const tokens: Array<{ type: string; value: string }> = []
  // Match keywords, parens, quoted strings, or other tokens
  const regex = /\b(AND|OR|NOT)\b|([()])|("(?:[^"\\]|\\.)*")|(\S+|\s+)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match[1])      tokens.push({ type: match[1], value: match[1] })
    else if (match[2]) tokens.push({ type: 'paren',  value: match[2] })
    else if (match[3]) tokens.push({ type: 'quote',  value: match[3] })
    else               tokens.push({ type: 'text',   value: match[4] })
  }

  return (
    <span className="font-mono text-xs leading-relaxed break-all">
      {tokens.map((t, i) => {
        switch (t.type) {
          case 'AND': return <span key={i} className="text-blue-400 font-bold">{t.value}</span>
          case 'OR':  return <span key={i} className="text-green-400 font-bold">{t.value}</span>
          case 'NOT': return <span key={i} className="text-red-400 font-bold">{t.value}</span>
          case 'paren': return <span key={i} className="text-slate-400">{t.value}</span>
          case 'quote': return <span key={i} className="text-yellow-400">{t.value}</span>
          default:    return <span key={i} className="text-slate-200">{t.value}</span>
        }
      })}
    </span>
  )
}

// ─── Copy button ──────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/8"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ─── String card ─────────────────────────────────────────────

function StringCard({ label, logoIcon, string }: { label: string; logoIcon: string; string: string }) {
  return (
    <div className="rounded-xl bg-white/3 border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="text-base">{logoIcon}</span>
          <span className="text-xs font-semibold text-slate-300">{label}</span>
        </div>
        <CopyButton text={string} />
      </div>
      <div className="px-4 py-3 bg-[#0D0F1A]">
        <BooleanHighlight text={string} />
      </div>
    </div>
  )
}

// ─── Types ───────────────────────────────────────────────────

interface BooleanString {
  id:              string
  user_id:         string
  user_email:      string
  linkedin_string: string
  indeed_string:   string
  created_at:      string
}

interface BooleanData {
  myString:   BooleanString | null
  allStrings: BooleanString[]
  hasHistory: boolean
}

interface Props {
  projectId:          string
  hasJd:              boolean
  isOwner:            boolean
  isManager:          boolean
  jdUpdatedThisSession: boolean
}

// ─── Main component ───────────────────────────────────────────

export function BooleanTab({ projectId, hasJd, isOwner, isManager, jdUpdatedThisSession }: Props) {
  const [data,           setData]           = useState<BooleanData | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [generating,     setGenerating]     = useState(false)
  const [confirmRegenAll, setConfirmRegenAll] = useState(false)
  const [confirmRegenMe,  setConfirmRegenMe]  = useState(false)
  const [showHistory,    setShowHistory]    = useState(false)
  const [historyRows,    setHistoryRows]    = useState<BooleanString[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const isManagerOrOwner = isOwner || isManager

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/boolean`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      toast.error('Failed to load Boolean strings')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { loadData() }, [loadData])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res  = await fetch(`/api/projects/${projectId}/boolean/generate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Generation failed'); return }
      toast.success('Boolean strings generated!')
      await loadData()
    } catch {
      toast.error('Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenMe() {
    setConfirmRegenMe(false)
    setGenerating(true)
    try {
      const res  = await fetch(`/api/projects/${projectId}/boolean/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'mine' }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Regeneration failed'); return }
      toast.success('Your string has been regenerated!')
      await loadData()
    } catch {
      toast.error('Regeneration failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenAll() {
    setConfirmRegenAll(false)
    setGenerating(true)
    try {
      const res  = await fetch(`/api/projects/${projectId}/boolean/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'all' }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Regeneration failed'); return }
      toast.success('All strings regenerated!')
      await loadData()
    } catch {
      toast.error('Regeneration failed')
    } finally {
      setGenerating(false)
    }
  }

  async function toggleHistory() {
    if (showHistory) { setShowHistory(false); return }
    setShowHistory(true)
    setHistoryLoading(true)
    try {
      const res  = await fetch(`/api/projects/${projectId}/boolean?history=1`)
      const json = await res.json()
      setHistoryRows(json.archived ?? [])
    } catch { /* ignore */ } finally {
      setHistoryLoading(false)
    }
  }

  // ── States ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
      </div>
    )
  }

  const hasStrings = data && (data.myString !== null || data.allStrings.length > 0)

  // Empty state
  if (!hasStrings) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/8 flex items-center justify-center mb-4">
          <Search className="w-6 h-6 text-slate-600" />
        </div>
        <p className="text-sm font-semibold text-slate-300 mb-1">No Boolean strings yet</p>
        <p className="text-xs text-slate-500 max-w-xs mb-6">
          {hasJd
            ? 'Generate unique search strings for each recruiter on this project'
            : 'Add a job description first to enable Boolean string generation'}
        </p>

        {generating ? (
          <div className="flex items-center gap-2 text-sm text-indigo-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cortex is crafting your search strings
            <span className="animate-pulse">...</span>
          </div>
        ) : (
          <div className="relative group">
            <button
              onClick={hasJd ? handleGenerate : undefined}
              disabled={!hasJd}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
                hasJd
                  ? 'text-white bg-gradient-brand hover-glow'
                  : 'text-slate-500 border border-slate-700 bg-slate-800/50 cursor-not-allowed'
              )}
            >
              <Sparkles className="w-4 h-4" />
              Generate Boolean Variations
            </button>
            {!hasJd && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-xs text-slate-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Add a job description first
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Generating overlay
  if (generating) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-4 py-6 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-3" />
          <p className="text-sm text-indigo-300 font-medium">
            Cortex is crafting your search strings
            <span className="animate-pulse">...</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">This takes 10–30 seconds</p>
        </div>
      </div>
    )
  }

  // ── Strings exist ────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* JD updated banner */}
      {jdUpdatedThisSession && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-xs text-yellow-300">
          <span>Your job description was updated. Regenerate variations to reflect the changes.</span>
          {isManagerOrOwner && (
            <button
              onClick={() => setConfirmRegenAll(true)}
              className="ml-4 text-yellow-400 font-semibold hover:text-yellow-200 transition-colors whitespace-nowrap"
            >
              Regenerate All
            </button>
          )}
        </div>
      )}

      {/* Manager / Owner: all strings table */}
      {isManagerOrOwner && data.allStrings.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">All Team Variations</h3>
            <div className="flex items-center gap-3">
              {data.hasHistory && (
                <button
                  onClick={toggleHistory}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showHistory ? 'Hide' : 'Show'} previous versions
                </button>
              )}
              <button
                onClick={() => setConfirmRegenAll(true)}
                className="flex items-center gap-1.5 text-xs text-red-400 border border-red-500/30 hover:border-red-500/60 px-3 py-1.5 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate All
              </button>
            </div>
          </div>

          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-white/8">
                  {['Recruiter', 'LinkedIn String', 'Indeed String', 'Generated'].map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500 pb-3 pr-4 first:pl-1">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.allStrings.map(row => (
                  <tr key={row.id} className="hover:bg-white/2 transition-colors">
                    <td className="py-3 pr-4 pl-1 w-32">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-brand flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                          {(row.user_email ?? 'U')[0].toUpperCase()}
                        </div>
                        <span className="text-xs text-slate-300 truncate max-w-[100px]">
                          {row.user_email?.split('@')[0] ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 max-w-[200px]">
                      <div className="flex items-start gap-2">
                        <p className="text-[11px] text-slate-400 font-mono leading-relaxed truncate flex-1">
                          {row.linkedin_string}
                        </p>
                        <CopyButton text={row.linkedin_string} />
                      </div>
                    </td>
                    <td className="py-3 pr-4 max-w-[200px]">
                      <div className="flex items-start gap-2">
                        <p className="text-[11px] text-slate-400 font-mono leading-relaxed truncate flex-1">
                          {row.indeed_string}
                        </p>
                        <CopyButton text={row.indeed_string} />
                      </div>
                    </td>
                    <td className="py-3 pr-4 w-24">
                      <span className="text-[11px] text-slate-600">
                        {new Date(row.created_at).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))}

                {/* History rows */}
                {showHistory && historyLoading && (
                  <tr>
                    <td colSpan={4} className="py-3 pl-1 text-center">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-600 mx-auto" />
                    </td>
                  </tr>
                )}
                {showHistory && !historyLoading && historyRows.map(row => (
                  <tr key={row.id} className="opacity-40">
                    <td className="py-2 pr-4 pl-1">
                      <span className="text-xs text-slate-500 truncate">{row.user_email?.split('@')[0]}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="text-[11px] text-slate-600 font-mono truncate block max-w-[200px]">{row.linkedin_string}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="text-[11px] text-slate-600 font-mono truncate block max-w-[200px]">{row.indeed_string}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="text-[11px] text-slate-600">{new Date(row.created_at).toLocaleDateString()} (archived)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : data.myString ? (
        /* Recruiter view: own string only */
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Your Search String</h3>
            <p className="text-xs text-slate-500">
              This variation is unique to you — other team members have different strings to avoid candidate overlap.
            </p>
          </div>

          <StringCard
            label="LinkedIn Recruiter"
            logoIcon="💼"
            string={data.myString.linkedin_string}
          />
          <StringCard
            label="Indeed"
            logoIcon="🔍"
            string={data.myString.indeed_string}
          />

          <div className="flex justify-end">
            <button
              onClick={() => setConfirmRegenMe(true)}
              className="flex items-center gap-2 text-sm text-slate-400 border border-white/10 hover:border-white/20 hover:text-white px-4 py-2 rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate My String
            </button>
          </div>
        </div>
      ) : null}

      {/* Regenerate All confirmation */}
      {confirmRegenAll && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12141F] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-white">Regenerate all Boolean strings?</h3>
            <p className="text-xs text-slate-400">
              This will replace all current strings. Recruiters may already be using their current strings on LinkedIn.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmRegenAll(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleRegenAll} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-500/80 hover:bg-red-500 transition-colors">
                Regenerate All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Mine confirmation */}
      {confirmRegenMe && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12141F] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-white">Regenerate your string?</h3>
            <p className="text-xs text-slate-400">
              Generate a new unique variation for you? Your current string will be archived.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmRegenMe(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleRegenMe} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150">
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
