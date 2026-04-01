'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, PlusCircle, Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { FileDropTextarea } from '@/components/ui/file-drop-textarea'
import { cn } from '@/lib/utils'

// ─── Validation ──────────────────────────────────────────────

function validateTitle(v: string) {
  if (!v.trim())         return 'Job title is required'
  if (v.trim().length > 100) return 'Job title must be 100 characters or fewer'
  return null
}

function validateClient(v: string) {
  if (!v.trim())         return 'Client name is required'
  if (v.trim().length > 100) return 'Client name must be 100 characters or fewer'
  return null
}

// ─── Field Component ─────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
}: {
  label:    string
  required?: boolean
  error?:   string | null
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-300">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────

export default function CreateProjectPage() {
  const router = useRouter()

  const [title,       setTitle]       = useState('')
  const [clientName,  setClientName]  = useState('')
  const [jdText,      setJdText]      = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [planError,   setPlanError]   = useState<{ limit: number; planTier: string } | null>(null)
  const [touched,     setTouched]     = useState({ title: false, clientName: false })

  const titleError  = touched.title      ? validateTitle(title)       : null
  const clientError = touched.clientName ? validateClient(clientName) : null

  async function submit(status: 'active' | 'draft') {
    setTouched({ title: true, clientName: true })

    const tErr = validateTitle(title)
    const cErr = validateClient(clientName)
    if (tErr || cErr) return

    setSubmitting(true)
    setPlanError(null)

    try {
      const res = await fetch('/api/projects/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:       title.trim(),
          client_name: clientName.trim(),
          jd_text:     jdText.trim() || undefined,
          // status draft not yet supported by API — always creates active
        }),
      })

      const data = await res.json()

      if (res.status === 403 && data.error === 'plan_limit_reached') {
        setPlanError({ limit: data.limit, planTier: data.planTier })
        setSubmitting(false)
        return
      }

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create project')
        setSubmitting(false)
        return
      }

      toast.success('Project created!')
      router.push(`/dashboard/projects/${data.id}`)
    } catch {
      toast.error('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Back link */}
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to My Projects
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold gradient-text mb-1">Create a Project</h1>
        <p className="text-sm text-slate-400">
          A project keeps your candidates, job description, and boolean strings in one place.
        </p>
      </div>

      {/* Plan limit error */}
      {planError && (
        <div className="flex items-start gap-4 p-5 rounded-2xl bg-yellow-500/10 border border-yellow-500/25">
          <Zap className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white mb-0.5">
              Project limit reached
            </p>
            <p className="text-xs text-slate-300">
              Your {planError.planTier} plan allows up to {planError.limit} active project{planError.limit !== 1 ? 's' : ''}. Upgrade to create more.
            </p>
          </div>
          <Link
            href="/dashboard/settings#billing"
            className="flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-yellow-500 hover:bg-yellow-400 transition-colors"
          >
            Upgrade
          </Link>
        </div>
      )}

      {/* Form */}
      <div className="glass-card rounded-2xl p-6 space-y-6">
        <Field label="Job Title" required error={titleError}>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, title: true }))}
            placeholder="e.g. Senior React Developer"
            maxLength={100}
            className={cn(
              'w-full px-4 py-2.5 rounded-xl bg-white/5 border text-sm text-slate-200 placeholder:text-slate-600',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
              titleError ? 'border-red-500/60' : 'border-white/10 hover:border-white/20'
            )}
          />
          <p className="text-[11px] text-slate-600 text-right">{title.length}/100</p>
        </Field>

        <Field label="Client / Company Name" required error={clientError}>
          <input
            type="text"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, clientName: true }))}
            placeholder="e.g. TechCorp Inc."
            maxLength={100}
            className={cn(
              'w-full px-4 py-2.5 rounded-xl bg-white/5 border text-sm text-slate-200 placeholder:text-slate-600',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors',
              clientError ? 'border-red-500/60' : 'border-white/10 hover:border-white/20'
            )}
          />
          <p className="text-[11px] text-slate-600 text-right">{clientName.length}/100</p>
        </Field>

        <Field label="Job Description" error={null}>
          <FileDropTextarea
            value={jdText}
            onChange={setJdText}
            placeholder="Paste or upload a job description (PDF, DOCX, or TXT)…"
            minHeight="180px"
            rows={8}
          />
          <p className="text-xs text-slate-500 mt-1">
            Optional — can be added or edited later. Helps with resume scoring and boolean generation.
          </p>
        </Field>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/dashboard/projects"
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:text-slate-200 hover:border-white/20 transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={() => submit('active')}
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Creating…</>
          ) : (
            <><PlusCircle className="w-4 h-4" />Create Project</>
          )}
        </button>
      </div>
    </div>
  )
}
