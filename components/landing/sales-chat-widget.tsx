'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageSquare, X, Send, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ExtractedInfo {
  name?: string | null
  email?: string | null
  company?: string | null
}

const CALENDLY = process.env.NEXT_PUBLIC_CALENDLY_URL ?? 'https://calendly.com/candidai'
const INACTIVITY_WARN = 12 * 60 * 1000
const INACTIVITY_CLOSE = 15 * 60 * 1000
const USER_TURN_LIMIT = 15
const MSG_HARD_CAP = 50

function isQualified(info: ExtractedInfo): boolean {
  return !!(info.name && info.email && info.company)
}

export function SalesChatWidget() {
  const [open, setOpen] = useState(false)
  const [conv, setConv] = useState<Message[]>([])
  const [streamingMsg, setStreamingMsg] = useState('')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [rateLimit, setRateLimit] = useState<'messages' | 'sessions' | null>(null)
  const [inactivityWarning, setInactivityWarning] = useState(false)
  const [qualified, setQualified] = useState(false)
  const [showCalendly, setShowCalendly] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastActivity = useRef(Date.now())
  const inactivityTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const isFirstSend = useRef(true)
  const qualifiedRef = useRef(false)
  const convRef = useRef<Message[]>([])

  // Keep refs in sync for use in event handlers / cleanup
  useEffect(() => {
    qualifiedRef.current = qualified
  }, [qualified])
  useEffect(() => {
    convRef.current = conv
  }, [conv])

  // Init session + restore conversation from localStorage
  useEffect(() => {
    let sid = localStorage.getItem('candid_chat_sid')
    if (!sid) {
      sid = crypto.randomUUID()
      localStorage.setItem('candid_chat_sid', sid)
    } else {
      isFirstSend.current = false
    }
    setSessionId(sid)

    const saved = localStorage.getItem('candid_chat_conv')
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Message[]
        if (Array.isArray(parsed) && parsed.length > 0) setConv(parsed)
      } catch { /* ignore */ }
    }
  }, [])

  // Listen for Enterprise CTA event
  useEffect(() => {
    const handler = () => { setOpen(true); resetActivity() }
    window.addEventListener('openSalesChat', handler)
    return () => window.removeEventListener('openSalesChat', handler)
  }, [])

  // Persist conversation to localStorage
  useEffect(() => {
    if (conv.length > 0) localStorage.setItem('candid_chat_conv', JSON.stringify(conv))
  }, [conv])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conv, streamingMsg, showCalendly])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120)
      resetActivity()
    } else {
      clearInactivityTimer()
    }
  }, [open])

  // Inactivity timer
  useEffect(() => {
    if (!open) return
    startInactivityTimer()
    return clearInactivityTimer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Drop-off on page unload
  useEffect(() => {
    const handler = () => {
      if (!qualifiedRef.current && convRef.current.length > 0) {
        sendDropOff('drop_off')
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  function startInactivityTimer() {
    clearInactivityTimer()
    inactivityTimer.current = setInterval(() => {
      const idle = Date.now() - lastActivity.current
      if (idle >= INACTIVITY_CLOSE) {
        handleClose('inactivity')
      } else if (idle >= INACTIVITY_WARN) {
        setInactivityWarning(true)
      }
    }, 30_000)
  }

  function clearInactivityTimer() {
    if (inactivityTimer.current) {
      clearInterval(inactivityTimer.current)
      inactivityTimer.current = null
    }
  }

  function resetActivity() {
    lastActivity.current = Date.now()
    setInactivityWarning(false)
  }

  function handleClose(reason: 'manual' | 'inactivity' = 'manual') {
    setOpen(false)
    if (!qualifiedRef.current && convRef.current.length > 0) {
      sendDropOff(reason === 'inactivity' ? 'inactivity' : 'drop_off')
    }
  }

  function sendDropOff(event: 'drop_off' | 'inactivity') {
    if (!sessionId) return
    const msgs = convRef.current
    const lastUserMsg = [...msgs].reverse().find(m => m.role === 'user')?.content ?? null
    const turnCount = msgs.filter(m => m.role === 'user').length
    const payload = JSON.stringify({ session_id: sessionId, event, last_user_message: lastUserMsg, turn_count: turnCount })
    try {
      navigator.sendBeacon('/api/sales-chat/drop-off', new Blob([payload], { type: 'application/json' }))
    } catch {
      fetch('/api/sales-chat/drop-off', { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
    }
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || busy || !sessionId) return
    if (conv.length >= MSG_HARD_CAP) { setRateLimit('messages'); return }

    const userMsg: Message = { role: 'user', content: text }
    const updatedConv = [...conv, userMsg]
    setConv(updatedConv)
    setInput('')
    setBusy(true)
    setStreamingMsg('')
    resetActivity()

    const userTurns = updatedConv.filter(m => m.role === 'user').length
    const hitTurnLimit = userTurns >= USER_TURN_LIMIT

    try {
      const res = await fetch('/api/sales-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          messages: updatedConv,
          is_new_session: isFirstSend.current,
        }),
      })

      isFirstSend.current = false

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        setRateLimit(data.type === 'sessions' ? 'sessions' : 'messages')
        setBusy(false)
        return
      }

      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
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
              accumulated += parsed.token
              setStreamingMsg(accumulated)
            }
            if (parsed.done === true) {
              const assistantMsg: Message = { role: 'assistant', content: accumulated }
              setConv(prev => [...prev, assistantMsg])
              setStreamingMsg('')
              if (parsed.extracted && isQualified(parsed.extracted)) {
                setQualified(true)
                qualifiedRef.current = true
              }
              if (hitTurnLimit) setShowCalendly(true)
            }
          } catch { /* malformed chunk */ }
        }
      }
    } catch {
      setConv(prev => [
        ...prev,
        { role: 'assistant', content: "I'm having a technical issue — please email collin@candidai.app directly and we'll get back to you within a few hours." },
      ])
      setStreamingMsg('')
    } finally {
      setBusy(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const messageLimitHit = conv.length >= MSG_HARD_CAP || rateLimit !== null

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => { setOpen(true); resetActivity() }}
        aria-label="Chat with Aria, Candid.ai sales assistant"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0D12]"
      >
        {open ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <>
            <MessageSquare className="w-6 h-6 text-white" />
            {conv.length === 0 && (
              <span className="absolute inset-0 rounded-full bg-indigo-500/40 animate-ping" aria-hidden="true" />
            )}
          </>
        )}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => handleClose('manual')}
          aria-hidden="true"
        />
      )}

      {/* Chat drawer */}
      {open && (
        <div
          className={cn(
            'fixed z-50 flex flex-col',
            'bg-[#0B0D12] border border-white/10 shadow-2xl shadow-black/60',
            // Mobile: bottom sheet
            'bottom-0 left-0 right-0 h-[82vh] rounded-t-2xl',
            // Desktop: floating panel
            'md:bottom-24 md:right-6 md:left-auto md:w-[380px] md:h-[540px] md:rounded-2xl',
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Candid.ai sales assistant"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-white">A</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-none">Aria</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-none">Candid.ai · Sales Assistant</p>
            </div>
            <button
              onClick={() => handleClose('manual')}
              aria-label="Close chat"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 min-h-0"
            aria-live="polite"
            aria-atomic="false"
            aria-relevant="additions"
          >
            {/* Opening greeting (always shown) */}
            {conv.length === 0 && !streamingMsg && (
              <AssistantBubble>
                Hey! I&apos;m Aria from Candid.ai. Tell me about your recruiting team — what are you working on?
              </AssistantBubble>
            )}

            {/* Conversation history */}
            {conv.map((msg, i) =>
              msg.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="bg-indigo-500/20 text-slate-200 rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[85%] text-sm leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <AssistantBubble key={i}>{msg.content}</AssistantBubble>
              )
            )}

            {/* Streaming response */}
            {streamingMsg && (
              <AssistantBubble>
                {streamingMsg}
                <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse align-middle" aria-hidden="true" />
              </AssistantBubble>
            )}

            {/* Thinking indicator */}
            {busy && !streamingMsg && (
              <div className="flex gap-2">
                <Avatar />
                <div className="bg-white/6 rounded-2xl rounded-tl-sm px-3.5 py-3">
                  <div className="flex gap-1 items-center h-3.5">
                    {[0, 150, 300].map(delay => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Calendly prompt */}
            {showCalendly && (
              <div className="flex gap-2">
                <Avatar />
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl rounded-tl-sm px-3.5 py-3 max-w-[85%]">
                  <p className="text-sm text-slate-200 leading-relaxed mb-3">
                    I&apos;d love to connect you with Collin — he can do a live demo and put together a custom quote. 20 minutes, no pressure.
                  </p>
                  <a
                    href={CALENDLY}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Book time with Collin
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Inactivity warning */}
            {inactivityWarning && (
              <p className="text-center text-[11px] text-slate-600">
                Still there? We&apos;ll save your spot.
              </p>
            )}

            {/* Rate limit message */}
            {rateLimit && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-3 text-sm text-amber-300">
                Reach us directly at{' '}
                <a href="mailto:collin@candidai.app" className="underline hover:text-amber-200">
                  collin@candidai.app
                </a>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {!messageLimitHit && (
            <div className="px-3 py-3 border-t border-white/8 flex-shrink-0">
              <div className="flex items-end gap-2 bg-white/6 rounded-xl px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); resetActivity() }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message…"
                  rows={1}
                  disabled={busy}
                  aria-label="Message"
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 resize-none focus:outline-none leading-5 max-h-24 disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="w-7 h-7 flex-shrink-0 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors mb-0.5"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              <p className="text-[10px] text-slate-700 text-center mt-1.5">
                AI assistant · Press Enter to send
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function Avatar() {
  return (
    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
      <span className="text-[10px] font-bold text-white">A</span>
    </div>
  )
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <Avatar />
      <div className="bg-white/6 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%] text-sm text-slate-200 leading-relaxed">
        {children}
      </div>
    </div>
  )
}
