'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sparkles, X, Trash2, Copy, Check, ArrowUp, Lock, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buildPageContext, getContextLabel } from '@/lib/cortex/context-builder'
import { parseFile } from '@/components/ui/file-drop-textarea'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

interface CortexPanelProps {
  open: boolean
  onClose: () => void
  planTier: string
}

const STARTERS = [
  'Help me fix my Boolean string',
  'What should I screen for on this role?',
  'Compare my top candidates',
]

export function CortexPanel({ open, onClose, planTier }: CortexPanelProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isLocked = planTier !== 'agency'
  const contextLabel = getContextLabel(pathname)

  // Load history on first open
  useEffect(() => {
    if (!open || loaded || isLocked) return
    fetch('/api/cortex/history')
      .then(r => r.ok ? r.json() : { messages: [] })
      .then(data => setMessages(data.messages ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [open, loaded, isLocked])

  // Focus input on open
  useEffect(() => {
    if (open && !isLocked) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open, isLocked])

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || busy) return

    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setBusy(true)
    setStreaming('')

    const pageContext = buildPageContext(pathname)

    try {
      const res = await fetch('/api/cortex/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, page_context: pageContext }),
      })

      if (res.status === 429) {
        toast.error("You're sending messages quickly — wait a moment")
        setBusy(false)
        return
      }
      if (!res.ok || !res.body) throw new Error()

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const parsed = JSON.parse(raw)
            if (typeof parsed.token === 'string') {
              acc += parsed.token
              setStreaming(acc)
            }
            if (parsed.done) {
              setMessages(prev => [...prev, { role: 'assistant', content: acc }])
              setStreaming('')
            }
          } catch { /* malformed chunk */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong — try again.' }])
      setStreaming('')
    } finally {
      setBusy(false)
    }
  }, [input, busy, pathname])

  async function handleClear() {
    await fetch('/api/cortex/history', { method: 'DELETE' }).catch(() => {})
    setMessages([])
    toast.success('Conversation cleared')
  }

  async function handleCopy(content: string, id: string) {
    await navigator.clipboard.writeText(content)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Parse action buttons from Cortex responses
  function renderContent(content: string) {
    const actionRegex = /\[ACTION:([\w-]+)\]/g
    const parts = content.split(actionRegex)
    if (parts.length <= 1) return <span>{content}</span>

    const ACTION_MAP: Record<string, { label: string; href: string }> = {
      'boolean_generator': { label: 'Open Boolean Generator →', href: '/dashboard/boolean' },
      'resume_scorer':     { label: 'Score a Resume →',         href: '/dashboard/scorer' },
      'summary_generator': { label: 'Generate Summary →',       href: '/dashboard/summary' },
      'stack_ranking':     { label: 'Open Stack Ranking →',     href: '/dashboard/ranking' },
      'spread_tracker':    { label: 'Open Spread Tracker →',    href: '/dashboard/spread-tracker' },
    }

    return (
      <>
        {parts.map((part, i) => {
          const action = ACTION_MAP[part]
          if (action) {
            return (
              <button
                key={i}
                onClick={() => { router.push(action.href); onClose() }}
                className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 text-xs font-medium text-indigo-300 border border-indigo-500/30 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
              >
                {action.label}
              </button>
            )
          }
          return <span key={i}>{part}</span>
        })}
      </>
    )
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-[380px] z-40 flex flex-col',
          'bg-[#0F1117] border-l border-white/10 shadow-2xl shadow-black/40',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">Cortex AI</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-none">{contextLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && !isLocked && (
              <button onClick={handleClear} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors" title="Clear conversation">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Locked state */}
        {isLocked ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <Lock className="w-8 h-8 text-slate-500 mb-3" />
            <p className="text-sm font-semibold text-white mb-1">Cortex AI is available on the Agency plan</p>
            <p className="text-xs text-slate-500 mb-4">Upgrade to get a context-aware recruiting co-pilot</p>
            <a href="/dashboard/settings/billing" className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 transition-all">
              Upgrade Plan
            </a>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
              {/* Empty state */}
              {messages.length === 0 && !streaming && !busy && (
                <div className="flex flex-col items-center text-center pt-12 gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Hi, I&apos;m Cortex.</p>
                    <p className="text-xs text-slate-500 mt-1">Ask me anything about your candidates, search strings, or this role.</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {STARTERS.map(s => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="px-3 py-1.5 text-[11px] text-slate-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/8 hover:border-white/20 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation */}
              {messages.map((msg, i) => (
                <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-indigo-500/20 text-slate-200 rounded-tr-sm'
                      : 'bg-white/5 text-slate-200 rounded-tl-sm',
                  )}>
                    <div className="whitespace-pre-wrap break-words">
                      {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 gap-2">
                      <span className="text-[9px] text-slate-600">
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now'}
                      </span>
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => handleCopy(msg.content, String(i))}
                          className="text-slate-600 hover:text-slate-400 transition-colors"
                        >
                          {copied === String(i) ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Streaming response */}
              {streaming && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white/5 px-3.5 py-2.5 text-sm text-slate-200 leading-relaxed">
                    <div className="whitespace-pre-wrap break-words">
                      {streaming}
                      <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
                    </div>
                  </div>
                </div>
              )}

              {/* Typing indicator */}
              {busy && !streaming && (
                <div className="flex justify-start">
                  <div className="bg-white/5 rounded-2xl rounded-tl-sm px-3.5 py-3">
                    <div className="flex gap-1 items-center h-3.5">
                      {[0, 150, 300].map(delay => (
                        <span key={delay} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t border-white/8 flex-shrink-0 space-y-2">
              {/* Resume drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-500/40', 'bg-indigo-500/5') }}
                onDragLeave={e => { e.currentTarget.classList.remove('border-indigo-500/40', 'bg-indigo-500/5') }}
                onDrop={async e => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-indigo-500/40', 'bg-indigo-500/5')
                  const file = e.dataTransfer.files[0]
                  if (!file) return
                  try {
                    const text = await parseFile(file)
                    if (text.trim()) sendMessage(`Here is a resume:\n\n${text.slice(0, 3000)}\n\nWhat do you think about this candidate for the current role?`)
                    else toast.error('Could not extract text from file')
                  } catch { toast.error('Failed to parse file') }
                }}
                className="flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-white/10 rounded-lg text-[10px] text-slate-600 hover:text-slate-400 hover:border-white/20 transition-colors cursor-default"
              >
                <Upload className="w-3 h-3" />
                Drop a resume to analyze it
              </div>
              <div className="flex items-end gap-2 bg-white/5 rounded-xl px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Cortex anything..."
                  rows={1}
                  disabled={busy}
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 resize-none focus:outline-none leading-5 max-h-20 disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={busy || !input.trim()}
                  className="w-7 h-7 flex-shrink-0 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors mb-0.5"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              <p className="text-[10px] text-slate-700 text-center mt-1.5">
                Cortex AI · Press Enter to send
              </p>
            </div>
          </>
        )}
      </div>
    </>
  )
}
