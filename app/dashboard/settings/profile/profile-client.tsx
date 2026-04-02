'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Linkedin, CheckCircle2, RefreshCw, Camera, Loader2, ArrowLeft, User } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { UserAvatar } from '@/components/ui/user-avatar'

interface ProfileData {
  avatar_url:            string | null
  display_name:          string | null
  job_title:             string | null
  linkedin_url:          string | null
  linkedin_id:           string | null
  linkedin_connected_at: string | null
  phone:                 string | null
}

interface Props {
  userId:  string
  email:   string
  profile: ProfileData
}

export function ProfileClient({ userId, email, profile: initialProfile }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [profile,     setProfile]     = useState(initialProfile)
  const [displayName, setDisplayName] = useState(initialProfile.display_name ?? '')
  const [jobTitle,    setJobTitle]    = useState(initialProfile.job_title    ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(initialProfile.linkedin_url ?? '')
  const [phone,       setPhone]       = useState(initialProfile.phone        ?? '')
  const [saving,      setSaving]      = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle OAuth return params
  useEffect(() => {
    const li = searchParams.get('linkedin')
    if (li === 'connected') {
      toast.success('LinkedIn profile synced!')
      router.replace('/dashboard/settings/profile')
      router.refresh()
    } else if (li === 'error') {
      const reason = searchParams.get('reason')
      const msg = reason === 'state_mismatch'  ? 'Security check failed. Please try again.'
                : reason === 'state_expired'   ? 'Session expired. Please try again.'
                : reason === 'token_exchange'  ? 'LinkedIn authorization failed.'
                : reason === 'profile_fetch'   ? 'Could not fetch LinkedIn profile.'
                : reason === 'save_failed'     ? 'Profile save failed. Please try again.'
                : 'LinkedIn connection failed.'
      toast.error(msg)
      router.replace('/dashboard/settings/profile')
    }
  }, [searchParams, router])

  const isConnected = !!profile.linkedin_id

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/user-profiles', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ display_name: displayName, job_title: jobTitle, linkedin_url: linkedinUrl, phone }),
      })
      if (!res.ok) { toast.error('Save failed'); return }
      toast.success('Profile saved')
      router.refresh()
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/user-profiles/avatar', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return }
      setProfile(p => ({ ...p, avatar_url: data.url }))
      toast.success('Photo updated')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect LinkedIn? Your photo and name will remain but won\'t auto-sync.')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/auth/linkedin/disconnect', { method: 'POST' })
      if (!res.ok) { toast.error('Disconnect failed'); return }
      setProfile(p => ({ ...p, linkedin_id: null, linkedin_url: null, linkedin_connected_at: null }))
      toast.success('LinkedIn disconnected')
    } catch {
      toast.error('Disconnect failed')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-white">My Profile</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Your name and photo appear on notes, activity, and team views
          </p>
        </div>
      </div>

      {/* LinkedIn Connection Card */}
      <div className={`glass-card rounded-2xl p-5 border ${isConnected ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/10'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isConnected ? 'bg-blue-600' : 'bg-[#0A66C2]/20 border border-[#0A66C2]/30'}`}>
              <Linkedin className="w-5 h-5 text-white" />
            </div>
            <div>
              {isConnected ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-white">LinkedIn Connected</p>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Last synced:{' '}
                    {profile.linkedin_connected_at
                      ? new Date(profile.linkedin_connected_at).toLocaleDateString()
                      : 'recently'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-white">Connect LinkedIn</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sync your photo and name automatically
                  </p>
                </>
              )}
            </div>
          </div>

          {isConnected ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href="/api/auth/linkedin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 border border-white/10 hover:border-white/20 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </a>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-xs text-red-500/70 hover:text-red-400 transition-colors disabled:opacity-40"
              >
                {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Disconnect'}
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/linkedin"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#0A66C2] hover:bg-[#0A66C2]/80 transition-colors flex-shrink-0"
            >
              <Linkedin className="w-4 h-4" />
              Connect
            </a>
          )}
        </div>
      </div>

      {/* Manual fields form */}
      <form onSubmit={handleSave} className="glass-card rounded-2xl p-6 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <UserAvatar
              userId={userId}
              avatarUrl={profile.avatar_url}
              displayName={displayName || null}
              email={email}
              size={80}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 w-full h-full rounded-full flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
            >
              {uploading
                ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                : <Camera className="w-5 h-5 text-white" />}
            </button>
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-indigo-400 hover:text-indigo-200 transition-colors"
            >
              {uploading ? 'Uploading…' : 'Change photo'}
            </button>
            <p className="text-[10px] text-slate-500 mt-0.5">JPG, PNG, GIF or WebP · max 2 MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>

        {/* Fields */}
        <div className="grid gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your full name"
              maxLength={80}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              placeholder="e.g. Sr. Technical Recruiter"
              maxLength={100}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">LinkedIn URL</label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourname"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone <span className="text-slate-600">(optional)</span></label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              readOnly
              className="w-full bg-white/3 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
