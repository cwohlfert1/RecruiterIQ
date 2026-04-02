'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, RefreshCw, Copy, Check, Loader2, Search, ChevronDown, ChevronUp, Target, Globe, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

// ─── Syntax highlighter ───────────────────────────────────────

function BooleanHighlight({ text }: { text: string }) {
  const tokens: Array<{ type: string; value: string }> = []
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
          case 'AND':   return <span key={i} className="text-blue-400 font-bold">{t.value}</span>
          case 'OR':    return <span key={i} className="text-green-400 font-bold">{t.value}</span>
          case 'NOT':   return <span key={i} className="text-red-400 font-bold">{t.value}</span>
          case 'paren': return <span key={i} className="text-slate-400">{t.value}</span>
          case 'quote': return <span key={i} className="text-yellow-400">{t.value}</span>
          default:      return <span key={i} className="text-slate-200">{t.value}</span>
        }
      })}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/8">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ─── Types ───────────────────────────────────────────────────

type FeedbackBucket = '< 100' | '100-500' | '500-2000' | '2000+'

interface BooleanString {
  id:               string
  user_id:          string
  user_email:       string
  linkedin_string:  string
  indeed_string:    string
  variant_type:     string | null
  refinement_count: number
  feedback:         string | null
  created_at:       string
  broad?:           BooleanString | null
}

interface BooleanData {
  myTargeted:  BooleanString | null
  myBroad:     BooleanString | null
  hasAnyString: boolean
  allStrings:  BooleanString[]
  hasHistory:  boolean
}

interface Props {
  projectId:            string
  hasJd:                boolean
  isOwner:              boolean
  isManager:            boolean
  jdText:               string
  jdUpdatedThisSession: boolean
}

// ─── Feedback panel ───────────────────────────────────────────

const FEEDBACK_OPTIONS: Array<{ value: FeedbackBucket; label: string }> = [
  { value: '< 100',    label: '< 100 results'    },
  { value: '100-500',  label: '100–500 results'  },
  { value: '500-2000', label: '500–2000 results' },
  { value: '2000+',    label: '2000+ results'    },
]

