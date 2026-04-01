'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Copy, Check, Loader2, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import type { CandidateRow } from '@/app/dashboard/projects/[id]/page'

interface Props {
  open:      boolean
  candidate: CandidateRow | null
  project:   { id: string; title: string; client_name: string }
  onClose:   () => void
}

export function GenerateSummaryModal({ open, candidate, project, onClose }: Props) {
  const [text,      setText]      = useState('')
  const [streaming, setStreaming]  = useState(false)
  const [copied,    setCopied]    = useState(false)
  const abortRef                  = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open && candidate) {
      setText('')
      setStreaming(false)
      startGeneration()
    }
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidate?.id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  async function startGeneration() {
    if (!candidate) return
    setStreaming(true)
    setText('')

    abortRef.current = new AbortController()

    // Truncate resume to ~400 words for the notes field
    const words       = candidate.resume_text.trim().split(/\s+/)
    const truncated   = words.slice(0, 400).join(' ')

    try {
      const res = await fetch('/api/generate-summary', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          jobTitle:    project.title,
          companyName: project.client_name,
          notes:       truncated,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.reason === 'plan_required') {
          toast.error('Summary generation requires a Pro plan.')
        } else {
          toast.error(data.error ?? 'Generation failed')
        }
        setStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setStreaming(false); return }
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') { setStreaming(false); break }
          try {
            const parsed = JSON.parse(payload)
            if (parsed.token) setText(prev => prev + parsed.token)
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.error('Generation failed. Please try again.')
      }
    } finally {
      setStreaming(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{   opacity: 0, scale: 0.96,  y: 8 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full max-w-xl bg-[#12141F] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-semibold text-white">
                    Client Summary — {candidate?.candidate_name}
                  </h2>
                </div>
                <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {streaming && !text && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating summary…
                  </div>
                )}
                {text && (
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{text}</p>
                )}
                {streaming && text && (
                  <span className="inline-block w-1 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-white/8 flex justify-between items-center">
                <button
                  onClick={startGeneration}
                  disabled={streaming}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
                >
                  Regenerate
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!text || streaming}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:border-white/20 hover:text-white transition-colors disabled:opacity-40"
                >
                  {copied ? <><Check className="w-4 h-4 text-emerald-400" />Copied!</> : <><Copy className="w-4 h-4" />Copy</>}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
