'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Building2, Upload, X, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

interface Props {
  initialAgencyName: string
  initialLogoUrl:    string | null
}

export function AgencyBrandingClient({ initialAgencyName, initialLogoUrl }: Props) {
  const [agencyName, setAgencyName] = useState(initialAgencyName)
  const [logoUrl,    setLogoUrl]    = useState<string | null>(initialLogoUrl)
  const [preview,    setPreview]    = useState<string | null>(initialLogoUrl)
  const [logoFile,   setLogoFile]   = useState<File | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFilePick(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      toast.error('PNG, JPG, or SVG only')
      return
    }
    setLogoFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const form = new FormData()
      form.append('agency_name', agencyName)
      if (logoFile) form.append('logo', logoFile)

      const res  = await fetch('/api/settings/agency-branding', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) { toast.error(data.error ?? 'Save failed'); return }

      if (data.agency_logo_url) setLogoUrl(data.agency_logo_url)
      setLogoFile(null)
      setSaved(true)
      toast.success('Branding saved')
      setTimeout(() => setSaved(false), 3000)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveLogo() {
    setLogoFile(null)
    setPreview(null)
    setLogoUrl(null)
    // Save the null immediately
    const form = new FormData()
    form.append('agency_name', agencyName)
    await fetch('/api/settings/agency-branding', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ agency_name: agencyName }),
    })
    // Clear the logo via a separate call — just update name for now, logo removal needs explicit DB clear
    await fetch('/api/settings/agency-branding', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ agency_logo_url: null }),
    })
    toast.success('Logo removed')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Agency Branding</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Customize how your agency appears in the sidebar. Your team members will see your branding.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 space-y-6"
      >
        {/* Agency name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Agency Name</label>
          <input
            type="text"
            value={agencyName}
            onChange={e => setAgencyName(e.target.value)}
            placeholder="e.g. Apex Recruiting"
            maxLength={60}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
          />
          <p className="text-xs text-slate-600">
            Displayed in the sidebar below your logo
          </p>
        </div>

        {/* Logo upload */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-300">Agency Logo</label>

          {preview ? (
            <div className="flex items-center gap-4">
              <div className="w-24 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden p-2">
                <Image
                  src={preview}
                  alt="Agency logo"
                  width={80}
                  height={36}
                  className="object-contain max-h-9 w-auto"
                  unoptimized
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Replace logo
                </button>
                <button
                  onClick={handleRemoveLogo}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-dashed border-white/20 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all duration-150 w-full text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
                <Upload className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-300">Upload logo</p>
                <p className="text-xs text-slate-600">PNG, JPG, or SVG — max 2MB</p>
              </div>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFilePick(f)
              e.target.value = ''
            }}
          />
        </div>

        {/* Preview */}
        {(preview || agencyName) && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Sidebar Preview</p>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1A1D2E] border border-white/8 w-fit">
              {preview ? (
                <Image
                  src={preview}
                  alt="Agency logo preview"
                  width={72}
                  height={36}
                  className="object-contain max-h-9 w-auto"
                  unoptimized
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                </div>
              )}
              {agencyName && (
                <div>
                  <p className="text-sm font-medium text-white">{agencyName}</p>
                  <p className="text-[10px] text-slate-600">Powered by Candid.ai</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
            ) : saved ? (
              <><CheckCircle2 className="w-4 h-4" />Saved</>
            ) : (
              'Save Branding'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