function FeedbackPanel({
  stringRow,
  variantType,
  projectId,
  jobTitle,
  jdText,
  onRefined,
}: {
  stringRow:   BooleanString
  variantType: string
  projectId:   string
  jobTitle:    string
  jdText:      string
  onRefined:   (updated: Partial<BooleanString>) => void
}) {
  const [selected,    setSelected]    = useState<FeedbackBucket | null>(stringRow.feedback as FeedbackBucket | null)
  const [refining,    setRefining]    = useState(false)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [prevString,  setPrevString]  = useState<string | null>(null)
  const [showPrev,    setShowPrev]    = useState(false)
  const [limited,     setLimited]     = useState(false)
  const [confirmed,   setConfirmed]   = useState(false)

  const maxReached = (stringRow.refinement_count ?? 0) >= 3

  async function handleFeedback(bucket: FeedbackBucket) {
    if (refining) return
    setSelected(bucket)
    setRefining(true)
    setExplanation(null)
    setConfirmed(false)
    setLimited(false)

    try {
      const res  = await fetch(`/api/projects/${projectId}/boolean/refine`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          string_id:        stringRow.id,
          variant_type:     variantType,
          feedback:         bucket,
          current_linkedin: stringRow.linkedin_string,
          current_indeed:   stringRow.indeed_string,
          job_title:        jobTitle,
          jd_text:          jdText,
        }),
      })
      const data = await res.json()

      if (data.limited) { setLimited(true); setRefining(false); return }
      if (data.confirmed) {
        setConfirmed(true)
        setExplanation(data.explanation)
        setRefining(false)
        return
      }
      if (!res.ok) { toast.error(data.error ?? 'Refinement failed'); setRefining(false); return }

      setPrevString(stringRow.linkedin_string)
      setExplanation(data.explanation)
      onRefined({
        linkedin_string:  data.linkedin_string,
        indeed_string:    data.indeed_string,
        refinement_count: data.refinement_count,
        feedback:         bucket,
      })
    } catch {
      toast.error('Refinement failed')
    } finally {
      setRefining(false)
    }
  }

  if (maxReached) {
    return (
      <p className="text-xs text-slate-600 italic mt-2">
        Maximum refinements reached. Create a new search to start fresh.
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-slate-500">How did this search perform?</p>
      <div className="flex flex-wrap gap-2">
        {FEEDBACK_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleFeedback(opt.value)}
            disabled={refining}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border transition-all duration-150 disabled:opacity-50',
              selected === opt.value
                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                : 'bg-white/5 border-white/15 text-slate-400 hover:border-white/25 hover:text-slate-300',
            )}
          >
            {opt.label}
          </button>
        ))}
        {refining && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 self-center" />}
      </div>

      <AnimatePresence>
        {confirmed && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-xs text-emerald-400"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            {explanation}
          </motion.div>
        )}
        {limited && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-amber-400">
            Maximum refinements reached. Create a new search to start fresh.
          </motion.p>
        )}
        {explanation && !confirmed && !limited && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1.5"
          >
            <p className="text-xs text-slate-400 italic">Cortex: {explanation}</p>
            {prevString && (
              <div>
                <button
                  onClick={() => setShowPrev(v => !v)}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                >
                  {showPrev ? '▲' : '▼'} View previous version
                </button>
                {showPrev && (
                  <p className="text-[11px] font-mono text-slate-600 mt-1 break-all">{prevString}</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Variant string section ───────────────────────────────────

function VariantSection({
  stringRow,
  variantType,
  projectId,
  jobTitle,
  jdText,
  onRefined,
}: {
  stringRow:   BooleanString
  variantType: string
  projectId:   string
  jobTitle:    string
  jdText:      string
  onRefined:   (updated: Partial<BooleanString>) => void
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white/3 border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span className="text-base">💼</span>
            <span className="text-xs font-semibold text-slate-300">LinkedIn Recruiter</span>
          </div>
          <CopyButton text={stringRow.linkedin_string} />
        </div>
        <div className="px-4 py-3 bg-[#0D0F1A]">
          <BooleanHighlight text={stringRow.linkedin_string} />
        </div>
      </div>

      <div className="rounded-xl bg-white/3 border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span className="text-base">🔍</span>
            <span className="text-xs font-semibold text-slate-300">Indeed</span>
          </div>
          <CopyButton text={stringRow.indeed_string} />
        </div>
        <div className="px-4 py-3 bg-[#0D0F1A]">
          <BooleanHighlight text={stringRow.indeed_string} />
        </div>
      </div>

      {(stringRow.refinement_count ?? 0) > 0 && (
        <p className="text-[11px] text-slate-600">Refined {stringRow.refinement_count} time{stringRow.refinement_count !== 1 ? 's' : ''}</p>
      )}

      <FeedbackPanel
        stringRow={stringRow}
        variantType={variantType}
        projectId={projectId}
        jobTitle={jobTitle}
        jdText={jdText}
        onRefined={onRefined}
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

export function BooleanTab({ projectId, hasJd, isOwner, isManager, jdText, jdUpdatedThisSession }: Props) {
  const [data,            setData]            = useState<BooleanData | null>(null)
  const [loading,         setLoading]         = useState(true)
  const [generating,      setGenerating]      = useState(false)
  const [activeVariant,   setActiveVariant]   = useState<'targeted' | 'broad'>('targeted')
  const [confirmRegenAll, setConfirmRegenAll] = useState(false)
  const [confirmRegenMe,  setConfirmRegenMe]  = useState(false)
  const [showHistory,     setShowHistory]     = useState(false)
  const [historyRows,     setHistoryRows]     = useState<BooleanString[]>([])
  const [historyLoading,  setHistoryLoading]  = useState(false)

  const isManagerOrOwner = isOwner || isManager

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/boolean`)
      if (res.ok) setData(await res.json())
    } catch {
      toast.error('Failed to load Boolean strings')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { loadData() }, [loadData])

  // Inline update after refinement (no full reload)
  function handleRefinedTargeted(updated: Partial<BooleanString>) {
    setData(d => d ? { ...d, myTargeted: d.myTargeted ? { ...d.myTargeted, ...updated } : null } : d)
  }
  function handleRefinedBroad(updated: Partial<BooleanString>) {
    setData(d => d ? { ...d, myBroad: d.myBroad ? { ...d.myBroad, ...updated } : null } : d)
  }

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
    setConfirmRegenMe(false); setGenerating(true)
    try {
      const res  = await fetch(`/api/projects/${projectId}/boolean/regenerate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'mine' }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Regeneration failed'); return }
      toast.success('Your strings have been regenerated!')
      await loadData()
    } catch {
      toast.error('Regeneration failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenAll() {
    setConfirmRegenAll(false); setGenerating(true)
    try {
      const res  = await fetch(`/api/projects/${projectId}/boolean/regenerate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    setShowHistory(true); setHistoryLoading(true)
    try {
      const res  = await fetch(`/api/projects/${projectId}/boolean?history=1`)
      const json = await res.json()
      setHistoryRows(json.archived ?? [])
    } catch { /* ignore */ } finally { setHistoryLoading(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
  }

  const hasStrings = data?.hasAnyString || data?.myTargeted || data?.myBroad

  // Empty state
  if (!hasStrings) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/8 flex items-center justify-center mb-4">
          <Search className="w-6 h-6 text-slate-600" />
        </div>
        <p className="text-sm font-semibold text-slate-300 mb-1">No Boolean strings yet</p>
        <p className="text-xs text-slate-500 max-w-xs mb-6">
          {hasJd ? 'Generate targeted and broad search strings for each recruiter' : 'Add a job description first to enable Boolean string generation'}
        </p>
        {generating ? (
          <div className="flex items-center gap-2 text-sm text-indigo-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cortex is crafting your search strings<span className="animate-pulse">...</span>
          </div>
        ) : (
          <div className="relative group">
            <button
              onClick={hasJd ? handleGenerate : undefined}
              disabled={!hasJd}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
                hasJd ? 'text-white bg-gradient-brand hover-glow' : 'text-slate-500 border border-slate-700 bg-slate-800/50 cursor-not-allowed'
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

  if (generating) {
    return (
      <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-4 py-6 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-3" />
        <p className="text-sm text-indigo-300 font-medium">Cortex is crafting your search strings<span className="animate-pulse">...</span></p>
        <p className="text-xs text-slate-500 mt-1">This takes 10–30 seconds</p>
      </div>
    )
  }

  // My variant (recruiter or manager own section)
  const myTargeted = data?.myTargeted ?? null
  const myBroad    = data?.myBroad    ?? null
  const activeRow  = activeVariant === 'targeted' ? myTargeted : myBroad
  const hasBoth    = myTargeted !== null && myBroad !== null

  // Infer job title from projectId context — fallback to empty; jdText is passed for refinement
  const jobTitle = ''  // populated by the parent if available

  return (
    <div className="space-y-6">
      {/* JD updated banner */}
      {jdUpdatedThisSession && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-xs text-yellow-300">
          <span>Your job description was updated. Regenerate variations to reflect the changes.</span>
          {isManagerOrOwner && (
            <button onClick={() => setConfirmRegenAll(true)} className="ml-4 text-yellow-400 font-semibold hover:text-yellow-200 whitespace-nowrap">
              Regenerate All
            </button>
          )}
        </div>
      )}

      {/* My strings section */}
      {(myTargeted || myBroad) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-semibold text-slate-200">Your Search Strings</h3>
            <div className="flex items-center gap-2">
              {hasBoth && (
                <div className="flex rounded-xl overflow-hidden border border-white/10 text-xs">
                  <button
                    onClick={() => setActiveVariant('targeted')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 transition-colors',
                      activeVariant === 'targeted'
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'bg-white/5 text-slate-400 hover:text-slate-300'
                    )}
                  >
                    <Target className="w-3 h-3" />
                    Targeted
                  </button>
                  <button
                    onClick={() => setActiveVariant('broad')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 transition-colors border-l border-white/10',
                      activeVariant === 'broad'
                        ? 'bg-teal-500/20 text-teal-300'
                        : 'bg-white/5 text-slate-400 hover:text-slate-300'
                    )}
                  >
                    <Globe className="w-3 h-3" />
                    Broad
                  </button>
                </div>
              )}
              <button
                onClick={() => setConfirmRegenMe(true)}
                className="flex items-center gap-1.5 text-xs text-slate-400 border border-white/10 hover:border-white/20 hover:text-white px-3 py-1.5 rounded-xl transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </button>
            </div>
          </div>

          {/* Variant badge */}
          {hasBoth && (
            <div className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
              activeVariant === 'targeted'
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25'
                : 'bg-teal-500/10 text-teal-400 border-teal-500/25'
            )}>
              {activeVariant === 'targeted' ? (
                <><Target className="w-3 h-3" /> Precise — estimated 50–200 results</>
              ) : (
                <><Globe className="w-3 h-3" /> Wide net — estimated 500+ results</>
              )}
            </div>
          )}

          {activeRow && (
            <VariantSection
              stringRow={activeRow}
              variantType={activeVariant}
              projectId={projectId}
              jobTitle={jobTitle}
              jdText={jdText}
              onRefined={activeVariant === 'targeted' ? handleRefinedTargeted : handleRefinedBroad}
            />
          )}

          {!hasBoth && myTargeted && (
            <p className="text-xs text-slate-600">Only targeted search available — regenerate to get both variants.</p>
          )}
        </div>
      )}

      {/* Manager: all team strings table */}
      {isManagerOrOwner && data && data.allStrings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">All Team Variations</h3>
            <div className="flex items-center gap-3">
              {data.hasHistory && (
                <button onClick={toggleHistory} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showHistory ? 'Hide' : 'Show'} previous
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
            <table className="w-full text-sm border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-white/8">
                  {['Recruiter', 'Targeted (LinkedIn)', 'Broad (LinkedIn)', 'Generated'].map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500 pb-3 pr-4 first:pl-1">{h}</th>
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
                        <span className="text-xs text-slate-300 truncate max-w-[100px]">{row.user_email?.split('@')[0] ?? '—'}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 max-w-[180px]">
                      <div className="flex items-start gap-1">
                        <p className="text-[11px] text-slate-400 font-mono leading-relaxed truncate flex-1">{row.linkedin_string}</p>
                        <CopyButton text={row.linkedin_string} />
                      </div>
                    </td>
                    <td className="py-3 pr-4 max-w-[180px]">
                      {row.broad ? (
                        <div className="flex items-start gap-1">
                          <p className="text-[11px] text-slate-400 font-mono leading-relaxed truncate flex-1">{row.broad.linkedin_string}</p>
                          <CopyButton text={row.broad.linkedin_string} />
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 w-24">
                      <span className="text-[11px] text-slate-600">{new Date(row.created_at).toLocaleDateString()}</span>
                    </td>
                  </tr>
                ))}
                {showHistory && historyLoading && (
                  <tr><td colSpan={4} className="py-3 text-center"><Loader2 className="w-4 h-4 animate-spin text-slate-600 mx-auto" /></td></tr>
                )}
                {showHistory && !historyLoading && historyRows.map(row => (
                  <tr key={row.id} className="opacity-40">
                    <td className="py-2 pr-4 pl-1"><span className="text-xs text-slate-500 truncate">{row.user_email?.split('@')[0]}</span></td>
                    <td className="py-2 pr-4"><span className="text-[11px] text-slate-600 font-mono truncate block max-w-[180px]">{row.linkedin_string}</span></td>
                    <td className="py-2 pr-4"><span className="text-[11px] text-slate-600 font-mono truncate block max-w-[180px]">{(row as BooleanString & { broad?: BooleanString }).broad?.linkedin_string ?? '—'}</span></td>
                    <td className="py-2 pr-4"><span className="text-[11px] text-slate-600">{new Date(row.created_at).toLocaleDateString()} (archived)</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm modals */}
      {confirmRegenAll && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12141F] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-white">Regenerate all Boolean strings?</h3>
            <p className="text-xs text-slate-400">This will replace all current targeted and broad strings. Recruiters may already be using their current strings.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmRegenAll(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleRegenAll} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-500/80 hover:bg-red-500 transition-colors">Regenerate All</button>
            </div>
          </div>
        </div>
      )}

      {confirmRegenMe && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12141F] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-white">Regenerate your strings?</h3>
            <p className="text-xs text-slate-400">Generates new targeted and broad variations for you. Current strings will be archived.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmRegenMe(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleRegenMe} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150">Regenerate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
